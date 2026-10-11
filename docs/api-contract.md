# TradePilot API Contract Reference

Base URL: `http://127.0.0.1:8000/api/v1`  
Interactive OpenAPI Documentation: `http://127.0.0.1:8000/docs`

---

## 1. Authentication Endpoints

### `POST /auth/register`
Creates a new trader account and sets an HttpOnly session cookie.
- **Request Body**:
```json
{
  "email": "trader@tradepilot.io",
  "username": "disciplined_trader",
  "password": "SecurePassword123!"
}
```
- **Response (201 Created)**:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "trader@tradepilot.io",
    "username": "disciplined_trader",
    "is_active": true,
    "created_at": "2026-10-11T00:00:00Z",
    "updated_at": "2026-10-11T00:00:00Z"
  }
}
```

### `POST /auth/login`
Authenticates credentials and sets session cookie.
- **Request Body**:
```json
{
  "email": "trader@tradepilot.io",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK)**: Same shape as registration response.

### `GET /auth/me`
Retrieves authenticated user profile.
- **Headers**: `Authorization: Bearer <token>` or session cookie
- **Response (200 OK)**:
```json
{
  "id": 1,
  "email": "trader@tradepilot.io",
  "username": "disciplined_trader",
  "is_active": true,
  "created_at": "2026-10-11T00:00:00Z",
  "updated_at": "2026-10-11T00:00:00Z"
}
```

### `POST /auth/logout`
Invalidates session and clears cookie.
- **Response (200 OK)**:
```json
{
  "message": "Successfully logged out."
}
```

---

## 2. Risk Gatekeeper Endpoints

### `POST /gatekeeper/evaluate`
Simulates and evaluates prospective trade against risk policies.
- **Request Body**:
```json
{
  "account_equity": "100000.00",
  "risk_percentage": "1.00",
  "symbol": "NQ",
  "side": "LONG",
  "entry_price": "21000.00",
  "stop_loss": "20950.00",
  "target_price": "21150.00",
  "quantity_increment": "1",
  "min_reward_risk_ratio": "2.0",
  "save_evaluation": true
}
```
- **Response (200 OK)**:
```json
{
  "evaluation_id": 14,
  "outcome": "APPROVED",
  "account_equity": "100000.00",
  "risk_budget": "1000.000000",
  "risk_percentage": "1.00",
  "stop_distance": "50.00",
  "target_distance": "150.00",
  "per_unit_risk": "50.00",
  "raw_quantity": "20.0000",
  "recommended_quantity": "20.0000",
  "projected_loss": "1000.000000",
  "reward_to_risk_ratio": "3.00",
  "rules": [
    {
      "rule_name": "Finite Positive Prices",
      "status": "PASS",
      "message": "All prices valid."
    },
    {
      "rule_name": "Directional Stop-Loss Placement",
      "status": "PASS",
      "message": "Long stop loss is placed below entry."
    },
    {
      "rule_name": "Reward-to-Risk Ratio",
      "status": "PASS",
      "message": "Projected R:R is 3.00:1 (minimum required: 2.0:1)."
    }
  ],
  "summary": "All mandatory risk boundaries satisfied. Clearance granted."
}
```

### `GET /gatekeeper/history`
Retrieves past risk evaluations for the current user.
- **Response (200 OK)**: Array of evaluation summaries.

---

## 3. Trading Journal Endpoints

### `GET /trades/`
Lists trades belonging to the user, supporting pagination and filtering.
- **Query Parameters**:
  - `status`: `OPEN` | `CLOSED` | `DRAFT`
  - `side`: `LONG` | `SHORT`
  - `symbol`: string (e.g. `AAPL`)
  - `skip`: integer (default 0)
  - `limit`: integer (default 15)
- **Response (200 OK)**:
```json
{
  "total": 1,
  "skip": 0,
  "limit": 15,
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "symbol": "NQ",
      "side": "LONG",
      "status": "OPEN",
      "quantity": "20.0",
      "entry_price": "21000.00",
      "stop_loss": "20950.00",
      "take_profit": "21150.00",
      "fees": "10.00",
      "notes": "E2E journey trade execution",
      "realized_pnl": null,
      "r_multiple": null,
      "entry_time": "2026-10-11T00:00:00Z"
    }
  ]
}
```

### `POST /trades/`
Creates a trade. If `evaluation_id` query param is provided, links the trade to the gatekeeper evaluation.
- **Request Body**:
```json
{
  "symbol": "NQ",
  "side": "LONG",
  "status": "OPEN",
  "quantity": "20.0",
  "entry_price": "21000.00",
  "stop_loss": "20950.00",
  "take_profit": "21150.00",
  "fees": "10.00",
  "notes": "E2E trade entry"
}
```
- **Response (201 Created)**: The created trade entity.

### `PUT /trades/{id}`
Updates a trade (e.g., closing a position).
- **Request Body**:
```json
{
  "status": "CLOSED",
  "exit_price": "21100.00",
  "exit_time": "2026-10-11T12:00:00Z"
}
```
- **Response (200 OK)**: Updated trade entity with calculated `realized_pnl` and `r_multiple`.

### `DELETE /trades/{id}`
Deletes a trade. Returns 204 No Content.

---

## 4. Analytics Endpoints

### `GET /analytics/summary`
Calculates authoritative trading metrics for the authenticated user.
- **Query Parameters**:
  - `start_date`: ISO datetime string (optional)
  - `end_date`: ISO datetime string (optional)
- **Response (200 OK)**:
```json
{
  "total_trades": 6,
  "closed_trades": 5,
  "open_trades": 1,
  "winning_trades": 3,
  "losing_trades": 2,
  "breakeven_trades": 0,
  "win_rate_pct": "60.00",
  "gross_profit": "759.50",
  "gross_loss": "230.00",
  "net_realized_pnl": "529.50",
  "avg_win": "253.17",
  "avg_loss": "115.00",
  "profit_factor": "3.30",
  "avg_reward_to_risk": "1.98",
  "max_drawdown_amount": "128.00",
  "max_drawdown_pct": "1.28",
  "evaluations_count": 2,
  "violation_rate_pct": "50.00",
  "equity_curve": [
    {
      "date": "2026-10-04T06:00:00Z",
      "realized_pnl": "371.50",
      "cumulative_pnl": "371.50",
      "symbol": "AAPL",
      "trade_id": 1
    }
  ]
}
```

---

## 5. Settings Endpoints

### `GET /settings`
Retrieves risk governance bounds.
- **Response (200 OK)**:
```json
{
  "id": 1,
  "user_id": 1,
  "max_risk_per_trade_pct": "1.00",
  "max_daily_loss_pct": "2.00",
  "max_open_positions": 3,
  "enforce_mandatory_stop_loss": true,
  "base_currency": "USD"
}
```

### `PUT /settings`
Updates risk governance bounds.
- **Request Body**:
```json
{
  "max_risk_per_trade_pct": "0.75",
  "max_daily_loss_pct": "1.50",
  "max_open_positions": 2,
  "enforce_mandatory_stop_loss": true,
  "base_currency": "USD"
}
```
- **Response (200 OK)**: Updated settings entity.
