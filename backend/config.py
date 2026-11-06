import os
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy.engine import URL

# Load .env file from the backend folder
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Database configuration
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "fitness_tracker")

# Safely construct URL using SQLAlchemy URL.create (handles special characters like '@' in password)
constructed_url = URL.create(
    drivername="mysql+pymysql",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME
).render_as_string(hide_password=False)

# Check if DATABASE_URL was provided in .env
env_db_url = os.getenv("DATABASE_URL")
if env_db_url and "root:password@" not in env_db_url:
    DATABASE_URL = env_db_url
else:
    DATABASE_URL = constructed_url

# JWT Auth settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-fitness-jwt-key-2026-min-32-chars-interview")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
