import os
import re
from pathlib import Path
from dotenv import load_dotenv
import pymysql

# Load backend/.env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "fitness_tracker")

def execute_sql_file(cursor, file_path):
    """Executes multi-statement SQL script handling semicolons and comments."""
    print(f"Reading {file_path.name}...")
    with open(file_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Split by semicolon (ignoring comments)
    statements = sql.split(";")
    for statement in statements:
        stmt = statement.strip()
        if stmt:
            cursor.execute(stmt)

def init_database():
    print("=" * 60)
    print("FITNESS TRACKER - DATABASE INITIALIZER")
    print("=" * 60)
    print(f"Connecting to MySQL server at {DB_HOST}:{DB_PORT} as user '{DB_USER}'...")

    try:
        # Step 1: Connect to server without database to create it if missing
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            autocommit=True
        )
    except pymysql.err.OperationalError as e:
        print("\n❌ CONNECTION FAILED:")
        print(f"Error: {e}")
        print("\n👉 Tip: Please verify your DB_PASSWORD inside 'backend/.env' matches your local MySQL password.")
        return

    with connection.cursor() as cursor:
        print(f"Ensuring database '{DB_NAME}' exists...")
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        )
        cursor.execute(f"USE `{DB_NAME}`;")

        # Step 2: Execute schema.sql
        schema_path = BASE_DIR / "schema.sql"
        print(f"Applying schema definitions from {schema_path}...")
        execute_sql_file(cursor, schema_path)
        print("✓ Schema tables, constraints, indexes, and views created successfully!")

        # Step 3: Execute seed.sql
        seed_path = BASE_DIR / "seed.sql"
        print(f"Populating seed data from {seed_path}...")
        execute_sql_file(cursor, seed_path)
        print("✓ Seed data imported successfully!")

        # Step 4: Verify rows
        cursor.execute("SELECT COUNT(*) FROM users;")
        user_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM exercises;")
        exercise_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM workouts;")
        workout_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM workout_sets;")
        set_count = cursor.fetchone()[0]

        print("\n" + "=" * 60)
        print("DATABASE INITIALIZED SUCCESSFULLY!")
        print("=" * 60)
        print(f"• Users in database:     {user_count} (demouser, alex_fit)")
        print(f"• Exercises in catalog:  {exercise_count}")
        print(f"• Workouts recorded:     {workout_count}")
        print(f"• Workout sets logged:   {set_count}")
        print("=" * 60)
        print("You can now run: python -m uvicorn main:app --reload --port 8000")

    connection.close()

if __name__ == "__main__":
    init_database()

