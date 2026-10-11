from fastapi import status
from app.crud.operations import create_user
from app.schemas.entities import UserCreate
from app.core.security import create_access_token


def test_health_check_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert data["project"] == "TradePilot"
    assert data["database"] == "sqlite"


def test_get_settings_endpoint_with_auth(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="settings_user@tradepilot.io",
            username="settings_user",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)
    response = client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "max_risk_per_trade_pct" in data
    assert "max_daily_loss_pct" in data
    assert "enforce_mandatory_stop_loss" in data
    assert "base_currency" in data


def test_update_settings_endpoint_with_auth(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="update_user@tradepilot.io",
            username="update_user",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)
    update_payload = {
        "max_risk_per_trade_pct": "0.75",
        "max_daily_loss_pct": "1.50",
        "max_open_positions": 2,
        "enforce_mandatory_stop_loss": True,
        "base_currency": "EUR",
    }
    response = client.put(
        "/api/v1/settings",
        json=update_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert float(data["max_risk_per_trade_pct"]) == 0.75
    assert float(data["max_daily_loss_pct"]) == 1.50
    assert data["max_open_positions"] == 2
    assert data["base_currency"] == "EUR"


def test_validation_error_response_format(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="val_user@tradepilot.io",
            username="val_user",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)
    # Invalid numeric constraint: max_risk_per_trade_pct exceeds 100.0
    invalid_payload = {
        "max_risk_per_trade_pct": "150.00",
    }
    response = client.put(
        "/api/v1/settings",
        json=invalid_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert data["error"]["message"] == "Input validation failed."
    assert isinstance(data["error"]["details"], list)


def test_not_found_error_response_format(client):
    response = client.get("/api/v1/non_existent_route")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "HTTP_404"
