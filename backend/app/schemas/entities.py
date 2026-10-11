from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.entities import TradeSide, TradeStatus, EvaluationOutcome


import re
from pydantic import field_validator


# ==========================================
# User Schemas
# ==========================================
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128, description="Raw password, hashed before storage")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead



# ==========================================
# RiskSettings Schemas
# ==========================================
class RiskSettingsBase(BaseModel):
    max_risk_per_trade_pct: Decimal = Field(
        default=Decimal("1.00"),
        ge=Decimal("0.01"),
        le=Decimal("100.00"),
        description="Maximum percentage of portfolio equity risked on a single trade",
    )
    max_daily_loss_pct: Decimal = Field(
        default=Decimal("2.00"),
        ge=Decimal("0.01"),
        le=Decimal("100.00"),
        description="Maximum cumulative daily drawdown percentage before lockout",
    )
    max_open_positions: int = Field(
        default=3,
        ge=1,
        le=50,
        description="Maximum simultaneous open positions allowed",
    )
    enforce_mandatory_stop_loss: bool = Field(
        default=True,
        description="Whether Gatekeeper strictly requires a numeric stop loss price",
    )
    base_currency: str = Field(
        default="USD",
        min_length=3,
        max_length=5,
        description="Base account currency code (e.g. USD, EUR)",
    )


class RiskSettingsCreate(RiskSettingsBase):
    pass


class RiskSettingsUpdate(BaseModel):
    max_risk_per_trade_pct: Optional[Decimal] = Field(None, ge=Decimal("0.01"), le=Decimal("100.00"))
    max_daily_loss_pct: Optional[Decimal] = Field(None, ge=Decimal("0.01"), le=Decimal("100.00"))
    max_open_positions: Optional[int] = Field(None, ge=1, le=50)
    enforce_mandatory_stop_loss: Optional[bool] = None
    base_currency: Optional[str] = Field(None, min_length=3, max_length=5)


class RiskSettingsRead(RiskSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Trade Schemas
# ==========================================
class TradeBase(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    side: TradeSide
    status: TradeStatus = TradeStatus.OPEN
    quantity: Decimal = Field(gt=Decimal("0"))
    entry_price: Decimal = Field(gt=Decimal("0"))
    exit_price: Optional[Decimal] = Field(None, gt=Decimal("0"))
    stop_loss: Optional[Decimal] = Field(None, gt=Decimal("0"))
    take_profit: Optional[Decimal] = Field(None, gt=Decimal("0"))
    fees: Decimal = Field(default=Decimal("0"), ge=Decimal("0"), description="Transaction fees and commissions")
    realized_pnl: Optional[Decimal] = None
    r_multiple: Optional[Decimal] = None
    notes: Optional[str] = None
    strategy_tag: Optional[str] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    symbol: Optional[str] = Field(None, min_length=1, max_length=20)
    side: Optional[TradeSide] = None
    status: Optional[TradeStatus] = None
    quantity: Optional[Decimal] = Field(None, gt=Decimal("0"))
    entry_price: Optional[Decimal] = Field(None, gt=Decimal("0"))
    exit_price: Optional[Decimal] = Field(None, gt=Decimal("0"))
    stop_loss: Optional[Decimal] = Field(None, gt=Decimal("0"))
    take_profit: Optional[Decimal] = Field(None, gt=Decimal("0"))
    fees: Optional[Decimal] = Field(None, ge=Decimal("0"))
    notes: Optional[str] = None
    strategy_tag: Optional[str] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None


class TradeRead(TradeBase):
    id: int
    user_id: int
    entry_time: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RiskEvaluation Schemas
# ==========================================
class EvaluateTradeRequest(BaseModel):
    account_equity: Decimal = Field(gt=Decimal("0"), description="Account equity in base currency")
    risk_percentage: Decimal = Field(gt=Decimal("0"), le=Decimal("100"), description="Risk % per trade")
    symbol: str = Field(min_length=1, max_length=20)
    side: TradeSide
    entry_price: Decimal = Field(gt=Decimal("0"))
    stop_loss: Decimal = Field(gt=Decimal("0"))
    target_price: Optional[Decimal] = Field(None, gt=Decimal("0"))
    quantity_increment: Optional[Decimal] = Field(None, gt=Decimal("0"), description="Lot size / contract increment")
    min_reward_risk_ratio: Optional[Decimal] = Field(default=Decimal("1.5"), ge=Decimal("0.1"))
    current_daily_losses: Optional[Decimal] = Field(default=Decimal("0"), ge=Decimal("0"))
    save_evaluation: bool = Field(default=True, description="Whether to persist evaluation to audit log")


class RiskEvaluationBase(BaseModel):
    outcome: EvaluationOutcome
    rules_checked: str  # JSON formatted rule names
    violation_details: Optional[str] = None
    evaluated_risk_amount: Optional[Decimal] = None
    evaluated_risk_pct: Optional[Decimal] = None


class RiskEvaluationCreate(RiskEvaluationBase):
    trade_id: Optional[int] = None


class RiskEvaluationRead(RiskEvaluationBase):
    id: int
    user_id: int
    trade_id: Optional[int]
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluateTradeResponse(BaseModel):
    evaluation_id: Optional[int] = None
    outcome: EvaluationOutcome
    account_equity: Decimal
    risk_budget: Decimal
    risk_percentage: Decimal
    per_unit_risk: Decimal
    raw_quantity: Decimal
    recommended_quantity: Decimal
    projected_loss: Decimal
    reward_to_risk_ratio: Optional[Decimal] = None
    target_distance: Optional[Decimal] = None
    stop_distance: Decimal
    rules: List[dict]
    summary: str
