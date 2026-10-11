"""Seed repeatable, clearly labeled synthetic demo data for TradePilot.

DEVELOPMENT / EVALUATION DEMO ONLY:
These credentials and synthetic trades are strictly intended for local demonstration,
testing, and academic evaluation. They MUST NEVER be deployed to a public production
environment or used with real capital.

Demo Account:
    Email: demo_trader@tradepilot.io
    Password: DemoPassword123!
    Username: demo_trader

Populates realistic synthetic trades (closed and open) across indices and equities,
along with risk evaluation history to illustrate:
- Win rate & Profit factor
- Realized P&L calculations
- Drawdown series
- Gatekeeper compliance vs rejection stats

NOTE: All records are strictly synthetic and contain no real private financial information.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import sys

from app.db.session import SessionLocal, init_db
from app.crud.operations import (
    get_user_by_email,
    create_user,
    create_trade,
    create_risk_evaluation,
)
from app.schemas.entities import UserCreate, TradeCreate, RiskEvaluationCreate
from app.models.entities import TradeSide, TradeStatus, EvaluationOutcome, Trade, RiskEvaluation


def seed_demo_data():
    init_db()
    db = SessionLocal()

    # Local development demo credentials (NOT FOR PRODUCTION USE)
    demo_email = "demo_trader@tradepilot.io"
    demo_username = "demo_trader"
    demo_password = "DemoPassword123!"

    print(f"[*] Checking for existing demo user: {demo_email}...")
    user = get_user_by_email(db, email=demo_email)
    if user:
        print("[!] Existing demo user found. Cleaning up prior demo trades...")
        db.query(Trade).filter(Trade.user_id == user.id).delete()
        db.commit()
    else:
        print("[+] Registering new demo user account...")
        user = create_user(
            db,
            UserCreate(
                email=demo_email,
                username=demo_username,
                password=demo_password,
            ),
        )

    print(f"[+] Demo user active: ID={user.id}")

    # Baseline time anchor: 7 days ago
    now = datetime.now(timezone.utc)
    base_time = now - timedelta(days=7)

    # Synthetic trades dataset
    # 5 Closed trades: 3 wins, 2 losses (60% win rate), plus 1 open position
    synthetic_trades = [
        # Win 1: Long AAPL breakout
        {
            "symbol": "AAPL",
            "side": TradeSide.LONG,
            "status": TradeStatus.CLOSED,
            "quantity": Decimal("50.0"),
            "entry_price": Decimal("220.00"),
            "stop_loss": Decimal("216.00"),
            "take_profit": Decimal("228.00"),
            "exit_price": Decimal("227.50"),
            "fees": Decimal("3.50"),
            "realized_pnl": Decimal("371.50"),  # (227.50 - 220.00)*50 - 3.50
            "r_multiple": Decimal("1.86"),
            "notes": "[SYNTHETIC DEMO] Breakout above 50-day moving average. Exited near target.",
            "entry_offset_hours": 2,
            "exit_offset_hours": 6,
        },
        # Loss 1: Short TSLA pullback failure
        {
            "symbol": "TSLA",
            "side": TradeSide.SHORT,
            "status": TradeStatus.CLOSED,
            "quantity": Decimal("20.0"),
            "entry_price": Decimal("250.00"),
            "stop_loss": Decimal("255.00"),
            "take_profit": Decimal("240.00"),
            "exit_price": Decimal("255.00"),
            "fees": Decimal("2.00"),
            "realized_pnl": Decimal("-102.00"),  # (250 - 255)*20 - 2.00
            "r_multiple": Decimal("-1.02"),
            "notes": "[SYNTHETIC DEMO] Bearish continuation failed. Clean stop loss execution.",
            "entry_offset_hours": 24,
            "exit_offset_hours": 26,
        },
        # Win 2: Long NQ e-mini futures scalp
        {
            "symbol": "NQ",
            "side": TradeSide.LONG,
            "status": TradeStatus.CLOSED,
            "quantity": Decimal("2.0"),
            "entry_price": Decimal("20800.00"),
            "stop_loss": Decimal("20750.00"),
            "take_profit": Decimal("20920.00"),
            "exit_price": Decimal("20910.00"),
            "fees": Decimal("8.00"),
            "realized_pnl": Decimal("212.00"),  # (20910 - 20800)*2 - 8.00
            "r_multiple": Decimal("2.12"),
            "notes": "[SYNTHETIC DEMO] London open liquidity sweep. R:R satisfied.",
            "entry_offset_hours": 48,
            "exit_offset_hours": 51,
        },
        # Loss 2: Long MSFT earnings consolidation false break
        {
            "symbol": "MSFT",
            "side": TradeSide.LONG,
            "status": TradeStatus.CLOSED,
            "quantity": Decimal("25.0"),
            "entry_price": Decimal("420.00"),
            "stop_loss": Decimal("415.00"),
            "take_profit": Decimal("432.00"),
            "exit_price": Decimal("415.00"),
            "fees": Decimal("3.00"),
            "realized_pnl": Decimal("-128.00"),  # (415 - 420)*25 - 3.00
            "r_multiple": Decimal("-1.02"),
            "notes": "[SYNTHETIC DEMO] Disciplined stop out on midday selloff.",
            "entry_offset_hours": 72,
            "exit_offset_hours": 75,
        },
        # Win 3: Short NVDA gap fade
        {
            "symbol": "NVDA",
            "side": TradeSide.SHORT,
            "status": TradeStatus.CLOSED,
            "quantity": Decimal("30.0"),
            "entry_price": Decimal("135.00"),
            "stop_loss": Decimal("138.00"),
            "take_profit": Decimal("128.00"),
            "exit_price": Decimal("129.00"),
            "fees": Decimal("4.00"),
            "realized_pnl": Decimal("176.00"),  # (135 - 129)*30 - 4.00
            "r_multiple": Decimal("1.96"),
            "notes": "[SYNTHETIC DEMO] Overhead resistance reaction. Target taken off before close.",
            "entry_offset_hours": 96,
            "exit_offset_hours": 100,
        },
        # Open Trade: Long SPY swing
        {
            "symbol": "SPY",
            "side": TradeSide.LONG,
            "status": TradeStatus.OPEN,
            "quantity": Decimal("40.0"),
            "entry_price": Decimal("575.00"),
            "stop_loss": Decimal("571.00"),
            "take_profit": Decimal("585.00"),
            "exit_price": None,
            "fees": Decimal("2.50"),
            "realized_pnl": None,
            "r_multiple": None,
            "notes": "[SYNTHETIC DEMO] Active position managed with trailing stop at breakeven.",
            "entry_offset_hours": 120,
            "exit_offset_hours": None,
        },
    ]

    print("[*] Creating synthetic trades...")
    for t_data in synthetic_trades:
        entry_t = base_time + timedelta(hours=t_data["entry_offset_hours"])
        exit_t = (
            base_time + timedelta(hours=t_data["exit_offset_hours"])
            if t_data["exit_offset_hours"]
            else None
        )
        trade = Trade(
            user_id=user.id,
            symbol=t_data["symbol"],
            side=t_data["side"],
            status=t_data["status"],
            quantity=t_data["quantity"],
            entry_price=t_data["entry_price"],
            stop_loss=t_data["stop_loss"],
            take_profit=t_data["take_profit"],
            exit_price=t_data["exit_price"],
            fees=t_data["fees"],
            realized_pnl=t_data["realized_pnl"],
            r_multiple=t_data["r_multiple"],
            notes=t_data["notes"],
            entry_time=entry_t,
            exit_time=exit_t,
        )
        db.add(trade)

    # Synthetic Gatekeeper Evaluations
    eval_1 = RiskEvaluation(
        user_id=user.id,
        outcome=EvaluationOutcome.APPROVED,
        rules_checked='["Rule #1 Mandatory Stop Loss: PASS", "Rule #2 Reward-to-Risk Ratio: PASS", "Rule #3 Max Risk Pct: PASS"]',
        evaluated_risk_pct=Decimal("0.95"),
        violation_details=None,
    )
    eval_2 = RiskEvaluation(
        user_id=user.id,
        outcome=EvaluationOutcome.REJECTED,
        rules_checked='["Rule #1 Mandatory Stop Loss: FAIL - Inverted stop placement for side SHORT", "Rule #2 Reward-to-Risk: FAIL"]',
        evaluated_risk_pct=Decimal("2.40"),
        violation_details='{"reason": "Stop loss placed above short entry threshold"}',
    )
    db.add_all([eval_1, eval_2])

    db.commit()
    db.close()
    print("[+] Synthetic demo data successfully seeded.")
    print("================================================================")
    print("TradePilot Local Evaluation Demo Account (DEV ONLY)")
    print("  Email:    demo_trader@tradepilot.io")
    print("  Password: DemoPassword123!")
    print("  Notice:   Strictly synthetic data for local development/testing.")
    print("================================================================")


if __name__ == "__main__":
    seed_demo_data()
