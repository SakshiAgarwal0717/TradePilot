from decimal import Decimal, ROUND_DOWN
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.entities import TradeSide, EvaluationOutcome


class RuleEvaluationItem(BaseModel):
    rule_name: str
    status: str  # "PASS", "FAIL", "WARNING", "SKIPPED"
    message: str
    details: Optional[Dict[str, Any]] = None


class RiskEvaluationOutput(BaseModel):
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
    rules: List[RuleEvaluationItem]
    summary: str


def evaluate_trade_risk(
    account_equity: Decimal,
    risk_percentage: Decimal,
    side: TradeSide,
    entry_price: Decimal,
    stop_loss: Decimal,
    target_price: Optional[Decimal] = None,
    min_reward_risk_ratio: Decimal = Decimal("1.5"),
    quantity_increment: Optional[Decimal] = None,
    daily_loss_limit_pct: Optional[Decimal] = None,
    current_daily_losses: Optional[Decimal] = None,
    enforce_mandatory_stop_loss: bool = True,
    max_risk_per_trade_pct: Optional[Decimal] = None,
) -> RiskEvaluationOutput:
    """Deterministic, pure risk engine calculation & evaluation for trade decision support.
    
    Adheres strictly to financial calculation rules:
    - Decimal arithmetic with exact rounding
    - Differentiates REJECTED, WARNING, APPROVED outcomes
    - Never approves a trade when a mandatory safety rule fails
    - Missing risk data is never assumed as zero risk
    """
    rules: List[RuleEvaluationItem] = []
    has_rejection = False
    has_warning = False

    # 1. Price Positivity Validation
    if entry_price <= Decimal("0"):
        rules.append(
            RuleEvaluationItem(
                rule_name="Price Validity",
                status="FAIL",
                message="Entry price must be finite and strictly greater than zero.",
            )
        )
        has_rejection = True
    elif stop_loss <= Decimal("0"):
        rules.append(
            RuleEvaluationItem(
                rule_name="Price Validity",
                status="FAIL",
                message="Stop loss price must be finite and strictly greater than zero.",
            )
        )
        has_rejection = True
    else:
        rules.append(
            RuleEvaluationItem(
                rule_name="Price Validity",
                status="PASS",
                message="Entry and stop loss prices are positive and valid.",
            )
        )

    # 2. Mandatory Stop Loss Check
    if enforce_mandatory_stop_loss and (stop_loss is None or stop_loss <= Decimal("0")):
        rules.append(
            RuleEvaluationItem(
                rule_name="Mandatory Stop Loss",
                status="FAIL",
                message="A valid positive stop-loss price is mandatory.",
            )
        )
        has_rejection = True
    else:
        rules.append(
            RuleEvaluationItem(
                rule_name="Mandatory Stop Loss",
                status="PASS",
                message="Mandatory stop loss price defined.",
            )
        )

    # Max Risk Per Trade Cap Check
    if max_risk_per_trade_pct is not None:
        if risk_percentage > max_risk_per_trade_pct:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Max Risk Per Trade Cap",
                    status="FAIL",
                    message=f"Requested risk per trade ({risk_percentage:.2f}%) exceeds account policy limit ({max_risk_per_trade_pct:.2f}%).",
                    details={"requested_risk_pct": str(risk_percentage), "max_allowed_pct": str(max_risk_per_trade_pct)},
                )
            )
            has_rejection = True
        else:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Max Risk Per Trade Cap",
                    status="PASS",
                    message=f"Risk per trade ({risk_percentage:.2f}%) is within account policy limit ({max_risk_per_trade_pct:.2f}%).",
                )
            )

    # 3. Stop Distance & Directional Alignment
    # Long: Entry > Stop Loss (distance = Entry - Stop)
    # Short: Entry < Stop Loss (distance = Stop - Entry)
    if side == TradeSide.LONG:
        stop_distance = entry_price - stop_loss
        if stop_distance <= Decimal("0"):
            rules.append(
                RuleEvaluationItem(
                    rule_name="Directional Stop Placement",
                    status="FAIL",
                    message=f"For a LONG trade, Stop Loss ({stop_loss}) must be strictly below Entry ({entry_price}). Stop distance cannot be zero or negative.",
                )
            )
            has_rejection = True
        else:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Directional Stop Placement",
                    status="PASS",
                    message=f"Long stop distance is valid: {stop_distance.normalize()} points/ticks.",
                )
            )
    else:  # SHORT
        stop_distance = stop_loss - entry_price
        if stop_distance <= Decimal("0"):
            rules.append(
                RuleEvaluationItem(
                    rule_name="Directional Stop Placement",
                    status="FAIL",
                    message=f"For a SHORT trade, Stop Loss ({stop_loss}) must be strictly above Entry ({entry_price}). Stop distance cannot be zero or negative.",
                )
            )
            has_rejection = True
        else:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Directional Stop Placement",
                    status="PASS",
                    message=f"Short stop distance is valid: {stop_distance.normalize()} points/ticks.",
                )
            )

    # 4. Target Price and Reward-to-Risk Ratio Check
    reward_to_risk: Optional[Decimal] = None
    target_distance: Optional[Decimal] = None
    if target_price is not None:
        if target_price <= Decimal("0"):
            rules.append(
                RuleEvaluationItem(
                    rule_name="Target Price Placement",
                    status="FAIL",
                    message="Target price must be positive.",
                )
            )
            has_rejection = True
        else:
            if side == TradeSide.LONG:
                target_distance = target_price - entry_price
                if target_distance <= Decimal("0"):
                    rules.append(
                        RuleEvaluationItem(
                            rule_name="Target Price Placement",
                            status="FAIL",
                            message=f"For a LONG trade, Target price ({target_price}) must be strictly above Entry ({entry_price}).",
                        )
                    )
                    has_rejection = True
            else:  # SHORT
                target_distance = entry_price - target_price
                if target_distance <= Decimal("0"):
                    rules.append(
                        RuleEvaluationItem(
                            rule_name="Target Price Placement",
                            status="FAIL",
                            message=f"For a SHORT trade, Target price ({target_price}) must be strictly below Entry ({entry_price}).",
                        )
                    )
                    has_rejection = True

            # If both stop and target distances are positive, calculate R:R
            if stop_distance > Decimal("0") and target_distance is not None and target_distance > Decimal("0"):
                reward_to_risk = (target_distance / stop_distance).quantize(Decimal("0.01"))
                if reward_to_risk < min_reward_risk_ratio:
                    rules.append(
                        RuleEvaluationItem(
                            rule_name="Reward-to-Risk Ratio",
                            status="FAIL",
                            message=f"Calculated reward-to-risk ratio ({reward_to_risk}:1) is below configured minimum requirement ({min_reward_risk_ratio}:1).",
                            details={"calculated_rr": str(reward_to_risk), "minimum_rr": str(min_reward_risk_ratio)},
                        )
                    )
                    has_rejection = True
                else:
                    rules.append(
                        RuleEvaluationItem(
                            rule_name="Reward-to-Risk Ratio",
                            status="PASS",
                            message=f"Reward-to-risk ratio ({reward_to_risk}:1) meets minimum requirement ({min_reward_risk_ratio}:1).",
                            details={"calculated_rr": str(reward_to_risk), "minimum_rr": str(min_reward_risk_ratio)},
                        )
                    )
    else:
        # Target not provided: Warning or informational
        rules.append(
            RuleEvaluationItem(
                rule_name="Reward-to-Risk Ratio",
                status="WARNING",
                message="Target price not specified. Reward-to-risk ratio cannot be verified prior to execution.",
            )
        )
        has_warning = True

    # 5. Position Sizing & Risk Budget Calculations
    risk_budget = (account_equity * (risk_percentage / Decimal("100"))).quantize(Decimal("0.000001"))
    
    if stop_distance > Decimal("0"):
        per_unit_risk = stop_distance
        raw_quantity = risk_budget / per_unit_risk

        if quantity_increment is not None and quantity_increment > Decimal("0"):
            # Round down to permitted increment (e.g., lot size of 1, 0.1, etc.)
            steps = (raw_quantity / quantity_increment).to_integral_value(rounding=ROUND_DOWN)
            recommended_quantity = (steps * quantity_increment).quantize(Decimal("0.000001"))
            if recommended_quantity == Decimal("0"):
                rules.append(
                    RuleEvaluationItem(
                        rule_name="Lot Sizing / Increment",
                        status="FAIL",
                        message=f"Permitted risk budget (${risk_budget:.2f}) is too small for minimum increment ({quantity_increment}). Raw quantity was {raw_quantity:.4f}.",
                    )
                )
                has_rejection = True
            else:
                rules.append(
                    RuleEvaluationItem(
                        rule_name="Lot Sizing / Increment",
                        status="PASS",
                        message=f"Position size rounded down to valid lot increment: {recommended_quantity.normalize()}.",
                    )
                )
        else:
            # Default continuous quantity rounded to 4 decimals
            recommended_quantity = raw_quantity.quantize(Decimal("0.0001"), rounding=ROUND_DOWN)

        # Recalculate projected loss with finalized recommended quantity
        projected_loss = (recommended_quantity * per_unit_risk).quantize(Decimal("0.000001"))

        # 6. Maximum Projected Loss vs Permitted Risk Budget
        if projected_loss > risk_budget:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Risk Budget Cap",
                    status="FAIL",
                    message=f"Projected loss (${projected_loss:.2f}) exceeds allowed risk budget (${risk_budget:.2f}).",
                )
            )
            has_rejection = True
        else:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Risk Budget Cap",
                    status="PASS",
                    message=f"Projected loss (${projected_loss:.2f}) is safely within risk budget (${risk_budget:.2f}).",
                )
            )
    else:
        per_unit_risk = Decimal("0")
        raw_quantity = Decimal("0")
        recommended_quantity = Decimal("0")
        projected_loss = Decimal("0")

    # 7. Daily Loss Limit Checks (when inputs are configured and supported)
    if daily_loss_limit_pct is not None and current_daily_losses is not None:
        max_daily_allowed_loss = (account_equity * (daily_loss_limit_pct / Decimal("100"))).quantize(Decimal("0.000001"))
        projected_total_daily_loss = current_daily_losses + projected_loss

        if current_daily_losses >= max_daily_allowed_loss:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Daily Loss Limit",
                    status="FAIL",
                    message=f"Daily loss limit already reached (${current_daily_losses:.2f} >= ${max_daily_allowed_loss:.2f}). Trading is locked for the day.",
                )
            )
            has_rejection = True
        elif projected_total_daily_loss > max_daily_allowed_loss:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Daily Loss Limit",
                    status="FAIL",
                    message=f"Projected total daily loss if stopped out (${projected_total_daily_loss:.2f}) would breach max daily loss allowance (${max_daily_allowed_loss:.2f}).",
                )
            )
            has_rejection = True
        else:
            rules.append(
                RuleEvaluationItem(
                    rule_name="Daily Loss Limit",
                    status="PASS",
                    message=f"Daily losses remain within daily threshold limit (${projected_total_daily_loss:.2f} of ${max_daily_allowed_loss:.2f}).",
                )
            )

    # Final Outcome Determination
    if has_rejection:
        outcome = EvaluationOutcome.REJECTED
        summary = "Trade rejected by Gatekeeper. One or more mandatory risk boundaries failed."
    elif has_warning:
        outcome = EvaluationOutcome.WARNING
        summary = "Trade approved with advisory warnings. Review before execution."
    else:
        outcome = EvaluationOutcome.APPROVED
        summary = "Trade approved. All active risk rules and sizing constraints satisfied."

    return RiskEvaluationOutput(
        outcome=outcome,
        account_equity=account_equity,
        risk_budget=risk_budget,
        risk_percentage=risk_percentage,
        per_unit_risk=per_unit_risk,
        raw_quantity=raw_quantity,
        recommended_quantity=recommended_quantity,
        projected_loss=projected_loss,
        reward_to_risk_ratio=reward_to_risk,
        target_distance=target_distance,
        stop_distance=stop_distance,
        rules=rules,
        summary=summary,
    )
