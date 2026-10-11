from decimal import Decimal
import pytest
from fastapi import status
from app.crud.operations import create_user, get_risk_settings_by_user_id
from app.schemas.entities import UserCreate


def test_duplicate_registration_email_and_username(client):
    register_payload = {
        "email": "trader1@tradepilot.io",
        "username": "traderone",
        "password": "Password123!",
    }
    # 1. Successful registration
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "trader1@tradepilot.io"
    # Ensure cookie is set
    assert "tradepilot_token" in response.cookies

    # 2. Duplicate email registration
    dup_email_payload = {
        "email": "trader1@tradepilot.io",
        "username": "different_username",
        "password": "Password123!",
    }
    dup_resp = client.post("/api/v1/auth/register", json=dup_email_payload)
    assert dup_resp.status_code == status.HTTP_409_CONFLICT
    assert dup_resp.json()["error"]["message"] == "A user with this email address already exists."

    # 3. Duplicate username registration
    dup_user_payload = {
        "email": "different_email@tradepilot.io",
        "username": "traderone",
        "password": "Password123!",
    }
    dup_user_resp = client.post("/api/v1/auth/register", json=dup_user_payload)
    assert dup_user_resp.status_code == status.HTTP_409_CONFLICT
    assert dup_user_resp.json()["error"]["message"] == "A user with this username already exists."


def test_password_validation_requirements(client):
    # Missing uppercase
    resp1 = client.post("/api/v1/auth/register", json={
        "email": "weak@tradepilot.io",
        "username": "weakuser1",
        "password": "password123!",
    })
    assert resp1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing digit
    resp2 = client.post("/api/v1/auth/register", json={
        "email": "weak@tradepilot.io",
        "username": "weakuser2",
        "password": "PasswordNoDigits!",
    })
    assert resp2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Too short (< 8 chars)
    resp3 = client.post("/api/v1/auth/register", json={
        "email": "weak@tradepilot.io",
        "username": "weakuser3",
        "password": "Pa1!",
    })
    assert resp3.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_invalid_login_credentials(client):
    # Non-existent user
    resp1 = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@tradepilot.io",
        "password": "WrongPassword123!",
    })
    assert resp1.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp1.json()["error"]["message"] == "Invalid email or password."

    # Register user first
    client.post("/api/v1/auth/register", json={
        "email": "validuser@tradepilot.io",
        "username": "validuser",
        "password": "CorrectPassword123!",
    })

    # Incorrect password
    resp2 = client.post("/api/v1/auth/login", json={
        "email": "validuser@tradepilot.io",
        "password": "IncorrectPassword123!",
    })
    assert resp2.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp2.json()["error"]["message"] == "Invalid email or password."


def test_current_user_and_logout(client):
    # Register and get session
    register_resp = client.post("/api/v1/auth/register", json={
        "email": "session_user@tradepilot.io",
        "username": "session_user",
        "password": "ValidPassword123!",
    })
    assert register_resp.status_code == status.HTTP_201_CREATED

    # Fetch current user using cookie in client
    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == status.HTTP_200_OK
    assert me_resp.json()["email"] == "session_user@tradepilot.io"
    assert "hashed_password" not in me_resp.json()

    # Logout
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == status.HTTP_200_OK

    # Calling me after logout fails with 401
    me_after_resp = client.get("/api/v1/auth/me")
    assert me_after_resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_unauthorized_and_invalid_token(client):
    # No auth header or cookie
    resp = client.get("/api/v1/settings")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "HTTP_401"

    # Malformed bearer token
    resp_invalid = client.get(
        "/api/v1/settings",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert resp_invalid.status_code == status.HTTP_401_UNAUTHORIZED

    # Expired token
    from datetime import timedelta
    from app.core.security import create_access_token
    expired_token = create_access_token(subject=999, expires_delta=timedelta(seconds=-10))
    resp_expired = client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp_expired.status_code == status.HTTP_401_UNAUTHORIZED


def test_cross_user_data_isolation(client, db_session):
    # Register User A
    resp_a = client.post("/api/v1/auth/register", json={
        "email": "user_a@tradepilot.io",
        "username": "user_a",
        "password": "PasswordUserA123!",
    })
    token_a = resp_a.json()["access_token"]
    user_a_id = resp_a.json()["user"]["id"]

    # Register User B
    resp_b = client.post("/api/v1/auth/register", json={
        "email": "user_b@tradepilot.io",
        "username": "user_b",
        "password": "PasswordUserB123!",
    })
    token_b = resp_b.json()["access_token"]
    user_b_id = resp_b.json()["user"]["id"]

    # Modify User B's risk settings
    update_b_resp = client.put(
        "/api/v1/settings",
        json={"max_risk_per_trade_pct": "0.50", "base_currency": "EUR"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert update_b_resp.status_code == status.HTTP_200_OK

    # Query User A's settings using User A's token
    get_a_resp = client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert get_a_resp.status_code == status.HTTP_200_OK
    a_settings = get_a_resp.json()
    assert a_settings["user_id"] == user_a_id
    # User A's settings must remain untouched default (1.00% USD), not User B's (0.50% EUR)
    assert float(a_settings["max_risk_per_trade_pct"]) == 1.00
    assert a_settings["base_currency"] == "USD"
