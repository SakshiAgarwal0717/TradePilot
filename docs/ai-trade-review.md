# AI Trade Review Assistant — Operational & Technical Reference

This document provides a comprehensive technical overview and operational guide for the **AI Trade Review Assistant** in TradePilot. It details system capabilities, boundary limits, provider configuration, data privacy practices, error handling, local setup, and testing procedures.

---

## 1. Scope & System Boundaries

### What the AI Trade Review Assistant Does
- **Post-Trade Execution Analysis**: Evaluates closed or open trades strictly using recorded facts: entry price, exit price, stop loss, take profit, fees, quantity, side (LONG/SHORT), strategy tag, realized P&L, R-multiples, timestamps, and linked pre-trade Risk Gatekeeper evaluations.
- **Structured Epistemic Output**: Returns four deterministic sections plus a compliance disclaimer:
  1. `strengths`: Observed adherence to trading discipline and mathematical risk parameters.
  2. `improvement_areas`: Specific execution defects, lack of stop discipline, or adverse fee ratios.
  3. `evidence`: Concrete quantitative citations matching persisted trade fields.
  4. `lessons_learned`: Actionable, objective takeaways for future trade execution.
  5. `disclaimer`: Compliance notice confirming educational nature.
- **Outcome-Bias Mitigation**: Evaluates decision quality independently of financial result. A winning trade with no stop loss or poor risk-to-reward ratio is flagged as an undisciplined gamble; a disciplined losing trade stopped out at the planned loss limit is affirmed as proper risk management.
- **Strict Data Grounding**: Explicitly acknowledges missing data (e.g. unrecorded stops, unclosed trades) rather than fabricating evidence or inferring market conditions.
- **Tenant Isolation**: Strictly enforces user ownership. Attempting to review a trade belonging to another user returns an HTTP 404 (preventing cross-tenant existence enumeration).

### What the Assistant Intentionally Does NOT Do
- **No Trade Execution or Mutation**: The assistant is strictly read-only. It cannot place, modify, close, or cancel orders or journal entries.
- **No Financial, Investment, or Psychological Advice**: It does not provide trade signals, future price predictions, market recommendations, or emotional/psychological diagnoses.
- **No Fabricated Market Data**: It never invents market conditions, technical indicators, news events, or price movement history not explicitly recorded in the trade's fields.
- **No Persistent Review Storage**: Generated reviews are returned ephemerally to the client session. They are **not** persisted to SQLite, PostgreSQL, `localStorage`, or `sessionStorage`.

---

## 2. Supported Providers & Configuration

TradePilot supports two AI providers via a unified backend abstraction:
1. **OpenRouter** (Default)
2. **Google Gemini** (Optional)

Provider selection is configured strictly on the backend. **API keys and provider configurations are never exposed to the frontend.**

### 2.1 Backend Environment Variables (`backend/.env`)

| Variable | Type / Options | Default | Description |
| :--- | :--- | :--- | :--- |
| `AI_PROVIDER_DEFAULT` | `openrouter` \| `gemini` | `openrouter` | Active AI provider client. Validated at startup. |
| `OPENROUTER_API_KEY` | string (secret) | `None` | OpenRouter bearer API key. Required if provider is `openrouter`. |
| `AI_MODEL_NAME` | string | `meta-llama/llama-3.3-70b-instruct` | Model identifier sent to OpenRouter chat completion API. |
| `GEMINI_API_KEY` | string (secret) | `None` | Google Gemini API key. Required if provider is `gemini`. |
| `GEMINI_MODEL_NAME` | string | `gemini-2.0-flash` | Gemini model name sent to Google Generative Language API. |

### 2.2 Provider Details & Implementation Architecture

- **OpenRouter Implementation (`OpenRouterProviderClient`)**:
  - Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`
  - Headers: `Authorization: Bearer <OPENROUTER_API_KEY>`, `HTTP-Referer`, `X-Title`
  - Output constraint: `response_format: {"type": "json_object"}`
- **Google Gemini Implementation (`GeminiProviderClient`)**:
  - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:generateContent?key={GEMINI_API_KEY}`
  - Transport: Direct HTTP via existing `httpx.AsyncClient` (no heavy third-party SDK dependencies).
  - Output constraint: `generationConfig: {"responseMimeType": "application/json", "maxOutputTokens": 1000}`
  - Prompt structure: System prompt mapped to `system_instruction`; trade facts mapped to `contents.parts[].text`.

---

## 3. Local Setup & Execution Guide

### 3.1 Backend Setup
1. Activate virtual environment and install dependencies:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your provider credentials:
   ```env
   AI_PROVIDER_DEFAULT=openrouter
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   # Or for Gemini:
   # AI_PROVIDER_DEFAULT=gemini
   # GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Initialize the database and seed synthetic demo data:
   ```bash
   python init_db.py
   python seed_demo.py
   ```
4. Start the backend:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 3.2 Frontend Setup
1. Install dependencies and start Vite dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open `http://localhost:5173` in your browser.

---

## 4. Local Testing & Endpoint Verification

### 4.1 Testing via Frontend UI
1. Navigate to `http://localhost:5173` and log in with the development account:
   - **Email**: `demo_trader@tradepilot.io`
   - **Password**: `DemoPassword123!`
2. Navigate to **Trading Journal**.
3. Click the view details button (eye icon) on any trade (e.g. `AAPL` or `NQ`).
4. In the Trade Details modal, click **Review Trade with AI**.
5. The review modal will display loading status, request the review, and render observed strengths, improvement areas, evidence, lessons learned, and the disclaimer.
6. Click **Copy Review** to test the client-side clipboard action.

### 4.2 Testing via cURL / HTTP Request

```bash
# 1. Authenticate to obtain access token
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo_trader@tradepilot.io&password=DemoPassword123!"

# 2. Invoke the AI Trade Review endpoint for trade #1
curl -X POST http://127.0.0.1:8000/api/v1/ai-review/trade/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN_HERE>" \
  -d '{"focus_area": "general"}'
```

---

## 5. Error Handling & Status Code Matrix

The backend safely maps all upstream provider conditions to clear, actionable HTTP status codes without leaking internal stack traces or API keys:

| Scenario | HTTP Status | Response Code | User-Facing Explanation |
| :--- | :---: | :--- | :--- |
| **Unauthenticated Request** | `401` | `HTTP_401` | Missing or invalid Bearer JWT / session cookie. |
| **Trade Not Found / Cross-Tenant Access** | `404` | `HTTP_404` | "Trade not found" (returned for missing IDs and other users' trades). |
| **Rate Limit Exceeded** | `429` | `HTTP_429` | Upstream provider throttling or rate limit reached. Safe retry recommended. |
| **Provider Auth Failure / Malformed JSON** | `502` | `HTTP_502` | Provider returned invalid JSON or upstream schema violation. |
| **Payload Size Exceeded (>500KB guard)** | `502` | `HTTP_502` | Upstream provider response exceeded safe payload boundaries. |
| **Missing API Key / Configuration** | `503` | `HTTP_503` | Provider API key is not configured in `backend/.env`. |
| **Provider Timeout (>15s)** | `504` | `HTTP_504` | Provider response took longer than 15.0 seconds. |

---

## 6. Data Privacy, Handling & Sanitized Logging

- **Fields Sent Upstream**: Only the following structured fields are sent to the provider:
  - `trade_id`, `symbol`, `side`, `status`, `quantity`
  - `entry_price`, `exit_price`, `stop_loss`, `take_profit`, `fees`
  - `realized_pnl`, `r_multiple`, `strategy_tag`, `entry_time`, `exit_time`
  - Linked Gatekeeper evaluation results (status, rule violations, max risk parameters)
  - User notes (wrapped in untrusted boundary tags `<user_untrusted_notes>` with prompt-injection defense instructions)
- **Sensitive Data Excluded**: User emails, hashed passwords, database IDs of users, and account balances are **never** transmitted to the AI provider.
- **Sanitized Logging**:
  - Request headers (`Authorization: Bearer ...`) are stripped before logging.
  - Query parameters (such as `?key=...` in Gemini requests) are scrubbed from logs.
  - User notes and review response text are never written to server console logs.

---

## 7. Automated Test Suites & Build Commands

### Backend Automated Tests
```bash
cd backend
python -m pytest -v
```
- **Coverage**: 64 total tests (20 dedicated AI Review tests + 44 core application tests).
- All AI tests execute against mock HTTP clients; no live API calls or network requests occur during testing.

### Frontend Automated Tests
```bash
cd frontend
npm test -- --run
```
- **Coverage**: 27 total tests across 4 test suites (11 dedicated tests in `AiTradeReviewModal.test.tsx`).
- Covers loading, retry, empty-findings, copy action, Escape/close, and cross-trade race conditions.

### Frontend Production Build
```bash
cd frontend
npm run build
```
- Validates strict TypeScript compilation (`tsc -b`) and Vite production bundling.
