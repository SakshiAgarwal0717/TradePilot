# TradePilot

TradePilot is an open-source, decision-support platform and risk-aware trading journal engineered to study and enforce quantitative pre-trade discipline, deterministic position sizing, and objective performance analytics.

---

## 1. System Architecture & Pillars

```
+-------------------------------------------------------------+
|                      React 19 + Vite                        |
|        (TypeScript, Tailwind CSS v4, Recharts, Lucide)      |
+------------------------------+------------------------------+
                               | REST API (JSON / Bearer JWT)
+------------------------------v------------------------------+
|                    FastAPI Backend Engine                   |
|  +------------------------+  +----------------------------+ |
|  | Rule-Based Gatekeeper  |  |   Trading Journal Ledger   | |
|  +------------------------+  +----------------------------+ |
|  | Quantitative Analytics |  | Multi-Tenant Auth / Bcrypt | |
|  +------------------------+  +----------------------------+ |
+------------------------------+------------------------------+
                               | SQLAlchemy 2.0 ORM
+------------------------------v------------------------------+
|                SQLite Database / PostgreSQL                 |
|            (Strict Foreign Key Pragma & Decimal)            |
+-------------------------------------------------------------+
```

1. **Rule-Based Risk Gatekeeper**: Pre-trade order simulator that deterministically calculates position size and evaluates prospective entries against mandatory mathematical safety rules (directional stop placement, minimum reward-to-risk, single-trade risk ceiling, and daily loss limits).
2. **Authoritative Trading Journal**: Full-lifecycle trade ledger tracking drafts, open positions, and closed trades with decimal-safe numeric handling for prices, fees, realized P&L, and R-multiples.
3. **Quantitative Trading Analytics**: Performance dashboard computing win rates, profit factors, drawdown series, and equity curves strictly from persisted, closed trades without fabricating synthetic quotes or unrealized assumptions.
4. **Strict Multi-Tenant Isolation**: Cryptographic session tokens, bcrypt password hashing, and strict database query scoping ensuring users can never read, modify, or infer the existence of another user's records.

---

## 2. Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts.
- **Frontend Testing**: Vitest, React Testing Library, `@testing-library/jest-dom`, JSDOM.
- **Backend**: FastAPI, Pydantic v2, Pydantic-Settings, SQLAlchemy 2.0, SQLite (with `PRAGMA foreign_keys = ON`).
- **Backend Testing**: pytest, pytest-asyncio, HTTPX, FastAPI TestClient.

---

## 3. Academic & Technical Documentation

Detailed architectural and design specifications are maintained in the [`docs/`](docs/) directory:
- [AI Trade Review Assistant Reference](docs/ai-trade-review.md) (`docs/ai-trade-review.md`)
- [Architecture & Data Flow Diagram](docs/architecture.md) (`docs/architecture.md`)
- [API Contract & Schema Reference](docs/api-contract.md) (`docs/api-contract.md`)
- [Test Plan & Verification Matrix](docs/test-plan.md) (`docs/test-plan.md`)
- [Research Plan & Mathematical Formulation](docs/research-plan.md) (`docs/research-plan.md`)
- [Known Limitations & Operational Boundaries](docs/known-limitations.md) (`docs/known-limitations.md`)

---

## 4. Local Quick Start & Development Setup

### Prerequisites
- Python 3.11+ (Python 3.14 tested and verified)
- Node.js 18+ and npm
- Git

### 4.1 Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS / Linux:
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   Copy the provided `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
5. Initialize the database schema:
   ```bash
   python init_db.py
   ```
6. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - Health Check: `http://127.0.0.1:8000/api/v1/health`
   - Interactive Swagger API Documentation: `http://127.0.0.1:8000/docs`
   - ReDoc Documentation: `http://127.0.0.1:8000/redoc`

### 4.2 Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. (Optional) Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   *Default API URL targets `http://localhost:8000/api/v1` automatically.*
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at: `http://localhost:5173/`

---

## 5. Demonstration & Repeatable Demo Data

TradePilot includes an isolated seeding utility that generates clearly labeled, realistic **synthetic** demo records. This enables immediate testing of win rates, equity curves, drawdown calculations, and Gatekeeper compliance without entering real personal financial data.

### 5.1 Seeding Synthetic Demo Records
From the `backend/` directory, run:
```bash
python seed_demo.py
```
This provisions a local evaluation account and populates 5 closed trades (3 wins, 2 losses), 1 open trade, and 2 pre-flight risk evaluations:
- **Email**: `demo_trader@tradepilot.io`
- **Password**: `DemoPassword123!`

> [!NOTE]
> The demo credentials and seeded trades are strictly synthetic and intended for local development and academic evaluation only. Never deploy demo accounts or use default secrets in production.

### 5.2 Resetting Demo Data
To reset the database tables without deleting code files:
```bash
python init_db.py --reset
```
To re-seed clean synthetic data after reset:
```bash
python seed_demo.py
```

---

## 6. Testing & Quality Assurance

### Backend Test Suite
Run the automated backend test suite (44 test cases covering authentication, user isolation, risk engine mathematics, journal CRUD, analytics calculations, and end-to-end user journeys):
```bash
cd backend
pytest -v
```

### Frontend Test Suite
Run Vitest and React Testing Library tests (16 test cases covering component rendering, zero-fabricated empty states, and user journeys):
```bash
cd frontend
npm test
```

### Frontend Production Build
Verify TypeScript compilation and Vite production bundling:
```bash
cd frontend
npm run build
```

---

## 7. Production Deployment Prerequisites

Before deploying TradePilot to a production environment:

1. **Cryptographic Secret Key**:
   Generate a high-entropy secret for JWT signing and set it in your environment:
   ```bash
   openssl rand -hex 32
   ```
   Configure `SECRET_KEY` in `backend/.env` or as an environment secret.
2. **Production Database**:
   TradePilot uses SQLAlchemy ORM and supports production PostgreSQL. Set:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/tradepilot
   ```
3. **Cookie & Transport Security**:
   - Enable HTTPS.
   - Set `COOKIE_SECURE=True` in production backend settings.
   - Configure `COOKIE_SAMESITE=lax` (or `strict`).
4. **CORS Whitelist**:
   Update `BACKEND_CORS_ORIGINS` to contain only the authorized production domain(s):
   ```env
   BACKEND_CORS_ORIGINS=["https://app.yourdomain.com"]
   ```
5. **Reverse Proxy & Static Hosting**:
   - Serve the frontend `dist/` bundle via Nginx, Cloudflare Pages, Vercel, or AWS S3/CloudFront.
   - Run the FastAPI backend behind Gunicorn with Uvicorn workers or in a containerized environment (Docker/Kubernetes).
