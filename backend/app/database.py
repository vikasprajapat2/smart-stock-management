from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
import os
import logging

load_dotenv()

# Setup logs
logger = logging.getLogger("uvicorn.error")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please check your .env file.")

try:
    # Use connection timeout for postgresql to fail fast
    connect_args = {"connect_timeout": 3} if DATABASE_URL.startswith("postgresql") else {}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    logger.warning(f"Database connection failed to {DATABASE_URL}: {e}. Falling back to SQLite local database.")
    DATABASE_URL = "sqlite:///./test.db"
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()