import enum
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    Enum,
    Text,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)



class TradeSide(str, enum.Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class TradeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PLANNED = "PLANNED"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class EvaluationOutcome(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WARNING = "WARNING"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    risk_settings = relationship("RiskSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    evaluations = relationship("RiskEvaluation", back_populates="user", cascade="all, delete-orphan")


class RiskSettings(Base):
    __tablename__ = "risk_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Risk Parameters (precision=10, scale=4 for decimal safety)
    max_risk_per_trade_pct = Column(Numeric(precision=10, scale=4), default=1.0000, nullable=False)
    max_daily_loss_pct = Column(Numeric(precision=10, scale=4), default=2.0000, nullable=False)
    max_open_positions = Column(Integer, default=3, nullable=False)
    enforce_mandatory_stop_loss = Column(Boolean, default=True, nullable=False)
    base_currency = Column(String(10), default="USD", nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="risk_settings")


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    symbol = Column(String(20), nullable=False, index=True)
    side = Column(Enum(TradeSide), nullable=False)
    status = Column(Enum(TradeStatus), default=TradeStatus.OPEN, nullable=False)

    quantity = Column(Numeric(precision=18, scale=6), nullable=False)
    entry_price = Column(Numeric(precision=18, scale=6), nullable=False)
    exit_price = Column(Numeric(precision=18, scale=6), nullable=True)
    stop_loss = Column(Numeric(precision=18, scale=6), nullable=True)
    take_profit = Column(Numeric(precision=18, scale=6), nullable=True)
    fees = Column(Numeric(precision=18, scale=6), default=Decimal("0"), nullable=False)
    realized_pnl = Column(Numeric(precision=18, scale=6), nullable=True)
    r_multiple = Column(Numeric(precision=10, scale=4), nullable=True)

    notes = Column(Text, nullable=True)
    strategy_tag = Column(String(50), nullable=True)

    entry_time = Column(DateTime, default=utcnow, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="trades")
    risk_evaluation = relationship("RiskEvaluation", back_populates="trade", uselist=False)


class RiskEvaluation(Base):
    __tablename__ = "risk_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trade_id = Column(Integer, ForeignKey("trades.id", ondelete="SET NULL"), nullable=True, index=True)

    outcome = Column(Enum(EvaluationOutcome), nullable=False)
    rules_checked = Column(Text, nullable=False)  # JSON-encoded array of evaluated rules
    violation_details = Column(Text, nullable=True)  # JSON-encoded details of any triggered rules

    evaluated_risk_amount = Column(Numeric(precision=18, scale=6), nullable=True)
    evaluated_risk_pct = Column(Numeric(precision=10, scale=4), nullable=True)

    evaluated_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="evaluations")
    trade = relationship("Trade", back_populates="risk_evaluation")
