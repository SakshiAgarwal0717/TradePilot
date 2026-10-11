"""End-to-End User Journey Integration Test for TradePilot.

Validates the full user journey:
1. Registration & Authentication -> receive token & cookie.
2. Risk Gatekeeper Evaluation -> deterministic sizing & rule check.
3. Persistence of Approved Trade -> records into user's Journal.
4. Open Trade Lifecycle -> update to CLOSED with exit price and fees.
5. Trading Analytics -> authoritative verification of realized P&L, win rate, and equity curve.
6. User Isolation -> verify that another trader sees 0 records and cannot view this trade.
"""
from decimal import Decimal
import pytest
from fastapi import status


def test_full_user_journey_end_to_end(client):
    # -------------------------------------------------------------
    # 1. Registration & Authentication
    # -------------------------------------------------------------
    register_payload = {
        "email": "e2e_trader@tradepilot.io",
        "username": "e2e_trader",
        "password": "SecurePassword123!",
    }
    reg_resp = client.post("/api/v1/auth/register", json=register_payload)
    assert reg_resp.status_code == status.HTTP_201_CREATED
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    token = reg_data["access_token"]
    user_id = reg_data["user"]["id"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Verify session via /auth/me
    me_resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_resp.status_code == status.HTTP_200_OK
    assert me_resp.json()["id"] == user_id
    assert "hashed_password" not in me_resp.json()

    # -------------------------------------------------------------
    # 2. Risk Gatekeeper Evaluation
    # -------------------------------------------------------------
    # Account equity: $100,000, Risk: 1.0% ($1,000 budget)
    # Long NQ: Entry 21000, Stop 20950 ($50 per unit risk), Target 21150 ($150 reward, R:R = 3.0)
    # Recommended quantity: 1,000 / 50 = 20 units
    gk_payload = {
        "account_equity": "100000.00",
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
    gk_resp = client.post("/api/v1/gatekeeper/evaluate", json=gk_payload, headers=auth_headers)
    assert gk_resp.status_code == status.HTTP_200_OK
    gk_data = gk_resp.json()
    assert gk_data["outcome"] == "APPROVED"
    assert Decimal(str(gk_data["risk_budget"])) == Decimal("1000.000000")
    assert Decimal(str(gk_data["recommended_quantity"])) == Decimal("20.0000")
    assert Decimal(str(gk_data["reward_to_risk_ratio"])) == Decimal("3.00")
    eval_id = gk_data["evaluation_id"]
    assert eval_id is not None

    # -------------------------------------------------------------
    # 3. Journal Persistence of Approved Trade
    # -------------------------------------------------------------
    trade_payload = {
        "symbol": "NQ",
        "side": "LONG",
        "status": "OPEN",
        "quantity": str(gk_data["recommended_quantity"]),
        "entry_price": "21000.00",
        "stop_loss": "20950.00",
        "take_profit": "21150.00",
        "fees": "10.00",
        "notes": "E2E journey trade execution",
    }
    trade_create_resp = client.post(
        f"/api/v1/trades/?evaluation_id={eval_id}",
        json=trade_payload,
        headers=auth_headers,
    )
    assert trade_create_resp.status_code == status.HTTP_201_CREATED
    trade_data = trade_create_resp.json()
    trade_id = trade_data["id"]
    assert trade_data["symbol"] == "NQ"
    assert trade_data["status"] == "OPEN"
    assert trade_data["realized_pnl"] is None  # Open trade has no realized P&L

    # Verify journal list contains this trade
    journal_resp = client.get("/api/v1/trades/", headers=auth_headers)
    assert journal_resp.status_code == status.HTTP_200_OK
    journal_items = journal_resp.json()["items"]
    assert len(journal_items) == 1
    assert journal_items[0]["id"] == trade_id

    # -------------------------------------------------------------
    # 4. Open Trade Closure & Realized Outcome
    # -------------------------------------------------------------
    # Target hit: Exit price = 21100.
    # Realized P&L = (21100 - 21000) * 20 - 10 = 2000 - 10 = $1,990.00
    update_payload = {
        "status": "CLOSED",
        "exit_price": "21100.00",
        "exit_time": "2026-10-11T12:00:00Z",
    }
    close_resp = client.put(f"/api/v1/trades/{trade_id}", json=update_payload, headers=auth_headers)
    assert close_resp.status_code == status.HTTP_200_OK
    closed_data = close_resp.json()
    assert closed_data["status"] == "CLOSED"
    assert Decimal(str(closed_data["realized_pnl"])) == Decimal("1990.00")
    assert Decimal(str(closed_data["r_multiple"])) > Decimal("1.9")

    # -------------------------------------------------------------
    # 5. Trading Analytics Verification
    # -------------------------------------------------------------
    analytics_resp = client.get("/api/v1/analytics/summary", headers=auth_headers)
    assert analytics_resp.status_code == status.HTTP_200_OK
    metrics = analytics_resp.json()
    assert metrics["closed_trades"] == 1
    assert metrics["winning_trades"] == 1
    assert metrics["losing_trades"] == 0
    assert Decimal(str(metrics["win_rate_pct"])) == Decimal("100.00")
    assert Decimal(str(metrics["net_realized_pnl"])) == Decimal("1990.00")
    assert len(metrics["equity_curve"]) == 1
    assert Decimal(str(metrics["equity_curve"][0]["cumulative_pnl"])) == Decimal("1990.00")

    # -------------------------------------------------------------
    # 6. User Isolation Check
    # -------------------------------------------------------------
    # Register an independent second trader
    reg_b_resp = client.post("/api/v1/auth/register", json={
        "email": "isolated_second_trader@tradepilot.io",
        "username": "second_trader",
        "password": "SecurePassword123!",
    })
    token_b = reg_b_resp.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Second trader must see empty journal and empty analytics
    journal_b = client.get("/api/v1/trades/", headers=headers_b).json()
    assert journal_b["total"] == 0
    assert len(journal_b["items"]) == 0

    analytics_b = client.get("/api/v1/analytics/summary", headers=headers_b).json()
    assert analytics_b["closed_trades"] == 0
    assert analytics_b["win_rate_pct"] is None
    assert Decimal(str(analytics_b["net_realized_pnl"])) == Decimal("0")

    # Second trader cannot read or modify the first trader's trade
    cross_read = client.get(f"/api/v1/trades/{trade_id}", headers=headers_b)
    assert cross_read.status_code == status.HTTP_404_NOT_FOUND
