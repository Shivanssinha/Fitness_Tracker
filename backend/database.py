from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL

# Create the SQLAlchemy engine using the PyMySQL driver
# pool_pre_ping=True: Tests connection liveness on checkout from the pool to avoid stale/dropped connections
# pool_recycle=3600: Refreshes idle pool connections before MySQL default 8-hour wait_timeout
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Session factory for generating independent database sessions per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models to inherit from
Base = declarative_base()

def get_db():
    """
    FastAPI dependency that yields a database session per HTTP request
    and guarantees the session is closed cleanly when the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

