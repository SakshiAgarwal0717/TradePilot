from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import Trade, TradeStatus, RiskEvaluation, EvaluationOutcome


class EquityPoint(BaseModel):
    trade_id: int
    symbol: str
    exit_time: datetime
    pnl: Decimal
    cumulative_pnl: Decimal
    running_peak: Decimal
    drawdown: Decimal
    drawdown_pct: Decimal


class AnalyticsSummary(BaseModel):
    # Counts
    total_trades: int
    closed_trades: int
    open_trades: int
    draft_trades: int
    winning_trades: int
    losing_trades: int
    breakeven_trades: int

    # Performance
    win_rate_pct: Optional[Decimal] = None
    gross_profit: Decimal
    gross_loss: Decimal
    total_fees: Decimal
    net_realized_pnl: Decimal

    # Averages
    avg_win: Optional[Decimal] = None
    avg_loss: Optional[Decimal] = None
    profit_factor: Optional[Decimal] = None
    avg_reward_to_risk: Optional[Decimal] = None

    # Drawdown
    max_drawdown_amount: Decimal
    max_drawdown_pct: Decimal

    # Gatekeeper Governance
    total_evaluations: int
    approved_evaluations: int
    rejected_evaluations: int
    warning_evaluations: int
    violation_rate_pct: Optional[Decimal] = None

    # Series
    equity_curve: List[EquityPoint]


def calculate_analytics(
    db: Session,
    user_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> AnalyticsSummary:
    """Calculates all authoritative quantitative metrics strictly from persisted journal records.

    DEFINITIONS & RULES:
    1. Scope: Scoped to user_id and optionally filtered by entry_time / exit_time within [start_date, end_date].
    2. Realized vs Open: Only CLOSED trades are included in realized metrics (P&L, win-rate, drawdown).
       Open and Draft trades are strictly counted but excluded from realized P&L denominators.
    3. Breakeven Treatment: A trade with realized_pnl == 0.00 is classified as 'breakeven'.
       Win Rate = winning_trades / (winning_trades + losing_trades + breakeven_trades) * 100
       (or None if closed_trades == 0).
    4. Fees: Net P&L already subtracts fees: net = gross - fees.
    5. Same-Day Ordering: Chronologically ordered by exit_time asc, falling back to id asc.
    6. Running Peak & Drawdown:
       Running peak is the cumulative net P&L high-water mark starting from 0.
       Drawdown amount = peak - cumulative_pnl.
       Drawdown % = (drawdown / (peak + base_account_starting_offset)) if applicable,
       or strictly from peak-to-trough in cumulative currency.
    7. Zero-Division Safety: Whenever denominators are 0 (e.g., losing_trades == 0),
       corresponding metrics (profit_factor, avg_loss) are returned as None (showing unavailable).
    """
    # 1. Total counts for all trades
    all_trades_query = db.query(Trade).filter(Trade.user_id == user_id)
    if start_date:
        all_trades_query = all_trades_query.filter(Trade.entry_time >= start_date)
    if end_date:
        all_trades_query = all_trades_query.filter(Trade.entry_time <= end_date)

    all_trades = all_trades_query.all()
    total_trades = len(all_trades)
    open_trades = sum(1 for t in all_trades if t.status == TradeStatus.OPEN)
    draft_trades = sum(1 for t in all_trades if t.status in (TradeStatus.DRAFT, TradeStatus.PLANNED))

    # 2. Closed trades query ordered deterministically
    closed_trades_query = (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status == TradeStatus.CLOSED)
    )
    if start_date:
        closed_trades_query = closed_trades_query.filter(
            func.coalesce(Trade.exit_time, Trade.entry_time) >= start_date
        )
    if end_date:
        closed_trades_query = closed_trades_query.filter(
            func.coalesce(Trade.exit_time, Trade.entry_time) <= end_date
        )

    # Deterministic chronological order: exit_time asc, then trade id asc
    closed_trades_list = (
        closed_trades_query
        .order_by(func.coalesce(Trade.exit_time, Trade.entry_time).asc(), Trade.id.asc())
        .all()
    )
    closed_trades = len(closed_trades_list)

    # 3. Aggregate realized calculations
    winning_trades = 0
    losing_trades = 0
    breakeven_trades = 0

    gross_profit = Decimal("0")
    gross_loss = Decimal("0")
    total_fees = Decimal("0")
    net_realized_pnl = Decimal("0")

    r_multiples: List[Decimal] = []

    # Equity Curve Construction
    equity_curve: List[EquityPoint] = []
    cumulative_pnl = Decimal("0")
    running_peak = Decimal("0")
    max_drawdown_amount = Decimal("0")
    max_drawdown_pct = Decimal("0")

    for t in closed_trades_list:
        pnl = t.realized_pnl if t.realized_pnl is not None else Decimal("0")
        fee = t.fees if t.fees is not None else Decimal("0")
        total_fees += fee
        net_realized_pnl += pnl

        if pnl > Decimal("0"):
            winning_trades += 1
            gross_profit += pnl
        elif pnl < Decimal("0"):
            losing_trades += 1
            gross_loss += abs(pnl)
        else:
            breakeven_trades += 1

        if t.r_multiple is not None:
            r_multiples.append(t.r_multiple)

        # Equity point computation
        cumulative_pnl += pnl
        if cumulative_pnl > running_peak:
            running_peak = cumulative_pnl

        dd_amount = running_peak - cumulative_pnl
        if dd_amount > max_drawdown_amount:
            max_drawdown_amount = dd_amount

        dd_pct = (dd_amount / running_peak * Decimal("100")).quantize(Decimal("0.01")) if running_peak > Decimal("0") else Decimal("0")
        if dd_pct > max_drawdown_pct:
            max_drawdown_pct = dd_pct

        exit_dt = t.exit_time or t.entry_time
        equity_curve.append(
            EquityPoint(
                trade_id=t.id,
                symbol=t.symbol,
                exit_time=exit_dt,
                pnl=pnl,
                cumulative_pnl=cumulative_pnl,
                running_peak=running_peak,
                drawdown=dd_amount,
                drawdown_pct=dd_pct,
            )
        )

    # Win rate
    win_rate_pct = None
    if closed_trades > 0:
        win_rate_pct = ((Decimal(winning_trades) / Decimal(closed_trades)) * Decimal("100")).quantize(Decimal("0.01"))

    # Averages
    avg_win = None
    if winning_trades > 0:
        avg_win = (gross_profit / Decimal(winning_trades)).quantize(Decimal("0.01"))

    avg_loss = None
    if losing_trades > 0:
        avg_loss = (gross_loss / Decimal(losing_trades)).quantize(Decimal("0.01"))

    profit_factor = None
    if gross_loss > Decimal("0"):
        profit_factor = (gross_profit / gross_loss).quantize(Decimal("0.01"))
    elif gross_profit > Decimal("0") and gross_loss == Decimal("0"):
        # Infinite profit factor when no losses: None or documented representation
        profit_factor = None

    avg_reward_to_risk = None
    if len(r_multiples) > 0:
        avg_reward_to_risk = (sum(r_multiples) / Decimal(len(r_multiples))).quantize(Decimal("0.01"))

    # 4. Risk Gatekeeper Evaluation Governance Stats
    eval_query = db.query(RiskEvaluation).filter(RiskEvaluation.user_id == user_id)
    if start_date:
        eval_query = eval_query.filter(RiskEvaluation.evaluated_at >= start_date)
    if end_date:
        eval_query = eval_query.filter(RiskEvaluation.evaluated_at <= end_date)

    eval_list = eval_query.all()
    total_evaluations = len(eval_list)
    approved_evaluations = sum(1 for e in eval_list if e.outcome == EvaluationOutcome.APPROVED)
    rejected_evaluations = sum(1 for e in eval_list if e.outcome == EvaluationOutcome.REJECTED)
    warning_evaluations = sum(1 for e in eval_list if e.outcome == EvaluationOutcome.WARNING)

    violation_rate_pct = None
    if total_evaluations > 0:
        # Rule violations include REJECTED and WARNING outcomes
        violations = rejected_evaluations + warning_evaluations
        violation_rate_pct = ((Decimal(violations) / Decimal(total_evaluations)) * Decimal("100")).quantize(Decimal("0.01"))

    return AnalyticsSummary(
        total_trades=total_trades,
        closed_trades=closed_trades,
        open_trades=open_trades,
        draft_trades=draft_trades,
        winning_trades=winning_trades,
        losing_trades=losing_trades,
        breakeven_trades=breakeven_trades,
        win_rate_pct=win_rate_pct,
        gross_profit=gross_profit,
        gross_loss=gross_loss,
        total_fees=total_fees,
        net_realized_pnl=net_realized_pnl,
        avg_win=avg_win,
        avg_loss=avg_loss,
        profit_factor=profit_factor,
        avg_reward_to_risk=avg_reward_to_risk,
        max_drawdown_amount=max_drawdown_amount,
        max_drawdown_pct=max_drawdown_pct,
        total_evaluations=total_evaluations,
        approved_evaluations=approved_evaluations,
        rejected_evaluations=rejected_evaluations,
        warning_evaluations=warning_evaluations,
        violation_rate_pct=violation_rate_pct,
        equity_curve=equity_curve,
    )
