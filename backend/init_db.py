"""Database initialization and administrative utility for TradePilot.

Usage:
    python init_db.py [--reset]
"""
import sys
import argparse
from app.db.session import init_db, engine, Base


def main():
    parser = argparse.ArgumentParser(description="TradePilot Database Initialization & Reset Utility")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop all existing tables before recreating them (DANGER: destroys existing data).",
    )
    args = parser.parse_args()

    import app.models.entities  # Ensure models are loaded into Base.metadata

    if args.reset:
        print("[!] Dropping all tables in TradePilot database...")
        Base.metadata.drop_all(bind=engine)
        print("[+] Tables successfully dropped.")

    print("[*] Initializing TradePilot database schema...")
    init_db()
    print("[+] All database tables created and verified successfully.")


if __name__ == "__main__":
    main()
