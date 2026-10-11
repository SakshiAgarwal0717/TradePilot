from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from fastapi import status
from app.crud.operations import create_user
from app.schemas.entities import UserCreate
from app.core.security import create_access_token
from app.models.entities import RiskEvaluation, EvaluationOutcome, TradeSide, TradeStatus, Trade


def test_analytics_empty_journal(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="empty_analytics@tradepilot.io",
            username="empty_analytics",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    resp = client.get(
        "/api/v1/analytics/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["total_trades"] == 0
    assert data["closed_trades"] == 0
    assert data["open_trades"] == 0
    assert data["winning_trades"] == 0
    assert data["losing_trades"] == 0
    assert data["breakeven_trades"] == 0
    assert data["win_rate_pct"] is None
    assert Decimal(str(data["net_realized_pnl"])) == Decimal("0")
    assert Decimal(str(data["gross_profit"])) == Decimal("0")
    assert Decimal(str(data["gross_loss"])) == Decimal("0")
    assert data["avg_win"] is None
    assert data["avg_loss"] is None
    assert data["profit_factor"] is None
    assert data["avg_reward_to_risk"] is None
    assert Decimal(str(data["max_drawdown_amount"])) == Decimal("0")
    assert data["equity_curve"] == []


def test_analytics_all_wins(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="winner_trader@tradepilot.io",
            username="winner_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # Trade 1: Long, entry 100, exit 110, qty 10, fee 5 => realized = (110 - 100)*10 - 5 = 95
    t1_payload = {
        "symbol": "AAPL",
        "side": "LONG",
        "status": "CLOSED",
        "quantity": "10.0",
        "entry_price": "100.00",
        "stop_loss": "95.00",
        "take_profit": "115.00",
        "exit_price": "110.00",
        "fees": "5.00",
    }
    # Trade 2: Long, entry 100, exit 105, qty 10, fee 0 => realized = (105 - 100)*10 - 0 = 50
    t2_payload = {
        "symbol": "MSFT",
        "side": "LONG",
        "status": "CLOSED",
        "quantity": "10.0",
        "entry_price": "100.00",
        "stop_loss": "90.00",
        "take_profit": "110.00",
        "exit_price": "105.00",
        "fees": "0.00",
    }

    resp1 = client.post("/api/v1/trades/", json=t1_payload, headers={"Authorization": f"Bearer {token}"})
    assert resp1.status_code == status.HTTP_201_CREATED
    resp2 = client.post("/api/v1/trades/", json=t2_payload, headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == status.HTTP_201_CREATED

    resp = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()

    assert data["total_trades"] == 2
    assert data["closed_trades"] == 2
    assert data["winning_trades"] == 2
    assert data["losing_trades"] == 0
    assert Decimal(str(data["win_rate_pct"])) == Decimal("100.00")
    assert Decimal(str(data["net_realized_pnl"])) == Decimal("145.00")
    assert Decimal(str(data["total_fees"])) == Decimal("5.00")
    assert data["profit_factor"] is None  # no loss => division by zero avoided
    assert Decimal(str(data["max_drawdown_amount"])) == Decimal("0")
    assert len(data["equity_curve"]) == 2
    assert Decimal(str(data["equity_curve"][0]["cumulative_pnl"])) == Decimal("95.00")
    assert Decimal(str(data["equity_curve"][1]["cumulative_pnl"])) == Decimal("145.00")


def test_analytics_mixed_trades_drawdown_and_open_isolation(client, db_session):
    user = create_user(
        db_session,
        UserCreate(
            email="mixed_trader@tradepilot.io",
            username="mixed_trader",
            password="SecurePassword123!",
        ),
    )
    token = create_access_token(subject=user.id)

    # 1. Closed Win: entry 100, exit 120, qty 10, fees 0 => pnl = +200
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "NVDA",
            "side": "LONG",
            "status": "CLOSED",
            "quantity": "10.0",
            "entry_price": "100.00",
            "stop_loss": "90.00",
            "take_profit": "130.00",
            "exit_price": "120.00",
            "fees": "0.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. Closed Loss: entry 100, exit 90, qty 10, fees 10 => pnl = -100 - 10 = -110
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "AMD",
            "side": "LONG",
            "status": "CLOSED",
            "quantity": "10.0",
            "entry_price": "100.00",
            "stop_loss": "90.00",
            "take_profit": "120.00",
            "exit_price": "90.00",
            "fees": "10.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 3. Closed Breakeven: entry 100, exit 101, qty 10, fees 10 => gross 10 - 10 = 0
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "TSLA",
            "side": "LONG",
            "status": "CLOSED",
            "quantity": "10.0",
            "entry_price": "100.00",
            "stop_loss": "95.00",
            "take_profit": "110.00",
            "exit_price": "101.00",
            "fees": "10.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 4. Open Trade (must not contaminate realized P&L or win-rate)
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "SPY",
            "side": "LONG",
            "status": "OPEN",
            "quantity": "100.0",
            "entry_price": "500.00",
            "stop_loss": "495.00",
            "take_profit": "515.00",
            "fees": "2.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 5. Draft Trade
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "QQQ",
            "side": "LONG",
            "status": "DRAFT",
            "quantity": "50.0",
            "entry_price": "400.00",
            "stop_loss": "390.00",
            "take_profit": "420.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()

    assert data["total_trades"] == 5
    assert data["open_trades"] == 1
    assert data["draft_trades"] == 1
    assert data["closed_trades"] == 3
    assert data["winning_trades"] == 1
    assert data["losing_trades"] == 1
    assert data["breakeven_trades"] == 1

    # Win rate = 1 / 3 * 100 = 33.33%
    assert Decimal(str(data["win_rate_pct"])) == Decimal("33.33")

    # Net Realized = 200 - 110 + 0 = 90
    assert Decimal(str(data["net_realized_pnl"])) == Decimal("90.00")
    assert Decimal(str(data["gross_profit"])) == Decimal("200.00")
    assert Decimal(str(data["gross_loss"])) == Decimal("110.00")
    assert Decimal(str(data["total_fees"])) == Decimal("20.00")  # from closed trades (10 + 10)

    # Profit Factor = 200 / 110 = 1.82
    assert Decimal(str(data["profit_factor"])) == Decimal("1.82")

    # Drawdown check:
    # trade 1: cum = 200, peak = 200, dd = 0
    # trade 2: cum = 90, peak = 200, dd = 110
    # trade 3: cum = 90, peak = 200, dd = 110
    assert Decimal(str(data["max_drawdown_amount"])) == Decimal("110.00")
    # Drawdown % = 110 / 200 * 100 = 55.00%
    assert Decimal(str(data["max_drawdown_pct"])) == Decimal("55.00")


def test_analytics_user_isolation(client, db_session):
    user1 = create_user(
        db_session,
        UserCreate(email="user1_analytics@tradepilot.io", username="user1_analytics", password="Password123!"),
    )
    user2 = create_user(
        db_session,
        UserCreate(email="user2_analytics@tradepilot.io", username="user2_analytics", password="Password123!"),
    )
    token1 = create_access_token(subject=user1.id)
    token2 = create_access_token(subject=user2.id)

    # User 1 trade
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "BTC",
            "side": "LONG",
            "status": "CLOSED",
            "quantity": "1.0",
            "entry_price": "60000.00",
            "stop_loss": "59000.00",
            "take_profit": "63000.00",
            "exit_price": "62000.00",
            "fees": "0.00",
        },
        headers={"Authorization": f"Bearer {token1}"},
    )

    # User 2 checks analytics
    resp2 = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == status.HTTP_200_OK
    assert resp2.json()["total_trades"] == 0
    assert resp2.json()["closed_trades"] == 0
    assert resp2.json()["net_realized_pnl"] == "0"


def test_analytics_gatekeeper_governance(client, db_session):
    user = create_user(
        db_session,
        UserCreate(email="eval_analytics@tradepilot.io", username="eval_analytics", password="Password123!"),
    )
    token = create_access_token(subject=user.id)

    # Insert 2 evaluations: 1 APPROVED, 1 REJECTED
    eval1 = RiskEvaluation(
        user_id=user.id,
        outcome=EvaluationOutcome.APPROVED,
        rules_checked="[]",
        evaluated_risk_amount=Decimal("500"),
        evaluated_risk_pct=Decimal("1.0"),
    )
    eval2 = RiskEvaluation(
        user_id=user.id,
        outcome=EvaluationOutcome.REJECTED,
        rules_checked="[]",
        violation_details="[{\"rule\": \"MIN_RR\"}]",
        evaluated_risk_amount=Decimal("500"),
        evaluated_risk_pct=Decimal("1.0"),
    )
    db_session.add_all([eval1, eval2])
    db_session.commit()

    resp = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["total_evaluations"] == 2
    assert data["approved_evaluations"] == 1
    assert data["rejected_evaluations"] == 1
    assert Decimal(str(data["violation_rate_pct"])) == Decimal("50.00")


def test_analytics_unauthorized(client):
    resp = client.get("/api/v1/analytics/summary")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_analytics_date_range_filtering(client, db_session):
    user = create_user(
        db_session,
        UserCreate(email="date_trader@tradepilot.io", username="date_trader", password="Password123!"),
    )
    token = create_access_token(subject=user.id)

    # Trade in Oct 2026
    t1 = Trade(
        user_id=user.id,
        symbol="AAPL",
        side=TradeSide.LONG,
        status=TradeStatus.CLOSED,
        quantity=Decimal("10.0"),
        entry_price=Decimal("100.00"),
        exit_price=Decimal("110.00"),
        fees=Decimal("0.00"),
        realized_pnl=Decimal("100.00"),
        entry_time=datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc),
        exit_time=datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc),
    )
    # Trade in Nov 2026
    t2 = Trade(
        user_id=user.id,
        symbol="MSFT",
        side=TradeSide.LONG,
        status=TradeStatus.CLOSED,
        quantity=Decimal("10.0"),
        entry_price=Decimal("200.00"),
        exit_price=Decimal("220.00"),
        fees=Decimal("0.00"),
        realized_pnl=Decimal("200.00"),
        entry_time=datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc),
        exit_time=datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([t1, t2])
    db_session.commit()

    # Query only Oct 2026
    start_oct = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc).isoformat()
    end_oct = datetime(2026, 10, 31, 23, 59, tzinfo=timezone.utc).isoformat()
    resp_oct = client.get(
        "/api/v1/analytics/summary",
        params={"start_date": start_oct, "end_date": end_oct},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_oct.status_code == status.HTTP_200_OK
    data_oct = resp_oct.json()
    assert data_oct["closed_trades"] == 1
    assert Decimal(str(data_oct["net_realized_pnl"])) == Decimal("100.00")
    assert len(data_oct["equity_curve"]) == 1

    # Query all
    resp_all = client.get(
        "/api/v1/analytics/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_all.status_code == status.HTTP_200_OK
    data_all = resp_all.json()
    assert data_all["closed_trades"] == 2
    assert Decimal(str(data_all["net_realized_pnl"])) == Decimal("300.00")
    assert len(data_all["equity_curve"]) == 2
