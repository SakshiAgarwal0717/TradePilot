# TradePilot Known Limitations & Operational Boundaries

This document records the design boundaries, known trade-offs, and intentionally deferred capabilities in the current academic release of TradePilot.

---

## 1. Broker Integration & Automated Execution
- **Current State**: TradePilot is an intentional **pre-trade risk gatekeeper and post-trade analytical journal**, not an algorithmic broker execution terminal.
- **Design Decision**: It does not connect directly to live brokerage order routing systems (such as Interactive Brokers, Alpaca, or FIX protocol). All execution fills, exit timestamps, and fees are entered by the trader or confirmed upon trade closure.
- **Academic Rationale**: Isolating the decision-support simulation from live execution allows deterministic modeling of behavioral compliance without broker-specific latency, margin calls, or connection interruptions.

---

## 2. Multi-Leg and Derivative Structures
- **Current State**: The Risk Gatekeeper supports linear, single-instrument directional instruments:
  - Long and Short Equities.
  - Futures and Forex contracts (with configurable lot/increment sizes).
- **Limitation**: Complex non-linear derivative structures (such as multi-leg option spreads, straddles, iron condors, or volatility swaps) with Greeks-based delta/gamma risk profiles are not modeled by the Gatekeeper engine.

---

## 3. Real-Time Market Feed Streaming
- **Current State**: Open position values in the journal reflect the original entry parameters until closed. TradePilot intentionally does not calculate "unrealized P&L" on open trades to prevent fabricating market prices without a live data subscription feed.
- **Limitation**: The Analytics equity curve is derived exclusively from **closed, realized trades**. Open positions do not alter cumulative equity until officially closed with a validated exit price.

---

## 4. Multi-Currency Portfolio Conversion
- **Current State**: TradePilot provides a user-selectable base currency (`USD`, `EUR`, `GBP`, `INR`) in the Settings page for display and reporting purposes.
- **Limitation**: Cross-currency auto-conversion using live FX exchange rates is not currently implemented. All numeric values in a single account are evaluated under the selected base currency denomination.

---

## 5. Mobile Device Experience
- **Current State**: The frontend is fully responsive across mobile, tablet, and desktop viewports, featuring mobile drawer menus and flexible card grids.
- **Limitation**: Complex data-dense views (such as large multi-column journal tables and detailed Recharts SVG diagrams) are optimized for desktop resolutions ($\ge 1024\text{px}$) for professional analysis.
