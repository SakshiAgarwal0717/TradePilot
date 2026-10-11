from decimal import Decimal
import pytest
from fastapi import status
from app.crud.operations import create_user
from app.schemas.entities import UserCreate
from app.core.security import create_access_token


def test_gatekeeper_evaluate_endpoint_approved(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="gk_trader@tradepilot.io",
            username="gk_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    payload = {
        "account_equity": "50000.00",
        "risk_percentage": "1.00",
        "symbol": "NQ",
        "side": "LONG",
        "entry_price": "21000.00",
        "stop_loss": "20950.00",
        "target_price": "21150.00",
        "quantity_increment": "1",
        "min_reward_risk_ratio": "2.0",
        "save_evaluation": True,
    }

    response = client.post(
        "/api/v1/gatekeeper/evaluate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["outcome"] == "APPROVED"
    assert float(data["risk_budget"]) == 500.0
    assert float(data["stop_distance"]) == 50.0
    assert float(data["reward_to_risk_ratio"]) == 3.0
    assert float(data["recommended_quantity"]) == 10.0
    assert data["evaluation_id"] is not None

    # Verify history persistence
    hist_resp = client.get(
        "/api/v1/gatekeeper/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hist_resp.status_code == status.HTTP_200_OK
    history = hist_resp.json()
    assert len(history) >= 1
    assert history[0]["id"] == data["evaluation_id"]
    assert history[0]["outcome"] == "APPROVED"


def test_gatekeeper_evaluate_unauthorized(client):
    payload = {
        "account_equity": "50000.00",
        "risk_percentage": "1.00",
        "symbol": "NQ",
        "side": "LONG",
        "entry_price": "21000.00",
        "stop_loss": "20950.00",
    }
    response = client.post("/api/v1/gatekeeper/evaluate", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_gatekeeper_evaluate_rejection(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="reject_trader@tradepilot.io",
            username="reject_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # Long trade with stop loss placed above entry price
    payload = {
        "account_equity": "50000.00",
        "risk_percentage": "1.00",
        "symbol": "ES",
        "side": "LONG",
        "entry_price": "5800.00",
        "stop_loss": "5850.00",  # INVALID for long
        "target_price": "5900.00",
    }

    response = client.post(
        "/api/v1/gatekeeper/evaluate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["outcome"] == "REJECTED"
    assert any(r["status"] == "FAIL" for r in data["rules"])
    rejection_eval_id = data["evaluation_id"]

    # Attempting to save a rejected evaluation to the journal MUST FAIL (HTTP 400)
    trade_payload = {
        "symbol": "ES",
        "side": "LONG",
        "quantity": "1.0",
        "entry_price": "5800.00",
        "stop_loss": "5850.00",
    }
    reject_save_resp = client.post(
        f"/api/v1/trades/?evaluation_id={rejection_eval_id}",
        json=trade_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reject_save_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "rejected" in reject_save_resp.json()["error"]["message"].lower()


def test_gatekeeper_save_approved_trade_to_journal(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="save_approved@tradepilot.io",
            username="save_approved",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # 1. Evaluate valid trade
    eval_resp = client.post(
        "/api/v1/gatekeeper/evaluate",
        json={
            "account_equity": "25000.00",
            "risk_percentage": "1.00",
            "symbol": "AAPL",
            "side": "LONG",
            "entry_price": "220.00",
            "stop_loss": "215.00",
            "target_price": "235.00",
            "save_evaluation": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert eval_resp.status_code == status.HTTP_200_OK
    eval_data = eval_resp.json()
    assert eval_data["outcome"] == "APPROVED"
    eval_id = eval_data["evaluation_id"]

    # 2. Save approved trade to journal
    trade_payload = {
        "symbol": "AAPL",
        "side": "LONG",
        "quantity": str(eval_data["recommended_quantity"]),
        "entry_price": "220.00",
        "stop_loss": "215.00",
        "take_profit": "235.00",
    }
    trade_resp = client.post(
        f"/api/v1/trades/?evaluation_id={eval_id}",
        json=trade_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trade_resp.status_code == status.HTTP_201_CREATED
    trade_data = trade_resp.json()
    assert trade_data["symbol"] == "AAPL"
    assert trade_data["user_id"] == user.id

    # 3. Retrieve journal
    list_resp = client.get("/api/v1/trades/", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == status.HTTP_200_OK
    trades = list_resp.json()["items"]
    assert len(trades) == 1
    assert trades[0]["id"] == trade_data["id"]
