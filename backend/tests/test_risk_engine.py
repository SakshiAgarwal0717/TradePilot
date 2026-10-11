from decimal import Decimal
import pytest
from app.models.entities import TradeSide, EvaluationOutcome
from app.services.risk_engine import evaluate_trade_risk


def test_long_trade_valid_risk_and_reward():
    # Equity $50,000, 1.0% risk -> $500 risk budget
    # Long: Entry 100, Stop 95 (distance 5), Target 115 (distance 15, R:R = 3.0)
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("95.00"),
        target_price=Decimal("115.00"),
        min_reward_risk_ratio=Decimal("2.0"),
    )
    assert res.outcome == EvaluationOutcome.APPROVED
    assert res.risk_budget == Decimal("500.000000")
    assert res.stop_distance == Decimal("5.00")
    assert res.target_distance == Decimal("15.00")
    assert res.reward_to_risk_ratio == Decimal("3.00")
    # Raw quantity = 500 / 5 = 100 shares
    assert res.recommended_quantity == Decimal("100.0000")
    assert res.projected_loss == Decimal("500.000000")


def test_short_trade_valid_risk_and_reward():
    # Equity $100,000, 0.5% risk -> $500 risk budget
    # Short: Entry 200, Stop 205 (distance 5), Target 185 (distance 15, R:R = 3.0)
    res = evaluate_trade_risk(
        account_equity=Decimal("100000"),
        risk_percentage=Decimal("0.5"),
        side=TradeSide.SHORT,
        entry_price=Decimal("200.00"),
        stop_loss=Decimal("205.00"),
        target_price=Decimal("185.00"),
        min_reward_risk_ratio=Decimal("1.5"),
    )
    assert res.outcome == EvaluationOutcome.APPROVED
    assert res.risk_budget == Decimal("500.000000")
    assert res.stop_distance == Decimal("5.00")
    assert res.target_distance == Decimal("15.00")
    assert res.reward_to_risk_ratio == Decimal("3.00")
    assert res.recommended_quantity == Decimal("100.0000")


def test_invalid_stop_loss_placement_long():
    # For a long, stop loss cannot be above entry
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("105.00"),  # INVALID!
        target_price=Decimal("120.00"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    failed_rules = [r for r in res.rules if r.status == "FAIL"]
    assert any("Directional Stop Placement" in r.rule_name for r in failed_rules)


def test_invalid_stop_loss_placement_short():
    # For a short, stop loss cannot be below entry
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.SHORT,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("95.00"),  # INVALID!
        target_price=Decimal("80.00"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    failed_rules = [r for r in res.rules if r.status == "FAIL"]
    assert any("Directional Stop Placement" in r.rule_name for r in failed_rules)


def test_zero_stop_distance_rejection():
    # Entry == Stop Loss
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("100.00"),
        target_price=Decimal("120.00"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    assert res.stop_distance == Decimal("0.00")


def test_substandard_reward_to_risk_ratio():
    # Target distance 5, Stop distance 5 -> R:R 1.0, minimum is 2.0
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("95.00"),
        target_price=Decimal("105.00"),
        min_reward_risk_ratio=Decimal("2.0"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    assert res.reward_to_risk_ratio == Decimal("1.00")
    failed_rules = [r for r in res.rules if r.status == "FAIL"]
    assert any("Reward-to-Risk Ratio" in r.rule_name for r in failed_rules)


def test_lot_size_increment_rounding():
    # Budget = $500, Stop distance = $3.00 -> Raw quantity = 166.6666
    # Contract increment = 10 -> Round down to 160 contracts
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("97.00"),
        target_price=Decimal("110.00"),
        quantity_increment=Decimal("10"),
    )
    assert res.outcome == EvaluationOutcome.APPROVED
    assert res.recommended_quantity == Decimal("160.000000")
    # Recalculated projected risk = 160 * 3 = $480.00 <= $500 budget
    assert res.projected_loss == Decimal("480.000000")
    assert res.projected_loss <= res.risk_budget


def test_lot_size_too_large_rejection():
    # Budget = $50, Stop distance = $10 -> Raw quantity = 5.
    # Minimum lot size = 10 -> Rounded down quantity = 0 -> REJECT
    res = evaluate_trade_risk(
        account_equity=Decimal("5000"),
        risk_percentage=Decimal("1.0"),  # $50 budget
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("90.00"),  # $10 stop
        target_price=Decimal("130.00"),
        quantity_increment=Decimal("10"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    assert res.recommended_quantity == Decimal("0.000000")
    failed_rules = [r for r in res.rules if r.status == "FAIL"]
    assert any("Lot Sizing / Increment" in r.rule_name for r in failed_rules)


def test_daily_loss_limit_breach():
    # Equity $50,000, 2.0% daily limit = $1,000 max daily loss
    # Current daily losses = $800. Proposed risk = $300.
    # Total projected = $1,100 > $1,000 -> REJECT
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("0.6"),  # $300 budget
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("97.00"),
        target_price=Decimal("110.00"),
        daily_loss_limit_pct=Decimal("2.0"),
        current_daily_losses=Decimal("800.00"),
    )
    assert res.outcome == EvaluationOutcome.REJECTED
    failed_rules = [r for r in res.rules if r.status == "FAIL"]
    assert any("Daily Loss Limit" in r.rule_name for r in failed_rules)


def test_target_missing_emits_warning_not_silent_approval():
    # If target is omitted, we approve with WARNING
    res = evaluate_trade_risk(
        account_equity=Decimal("50000"),
        risk_percentage=Decimal("1.0"),
        side=TradeSide.LONG,
        entry_price=Decimal("100.00"),
        stop_loss=Decimal("95.00"),
        target_price=None,
    )
    assert res.outcome == EvaluationOutcome.WARNING
    assert res.reward_to_risk_ratio is None
    warning_rules = [r for r in res.rules if r.status == "WARNING"]
    assert any("Reward-to-Risk Ratio" in r.rule_name for r in warning_rules)
