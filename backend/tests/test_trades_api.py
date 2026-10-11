from decimal import Decimal
import pytest
from fastapi import status
from app.crud.operations import create_user
from app.schemas.entities import UserCreate
from app.core.security import create_access_token


def test_create_and_read_trade(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="journal_trader@tradepilot.io",
            username="journal_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # 1. Create open trade
    trade_payload = {
        "symbol": "NQ",
        "side": "LONG",
        "status": "OPEN",
        "quantity": "2.0",
        "entry_price": "21000.00",
        "stop_loss": "20950.00",
        "take_profit": "21150.00",
        "fees": "5.00",
        "notes": "Testing journal entry",
    }
    resp = client.post(
        "/api/v1/trades/",
        json=trade_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    trade_id = resp.json()["id"]
    assert resp.json()["symbol"] == "NQ"
    assert resp.json()["realized_pnl"] is None  # Open trade has no realized P&L

    # 2. Get single trade
    get_resp = client.get(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["id"] == trade_id


def test_closed_trade_pnl_and_r_multiple_calculation(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="calc_trader@tradepilot.io",
            username="calc_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # Long: Entry 100, Stop 95 (risk per unit = 5), Exit 110, Quantity 10, Fees 10
    # Gross P&L = (110 - 100) * 10 = +$100
    # Net Realized P&L = $100 - $10 fees = +$90.00
    # Initial Risk = 5 * 10 = $50
    # R-Multiple = 90 / 50 = +1.80R
    trade_payload = {
        "symbol": "TSLA",
        "side": "LONG",
        "status": "CLOSED",
        "quantity": "10.0",
        "entry_price": "100.00",
        "stop_loss": "95.00",
        "exit_price": "110.00",
        "fees": "10.00",
    }
    resp = client.post(
        "/api/v1/trades/",
        json=trade_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert float(data["realized_pnl"]) == 90.0
    assert float(data["r_multiple"]) == 1.80


def test_closed_trade_missing_exit_price_rejected(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="err_trader@tradepilot.io",
            username="err_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # Attempt to mark as CLOSED without exit_price
    invalid_payload = {
        "symbol": "ES",
        "side": "SHORT",
        "status": "CLOSED",
        "quantity": "1.0",
        "entry_price": "5800.00",
        "exit_price": None,
    }
    resp = client.post(
        "/api/v1/trades/",
        json=invalid_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_trade_status_transition_to_closed(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="update_journal@tradepilot.io",
            username="update_journal",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # Create OPEN trade
    resp = client.post(
        "/api/v1/trades/",
        json={
            "symbol": "BTCUSDT",
            "side": "SHORT",
            "status": "OPEN",
            "quantity": "0.5",
            "entry_price": "60000.00",
            "stop_loss": "61000.00",
            "fees": "12.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    trade_id = resp.json()["id"]

    # Update to CLOSED with exit_price
    # Short: Entry 60,000, Exit 58,000, Qty 0.5. Gross = (60k - 58k) * 0.5 = $1,000.
    # Net = 1,000 - 12 = $988.00.
    update_resp = client.put(
        f"/api/v1/trades/{trade_id}",
        json={
            "status": "CLOSED",
            "exit_price": "58000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == status.HTTP_200_OK
    data = update_resp.json()
    assert data["status"] == "CLOSED"
    assert float(data["realized_pnl"]) == 988.0


def test_delete_trade_and_confirm(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="del_trader@tradepilot.io",
            username="del_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    resp = client.post(
        "/api/v1/trades/",
        json={
            "symbol": "AMD",
            "side": "LONG",
            "quantity": "50.0",
            "entry_price": "140.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    trade_id = resp.json()["id"]

    # Delete trade
    del_resp = client.delete(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    # Verify 404 on subsequent get
    get_resp = client.get(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_trade_filtering_and_cross_user_isolation(client, db_session):
    # User 1
    u1 = create_user(
        db_session,
        UserCreate(
            email="u1_trader@tradepilot.io",
            username="u1_trader",
            password="SecurePassword123!",
        ),
    )
    t1 = create_access_token(subject=u1.id)

    # User 2
    u2 = create_user(
        db_session,
        UserCreate(
            email="u2_trader@tradepilot.io",
            username="u2_trader",
            password="SecurePassword123!",
        ),
    )
    t2 = create_access_token(subject=u2.id)

    # User 1 creates 2 trades (one NQ, one AAPL)
    client.post(
        "/api/v1/trades/",
        json={"symbol": "NQ", "side": "LONG", "quantity": "1.0", "entry_price": "21000.00", "status": "OPEN"},
        headers={"Authorization": f"Bearer {t1}"},
    )
    client.post(
        "/api/v1/trades/",
        json={"symbol": "AAPL", "side": "LONG", "quantity": "10.0", "entry_price": "220.00", "status": "CLOSED", "exit_price": "225.00"},
        headers={"Authorization": f"Bearer {t1}"},
    )

    # User 2 creates 1 trade
    resp_u2 = client.post(
        "/api/v1/trades/",
        json={"symbol": "BTC", "side": "SHORT", "quantity": "1.0", "entry_price": "60000.00", "status": "OPEN"},
        headers={"Authorization": f"Bearer {t2}"},
    )
    u2_trade_id = resp_u2.json()["id"]

    # 1. Filter by symbol for User 1
    filter_resp = client.get(
        "/api/v1/trades/?symbol=NQ",
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert filter_resp.status_code == status.HTTP_200_OK
    items = filter_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["symbol"] == "NQ"

    # 2. Filter by status for User 1
    status_resp = client.get(
        "/api/v1/trades/?status=CLOSED",
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert status_resp.status_code == status.HTTP_200_OK
    assert len(status_resp.json()["items"]) == 1
    assert status_resp.json()["items"][0]["symbol"] == "AAPL"

    # 3. Cross-user isolation: User 1 cannot access User 2's trade
    cross_resp = client.get(
        f"/api/v1/trades/{u2_trade_id}",
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert cross_resp.status_code == status.HTTP_404_NOT_FOUND

    # 4. Cross-user isolation: User 1 cannot delete User 2's trade
    cross_del = client.delete(
        f"/api/v1/trades/{u2_trade_id}",
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert cross_del.status_code == status.HTTP_404_NOT_FOUND
