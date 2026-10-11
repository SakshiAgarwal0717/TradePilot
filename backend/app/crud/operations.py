from typing import Optional
from sqlalchemy.orm import Session
from app.models.entities import User, RiskSettings, Trade, RiskEvaluation
from app.schemas.entities import (
    UserCreate,
    RiskSettingsCreate,
    RiskSettingsUpdate,
    TradeCreate,
    RiskEvaluationCreate,
)
from app.core.security import get_password_hash


# ==========================================
# User CRUD
# ==========================================
def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    from app.core.security import verify_password
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(db: Session, user_in: UserCreate) -> User:
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=hashed_password,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Automatically initialize default risk settings for user
    default_settings = RiskSettings(user_id=db_user.id)
    db.add(default_settings)
    db.commit()
    db.refresh(db_user)

    return db_user


# ==========================================
# RiskSettings CRUD
# ==========================================
def get_risk_settings_by_user_id(db: Session, user_id: int) -> Optional[RiskSettings]:
    return db.query(RiskSettings).filter(RiskSettings.user_id == user_id).first()


def create_risk_settings(db: Session, user_id: int, settings_in: RiskSettingsCreate) -> RiskSettings:
    db_settings = RiskSettings(
        user_id=user_id,
        max_risk_per_trade_pct=settings_in.max_risk_per_trade_pct,
        max_daily_loss_pct=settings_in.max_daily_loss_pct,
        max_open_positions=settings_in.max_open_positions,
        enforce_mandatory_stop_loss=settings_in.enforce_mandatory_stop_loss,
        base_currency=settings_in.base_currency,
    )
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings


def update_risk_settings(db: Session, current_settings: RiskSettings, settings_in: RiskSettingsUpdate) -> RiskSettings:
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_settings, field, value)
    db.add(current_settings)
    db.commit()
    db.refresh(current_settings)
    return current_settings


# ==========================================
# Trade CRUD
# ==========================================
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from app.schemas.entities import TradeUpdate, TradeStatus, TradeSide


def calculate_trade_metrics(
    side: TradeSide,
    entry_price: Decimal,
    exit_price: Optional[Decimal],
    quantity: Decimal,
    fees: Decimal,
    stop_loss: Optional[Decimal],
) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """Calculates realized net P&L and R-multiple consistently.
    Net P&L = (gross P&L) - fees.
    Gross P&L for LONG = (exit - entry) * quantity.
    Gross P&L for SHORT = (entry - exit) * quantity.
    R-Multiple = Net P&L / Initial Planned Risk (if stop loss was defined and valid).
    """
    if exit_price is None:
        return None, None

    if side == TradeSide.LONG:
        gross_pnl = (exit_price - entry_price) * quantity
    else:  # SHORT
        gross_pnl = (entry_price - exit_price) * quantity

    realized_pnl = (gross_pnl - fees).quantize(Decimal("0.000001"))

    r_multiple = None
    if stop_loss is not None and stop_loss > Decimal("0"):
        if side == TradeSide.LONG:
            risk_per_unit = entry_price - stop_loss
        else:
            risk_per_unit = stop_loss - entry_price

        if risk_per_unit > Decimal("0"):
            initial_risk = risk_per_unit * quantity
            if initial_risk > Decimal("0"):
                r_multiple = (realized_pnl / initial_risk).quantize(Decimal("0.01"))

    return realized_pnl, r_multiple


def get_trade_by_id_and_user(db: Session, trade_id: int, user_id: int) -> Optional[Trade]:
    return db.query(Trade).filter(Trade.id == trade_id, Trade.user_id == user_id).first()


def create_trade(db: Session, user_id: int, trade_in: TradeCreate) -> Trade:
    trade_data = trade_in.model_dump(exclude_unset=True)
    if "fees" not in trade_data or trade_data["fees"] is None:
        trade_data["fees"] = Decimal("0")

    status = trade_data.get("status", TradeStatus.OPEN)
    if status == TradeStatus.CLOSED and trade_data.get("exit_price") is not None:
        realized_pnl, r_multiple = calculate_trade_metrics(
            side=trade_data["side"],
            entry_price=trade_data["entry_price"],
            exit_price=trade_data["exit_price"],
            quantity=trade_data["quantity"],
            fees=trade_data["fees"],
            stop_loss=trade_data.get("stop_loss"),
        )
        trade_data["realized_pnl"] = realized_pnl
        trade_data["r_multiple"] = r_multiple
        if not trade_data.get("exit_time"):
            trade_data["exit_time"] = datetime.now(timezone.utc)
    else:
        # Open or Draft trades have no realized P&L
        trade_data["realized_pnl"] = None
        trade_data["r_multiple"] = None

    db_trade = Trade(user_id=user_id, **trade_data)
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade


def update_trade(db: Session, current_trade: Trade, trade_in: TradeUpdate) -> Trade:
    update_data = trade_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_trade, field, value)

    # Re-evaluate realized metrics if trade is CLOSED
    if current_trade.status == TradeStatus.CLOSED and current_trade.exit_price is not None:
        realized_pnl, r_multiple = calculate_trade_metrics(
            side=current_trade.side,
            entry_price=current_trade.entry_price,
            exit_price=current_trade.exit_price,
            quantity=current_trade.quantity,
            fees=current_trade.fees or Decimal("0"),
            stop_loss=current_trade.stop_loss,
        )
        current_trade.realized_pnl = realized_pnl
        current_trade.r_multiple = r_multiple
        if not current_trade.exit_time:
            current_trade.exit_time = datetime.now(timezone.utc)
    elif current_trade.status in (TradeStatus.OPEN, TradeStatus.DRAFT, TradeStatus.PLANNED):
        current_trade.realized_pnl = None
        current_trade.r_multiple = None
        current_trade.exit_price = None
        current_trade.exit_time = None

    db.add(current_trade)
    db.commit()
    db.refresh(current_trade)
    return current_trade


def delete_trade(db: Session, current_trade: Trade) -> None:
    db.delete(current_trade)
    db.commit()


def get_trades_by_user_id(
    db: Session,
    user_id: int,
    status: Optional[TradeStatus] = None,
    side: Optional[TradeSide] = None,
    symbol: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_by: str = "entry_time",
    sort_desc: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[Trade], int]:
    query = db.query(Trade).filter(Trade.user_id == user_id)

    if status:
        query = query.filter(Trade.status == status)
    if side:
        query = query.filter(Trade.side == side)
    if symbol:
        query = query.filter(Trade.symbol.ilike(f"%{symbol}%"))
    if start_date:
        query = query.filter(Trade.entry_time >= start_date)
    if end_date:
        query = query.filter(Trade.entry_time <= end_date)

    total_count = query.count()

    sort_column = getattr(Trade, sort_by, Trade.entry_time)
    if sort_desc:
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    trades = query.offset(skip).limit(limit).all()
    return trades, total_count


# ==========================================
# RiskEvaluation CRUD
# ==========================================
def create_risk_evaluation(db: Session, user_id: int, eval_in: RiskEvaluationCreate) -> RiskEvaluation:
    eval_data = eval_in.model_dump(exclude_unset=True)
    db_eval = RiskEvaluation(user_id=user_id, **eval_data)
    db.add(db_eval)
    db.commit()
    db.refresh(db_eval)
    return db_eval


def get_risk_evaluations_by_user_id(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(RiskEvaluation)
        .filter(RiskEvaluation.user_id == user_id)
        .order_by(RiskEvaluation.evaluated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
