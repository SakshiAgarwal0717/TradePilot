# TradePilot Test Plan & Execution Matrix

## 1. Overview
The TradePilot test strategy validates:
- Cryptographic security and authentication boundaries.
- Relational integrity and cascade behavior in SQLite.
- Numerical precision of financial algorithms.
- User privacy and tenant isolation.
- Complete frontend interaction flows and empty states.

---

## 2. Test Execution Matrix

| Test Suite | File Path | Focus Area | Cases | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Backend API Health & Errors** | `backend/tests/test_api.py` | Health check, error schema format, 422 validations, 404s | 5 | **PASSED** |
| **Backend Authentication** | `backend/tests/test_auth.py` | Registration, duplicate checks, password entropy, login, cookie logout, expired JWT | 6 | **PASSED** |
| **Backend Persistence & FK** | `backend/tests/test_database.py` | User creation, bcrypt hashing, SQLite FK pragma, cascade deletes | 4 | **PASSED** |
| **Backend Risk Engine** | `backend/tests/test_risk_engine.py` | Position sizing, R:R calculation, inverted stops, lot-size rounding, daily loss limit | 10 | **PASSED** |
| **Backend Gatekeeper API** | `backend/tests/test_gatekeeper_api.py` | Clearance evaluation, rejection enforcement, journal link | 4 | **PASSED** |
| **Backend Journal API** | `backend/tests/test_trades_api.py` | Trade CRUD, realized P&L calculation, status transitions, cross-user filters | 6 | **PASSED** |
| **Backend Analytics API** | `backend/tests/test_analytics_api.py` | Empty state zeros, all-wins, drawdown tracking, date range filters, multi-user isolation | 7 | **PASSED** |
| **Backend Smoke** | `backend/tests/test_smoke.py` | ASGI app module import and creation | 1 | **PASSED** |
| **Backend E2E User Journey** | `backend/tests/test_end_to_end_journey.py` | Full flow: Register -> Evaluate -> Journal -> Close -> Analytics -> Cross-tenant check | 1 | **PASSED** |
| **Frontend Shell & Pages** | `frontend/src/test/App.test.tsx` | Route rendering, navigation shell, form inputs, status badges | 9 | **PASSED** |
| **Frontend Analytics** | `frontend/src/test/AnalyticsPage.test.tsx` | Zero fabricated data rendering, KPI formatting, date range selectors | 3 | **PASSED** |
| **Frontend User Journeys** | `frontend/src/test/UserJourneys.test.tsx` | Login validation, Gatekeeper clearance, Journal editing, Settings persistence | 4 | **PASSED** |

**Summary Totals:**
- **Backend Tests Executed**: 44 passed, 0 failed.
- **Frontend Tests Executed**: 16 passed, 0 failed.
- **TypeScript & Production Build**: 0 errors, 100% build pass.

---

## 3. Key Test Scenarios & Verifications

### 3.1 Authentication & Cross-User Isolation
- **Verification**: User A registers and creates a trade. User B registers and attempts to read or mutate User A's trade by ID.
- **Result**: The endpoint raises a strict `404 Not Found` (rather than 403 or 200), ensuring private trade existence is completely shielded from unauthorized users.

### 3.2 Risk Gatekeeper Clearance
- **Verification**: A trader enters an invalid long stop loss (stop price placed above entry price).
- **Result**: Risk Engine marks `Directional Stop-Loss Placement: FAIL`, sets `outcome = REJECTED`, and the journal API rejects any attempt to record the trade with an `HTTP 400 Bad Request`.

### 3.3 Analytics Realized Calculation & Breakeven Handling
- **Verification**: Multiple closed trades are queried with gross profit, gross loss, and transaction fees. Open trades exist concurrently.
- **Result**: Open trades are completely excluded from the realized P&L series and win rate calculation. Fees are subtracted deterministically: $\text{Net PnL} = \text{Gross PnL} - \text{Fees}$.
