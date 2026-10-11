# TradePilot Academic Research Plan

## 1. Research Question
> **"Does the systematic enforcement of deterministic pre-trade risk boundaries and behavioral feedback loops reduce catastrophic drawdown and rule-violation rates among retail and discretionary traders?"**

---

## 2. Theoretical Background & Motivation
Retail financial markets exhibit high attrition rates. Behavioral finance literature (e.g., Kahneman & Tversky's Prospect Theory, Barber & Odean's studies on retail trading) demonstrates that retail traders systematically suffer from:
1. **Disposition Effect**: Prematurely realizing gains while holding losing positions in anticipation of a rebound.
2. **Reckless Position Sizing**: Sizing trades based on emotional conviction rather than distance to structural invalidation (stop loss).
3. **Revenge Trading**: Escalating exposure following realized losses to break even within a single session.

TradePilot investigates whether decoupling trade ideation from position sizing via an automated **Risk Gatekeeper** mitigates these psychological failure modes.

---

## 3. Methodology & Architecture Design
The platform acts as an experimental decision-support apparatus:
1. **Deterministic Sizing Formulation**:
   Given account equity $E$, trader risk allocation percentage $r$, entry price $P_{\text{entry}}$, and stop-loss price $P_{\text{stop}}$:
   $$\text{Risk Budget } B = E \times \frac{r}{100}$$
   $$\text{Stop Distance } D_{\text{stop}} = |P_{\text{entry}} - P_{\text{stop}}|$$
   $$\text{Raw Quantity } Q = \frac{B}{D_{\text{stop}}}$$
   If an instrument has lot size increment $\Delta_{\text{lot}}$:
   $$Q_{\text{recommended}} = \left\lfloor \frac{Q}{\Delta_{\text{lot}}} \right\rfloor \times \Delta_{\text{lot}}$$
2. **Enforced Gatekeeper Clearance**:
   Trades cannot be directly committed without a quantitative evaluation step validating:
   - Positive, non-zero stop loss distance.
   - Reward-to-risk ratio $\ge R_{\min}$.
   - Daily loss ceiling not breached.
   - Single-trade risk ceiling $\le r_{\max}$.
3. **Closed Feedback Loop**:
   Realized outcomes and rule adherence percentages are fed back to the user via post-trade analytics to assess long-term behavioral compliance.

---

## 4. Key Metrics
- **Rule Violation Rate**: The proportion of prospective entries that fail one or more safety boundaries:
  $$\text{Violation Rate} = \frac{\text{Evaluations Rejected}}{\text{Total Evaluations Conducted}} \times 100$$
- **Maximum Drawdown (MDD)**: The peak-to-trough decline in cumulative realized equity:
  $$\text{MDD} = \max_{t} \left( \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t} \right)$$
- **Realized Reward-to-Risk (Realized R:R)**: Comparison between planned R:R in the Gatekeeper versus executed R-multiple in the Journal.
- **Profit Factor**: Gross profits divided by gross losses.

---

## 5. Scope & Limitations
- **Simulation Environment**: TradePilot serves as a decision-support and journaling platform; it does not execute live orders through broker APIs.
- **Self-Reported Execution**: Fill prices and execution slippage are entered by the user upon trade completion.
- **Single-User Scope**: Current version focuses on individual trader risk governance rather than institutional multi-seat fund allocation.
