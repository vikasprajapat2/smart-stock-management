from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
import os
import logging

load_dotenv(override=True)

# Setup logs
logger = logging.getLogger("uvicorn.error")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please check your .env file.")

def create_db_engine(url: str):
    """Create engine with proper pool settings to handle dropped connections."""
    if url.startswith("postgresql"):
        return create_engine(
            url,
            connect_args={"connect_timeout": 5},
            pool_pre_ping=True,       # Test connection health before each use
            pool_recycle=300,         # Recycle connections every 5 minutes
            pool_size=5,
            max_overflow=10,
        )
    return create_engine(url)

try:
    engine = create_db_engine(DATABASE_URL)
    # Test connection at startup
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info(f"✅ Database connected: {DATABASE_URL.split('@')[-1]}")
except Exception as e:
    logger.warning(f"Database connection failed ({e}). Falling back to SQLite local database.")
    DATABASE_URL = "sqlite:///./smartstock_local.db"
    engine = create_db_engine(DATABASE_URL)

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
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()