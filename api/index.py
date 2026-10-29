import os
import sys

# Ensure backend directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# On Vercel serverless functions, the root directory (/var/task) is read-only.
# Default SQLite to /tmp/tradepilot.db if no custom DATABASE_URL is configured.
if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/tradepilot.db"

# Import the FastAPI application
from app.main import app
from app.db.session import init_db

# Initialize database schema on module load for serverless environments
init_db()

# Provision demo data if running on Vercel and not yet seeded
if os.environ.get("VERCEL"):
    try:
        from app.db.session import SessionLocal
        from app.crud.operations import get_user_by_email
        from seed_demo import seed_demo_data

        db = SessionLocal()
        try:
            demo_user = get_user_by_email(db, email="demo_trader@tradepilot.io")
            if not demo_user:
                seed_demo_data()
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning(f"Demo seeding note: {e}")
