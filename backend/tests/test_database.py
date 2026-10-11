from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from app.models.entities import User, RiskSettings, Trade, RiskEvaluation, TradeSide, TradeStatus, EvaluationOutcome
from app.crud.operations import create_user, get_user_by_id, get_user_by_email, create_trade, create_risk_evaluation
from app.schemas.entities import UserCreate, TradeCreate, RiskEvaluationCreate
from app.core.security import verify_password


def test_user_creation_and_password_hashing(db_session):
    user_in = UserCreate(
        email="test_trader@tradepilot.com",
        username="trader_joe",
        password="SecretPlainPassword123!",
    )
    user = create_user(db_session, user_in)

    assert user.id is not None
    assert user.email == "test_trader@tradepilot.com"
    # Never store plaintext passwords
    assert user.hashed_password != "SecretPlainPassword123!"
    assert verify_password("SecretPlainPassword123!", user.hashed_password) is True

    # Check default risk settings were auto-generated
    assert user.risk_settings is not None
    assert user.risk_settings.max_risk_per_trade_pct == Decimal("1.0000")
    assert user.risk_settings.max_daily_loss_pct == Decimal("2.0000")
    assert user.risk_settings.enforce_mandatory_stop_loss is True


def test_trade_model_foreign_key_and_decimals(db_session):
    user_in = UserCreate(
        email="fk_trader@tradepilot.com",
        username="fktrader",
        password="SecretPlainPassword123!",
    )
    user = create_user(db_session, user_in)

    trade_in = TradeCreate(
        symbol="NQ",
        side=TradeSide.LONG,
        status=TradeStatus.OPEN,
        quantity=Decimal("2.500000"),
        entry_price=Decimal("21050.250000"),
        stop_loss=Decimal("20980.000000"),
    )
    trade = create_trade(db_session, user_id=user.id, trade_in=trade_in)

    assert trade.id is not None
    assert trade.user_id == user.id
    assert trade.symbol == "NQ"
    assert trade.quantity == Decimal("2.500000")
    assert trade.entry_price == Decimal("21050.250000")
    assert trade.stop_loss == Decimal("20980.000000")


def test_sqlite_foreign_key_constraint_enforcement(db_session):
    # Attempt to insert a trade with a non-existent user_id
    invalid_trade = Trade(
        user_id=999999,  # Non-existent FK
        symbol="ES",
        side=TradeSide.SHORT,
        status=TradeStatus.OPEN,
        quantity=Decimal("1.0"),
        entry_price=Decimal("5900.0"),
    )
    db_session.add(invalid_trade)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_risk_evaluation_cascade_and_model(db_session):
    user_in = UserCreate(
        email="eval_user@tradepilot.com",
        username="evaltrader",
        password="SecretPlainPassword123!",
    )
    user = create_user(db_session, user_in)

    eval_in = RiskEvaluationCreate(
        outcome=EvaluationOutcome.APPROVED,
        rules_checked='["Rule #1 Stop Loss", "Rule #2 Max Risk Pct"]',
        evaluated_risk_pct=Decimal("0.8500"),
    )
    evaluation = create_risk_evaluation(db_session, user.id, eval_in)

    assert evaluation.id is not None
    assert evaluation.outcome == EvaluationOutcome.APPROVED
    assert evaluation.user_id == user.id
