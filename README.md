# Fitness Tracker

A full-stack workout and nutrition tracker. Users sign up, log workouts as sets of exercises (reps and weight), track meals and protein, set goals, and view progress dashboards: weekly training volume, personal records, workout streaks, and goal progress.

The React frontend talks to a FastAPI REST API backed by a normalized MySQL database. The analytics are written in SQL (views, window functions, CTEs, correlated subqueries).

## 🛠 Tech Stack

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | JavaScript (no TypeScript, no Redux, no Tailwind) |
| **Data Viz** | Recharts | Weekly volume bars, workout frequency, progression lines |
| **Backend** | FastAPI (Python 3.10+) | RESTful API, Pydantic validation, automatic Swagger docs |
| **Database ORM** | SQLAlchemy 2.0 + PyMySQL | ORM used for basic CRUD; raw SQL used for analytics |
| **Database** | MySQL 8.0+ | InnoDB engine, normalized to 3NF, constraints, and views |
| **Authentication** | JWT (PyJWT) + Bcrypt | Salted password hashing, bearer token authorization |

---

## 📐 Database Architecture & Schema Explanation

The schema is defined in [`backend/schema.sql`](backend/schema.sql), which acts as the **single source of truth** for all tables, constraints, indexes, and views. The SQLAlchemy models in [`backend/models.py`](backend/models.py) mirror it.

### Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ WORKOUTS : "logs"
    USERS ||--o{ GOALS : "sets"
    USERS ||--o{ NUTRITION_LOGS : "records"
    WORKOUTS ||--|{ WORKOUT_SETS : "contains"
    EXERCISES ||--o{ WORKOUT_SETS : "performed_in"
    EXERCISES ||--o{ GOALS : "targeted_by"

    USERS {
        int id PK
        string username UK
        string email UK
        string password_hash
        timestamp created_at
    }

    EXERCISES {
        int id PK
        string name UK
        string category
        string description
        timestamp created_at
    }

    WORKOUTS {
        int id PK
        int user_id FK
        date workout_date
        string title
        text notes
        timestamp created_at
    }

    WORKOUT_SETS {
        int id PK
        int workout_id FK
        int exercise_id FK
        int set_number
        int reps
        decimal weight_kg
        timestamp created_at
    }

    GOALS {
        int id PK
        int user_id FK
        enum goal_type
        decimal target_value
        int exercise_id FK
        date start_date
        date target_date
        enum status
        timestamp created_at
    }

    NUTRITION_LOGS {
        int id PK
        int user_id FK
        string name
        decimal protein
        int calories
        date logged_date
        timestamp created_at
    }
```

### Table Design Decisions

1. **`users`**:
   - `id` (PK, Auto-Increment), unique `username` and `email`.
   - `password_hash` stores 60-character salted bcrypt hashes.

2. **`exercises`**:
   - Master catalog of exercises categorized by muscle group (`Chest`, `Back`, `Legs`, `Shoulders`, `Arms`, `Core`).
   - Index on `category` for category-filtered queries.

3. **`workouts`**:
   - Represents a workout session performed on a specific `workout_date`.
   - Foreign key to `users(id)` with `ON DELETE CASCADE`.
   - **Composite Index**: `idx_workouts_user_date (user_id, workout_date)` supports filtering a user's workouts in chronological order.

4. **`workout_sets`**:
   - Set-level breakdown (`set_number`, `reps`, `weight_kg`).
   - **Unique Constraint**: `UNIQUE (workout_id, exercise_id, set_number)` prevents recording duplicate set numbers for the same exercise in a session.
   - **CHECK Constraints**: `reps > 0`, `weight_kg >= 0`, `set_number > 0` enforce data sanity at the database level.
   - Foreign key to `exercises(id)` uses `ON DELETE RESTRICT` to preserve historical data.
   - **Composite Index**: `idx_sets_exercise_weight (exercise_id, weight_kg)` is designed for peak-weight lookups per exercise (personal records).

5. **`goals`**:
   - Tracks user fitness objectives (`weekly_workouts` frequency or `exercise_weight` target).
   - Constraint `target_value > 0`.
   - Optional `exercise_id` with `ON DELETE SET NULL`.

6. **`nutrition_logs`**:
   - Stores the food entries of the original frontend tracker in MySQL (`name`, `protein`, `calories`, `logged_date`).

7. **SQL View: `weekly_summary`**:
   - Encapsulates the aggregation across `workouts` and `workout_sets`.
   - Groups by `user_id` and the Monday of each week using `DATE_SUB(workout_date, INTERVAL WEEKDAY(workout_date) DAY)`, so a week is never split across New Year.

---

## 🔍 Core SQL Queries Explained in Plain English

The CRUD endpoints use the SQLAlchemy ORM. The analytics endpoints in [`backend/routers/analytics.py`](backend/routers/analytics.py) run **raw SQL** through SQLAlchemy's `text()` with parameterized bindings.

### 1. Weekly Volume & Workout Aggregation (SQL View)

```sql
SELECT 
    week_start_date,
    total_workouts,
    total_sets,
    total_reps,
    total_volume_kg
FROM weekly_summary
WHERE user_id = :user_id
ORDER BY week_start_date ASC
LIMIT :limit;
```

* **What it does**: Reads the `weekly_summary` view to get weekly training volume (`volume = SUM(reps * weight_kg)`) and workout frequency.
* **Why a view**: The aggregation logic (`LEFT JOIN`, `GROUP BY`, `WEEKDAY` calculation) lives in one reusable place, and the query itself stays simple.

---

### 2. All-Time Personal Records (Window Function: `ROW_NUMBER()`)

```sql
WITH ranked_sets AS (
    SELECT 
        e.id AS exercise_id,
        e.name AS exercise_name,
        e.category AS exercise_category,
        s.weight_kg,
        s.reps,
        w.workout_date,
        ROUND(s.weight_kg * (1.0 + s.reps / 30.0), 2) AS estimated_1rm,
        ROW_NUMBER() OVER (
            PARTITION BY e.id 
            ORDER BY s.weight_kg DESC, s.reps DESC, w.workout_date DESC
        ) AS rank_num
    FROM workout_sets s
    JOIN workouts w ON s.workout_id = w.id
    JOIN exercises e ON s.exercise_id = e.id
    WHERE w.user_id = :user_id
)
SELECT 
    exercise_id,
    exercise_name,
    exercise_category,
    weight_kg AS pr_weight_kg,
    reps AS pr_reps,
    workout_date AS pr_date,
    estimated_1rm
FROM ranked_sets
WHERE rank_num = 1
ORDER BY exercise_category ASC, exercise_name ASC;
```

* **Plain English Explanation**:
  1. The **Common Table Expression (CTE)** `ranked_sets` joins sets, workouts, and exercises for the user.
  2. The window function `ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY s.weight_kg DESC, s.reps DESC, w.workout_date DESC)` ranks every set within each exercise. The heaviest lift gets rank 1; ties in weight are broken by more reps, then by the newest date.
  3. The outer query keeps only `rank_num = 1`, which is the single all-time best lift for each exercise.
  4. It also computes an estimated 1-rep max with the Epley formula: `1RM = weight * (1 + reps / 30)`.

---

### 3. Progressive Overload & Weight Deltas (Window Function: `LAG()`)

```sql
WITH session_summaries AS (
    SELECT 
        w.workout_date,
        MAX(s.weight_kg) AS top_weight_kg,
        ROUND(SUM(s.reps * s.weight_kg), 2) AS session_volume,
        COUNT(s.id) AS total_sets
    FROM workouts w
    JOIN workout_sets s ON w.id = s.workout_id
    WHERE w.user_id = :user_id AND s.exercise_id = :exercise_id
    GROUP BY w.id, w.workout_date
)
SELECT 
    workout_date,
    top_weight_kg,
    session_volume,
    total_sets,
    LAG(top_weight_kg, 1) OVER (ORDER BY workout_date ASC) AS prev_weight_kg,
    ROUND(top_weight_kg - COALESCE(LAG(top_weight_kg, 1) OVER (ORDER BY workout_date ASC), top_weight_kg), 2) AS weight_diff
FROM session_summaries
ORDER BY workout_date ASC;
```

* **Plain English Explanation**:
  1. Finds the heaviest weight lifted for one exercise in each workout session.
  2. `LAG(top_weight_kg, 1) OVER (ORDER BY workout_date ASC)` looks back one row in the date-ordered list to get the previous session's weight.
  3. Subtracting the two gives the change between sessions (for example `+2.5 kg`), which shows progressive overload without a self-join.

---

### 4. Workout Streaks (The "Gaps & Islands" Problem)

```sql
WITH user_dates AS (
    SELECT DISTINCT workout_date
    FROM workouts
    WHERE user_id = :user_id
),
numbered_dates AS (
    SELECT 
        workout_date,
        DATE_SUB(workout_date, INTERVAL ROW_NUMBER() OVER (ORDER BY workout_date ASC) DAY) AS island_id
    FROM user_dates
),
streak_islands AS (
    SELECT 
        MIN(workout_date) AS streak_start,
        MAX(workout_date) AS streak_end,
        COUNT(*) AS streak_days
    FROM numbered_dates
    GROUP BY island_id
)
SELECT 
    streak_start,
    streak_end,
    streak_days
FROM streak_islands
ORDER BY streak_end DESC;
```

* **Plain English Explanation**:
  1. **Step 1 (`user_dates`)**: Gets the distinct calendar dates on which the user worked out.
  2. **Step 2 (`numbered_dates`)**: Numbers those dates 1, 2, 3... in order, then subtracts that number of days from each date: `island_id = workout_date - ROW_NUMBER() days`.
     **The key idea**: on consecutive days (for example Nov 2, Nov 3, Nov 4), the date goes up by 1 and the row number goes up by 1, so the subtraction gives the same `island_id` every time. When a day is skipped, the date jumps ahead but the row number only goes up by 1, so the result changes and a new `island_id` starts.
  3. **Step 3 (`streak_islands`)**: Grouping by `island_id` turns each unbroken streak into one row, with `COUNT(*)` as the streak length.
  4. The API uses the longest island as the all-time best streak, and checks whether the latest island ends today or yesterday to decide if a streak is currently active.

---

### 5. Dynamic Goal Progress (Correlated Subqueries & `CASE`)

```sql
SELECT 
    g.id AS goal_id,
    g.goal_type,
    CAST(g.target_value AS DECIMAL(10,2)) AS target_value,
    g.start_date,
    g.target_date,
    g.status,
    e.id AS exercise_id,
    e.name AS exercise_name,
    CASE 
        WHEN g.goal_type = 'exercise_weight' THEN (
            SELECT COALESCE(MAX(s.weight_kg), 0.00)
            FROM workout_sets s
            JOIN workouts w ON s.workout_id = w.id
            WHERE w.user_id = g.user_id AND s.exercise_id = g.exercise_id
        )
        WHEN g.goal_type = 'weekly_workouts' THEN (
            SELECT COUNT(DISTINCT w.id)
            FROM workouts w
            WHERE w.user_id = g.user_id 
              AND w.workout_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
        )
        ELSE 0.00
    END AS current_value
FROM goals g
LEFT JOIN exercises e ON g.exercise_id = e.id
WHERE g.user_id = :user_id
ORDER BY g.status ASC, g.id DESC;
```

* **Plain English Explanation**:
  * Progress is calculated live instead of being stored in a `current_value` column, so it can never get out of sync with the workout data. A `CASE` expression picks the calculation by goal type:
    * `exercise_weight`: a correlated subquery finds the maximum weight ever lifted for that exercise.
    * `weekly_workouts`: a correlated subquery counts distinct workouts since the Monday of the current week.

---

### 6. Atomic Workout Saving (Transaction)

In [`backend/routers/workouts.py`](backend/routers/workouts.py), creating a workout with multiple sets uses one transaction:

```python
try:
    new_workout = models.Workout(user_id=current_user.id, workout_date=workout_in.workout_date, title=workout_in.title)
    db.add(new_workout)
    db.flush()  # Generates new_workout.id

    for s in workout_in.sets:
        # Validates exercise existence and constraints
        new_set = models.WorkoutSet(workout_id=new_workout.id, exercise_id=s.exercise_id, ...)
        db.add(new_set)

    db.commit()  # Commits all sets and header together
except Exception as e:
    db.rollback()  # Aborts entire transaction on error
    raise HTTPException(status_code=400, detail=str(e))
```

* **Why it matters**: The workout and all of its sets are saved together or not at all (atomicity). If set #4 violates a constraint (for example an invalid exercise ID or negative reps), the whole workout is rolled back, so no empty workout header is left behind.

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Registers a new user and returns JWT | No |
| **POST** | `/api/auth/login` | JSON login for React UI (returns JWT) | No |
| **POST** | `/api/auth/token` | Form-encoded login for Swagger `/docs` | No |
| **GET** | `/api/auth/me` | Returns current user profile | Yes |
| **GET** | `/api/exercises` | List exercise catalog grouped by category | No |
| **POST** | `/api/exercises` | Create a custom exercise | Yes |
| **GET** | `/api/workouts` | List workouts for authenticated user | Yes |
| **POST** | `/api/workouts` | **Transaction**: create workout with sets | Yes |
| **GET** | `/api/workouts/{id}` | Get workout details (user isolated) | Yes |
| **DELETE**| `/api/workouts/{id}` | Delete workout session and cascade sets | Yes |
| **GET** | `/api/analytics/weekly-stats` | **SQL view**: weekly volume and workouts | Yes |
| **GET** | `/api/analytics/personal-records` | **Window function**: PRs via `ROW_NUMBER()` | Yes |
| **GET** | `/api/analytics/exercise-history/{id}` | **Window function**: progression via `LAG()` | Yes |
| **GET** | `/api/analytics/streak` | **Gaps & islands**: active and best streaks | Yes |
| **GET** | `/api/analytics/goals-progress` | **Subqueries**: live goal progress | Yes |
| **GET** | `/api/analytics/dashboard-summary` | Aggregate KPI card totals | Yes |
| **GET** | `/api/goals` | List user goals | Yes |
| **POST** | `/api/goals` | Create a new fitness goal | Yes |
| **PUT** | `/api/goals/{id}` | Update goal status or target | Yes |
| **DELETE**| `/api/goals/{id}` | Delete a goal | Yes |
| **GET** | `/api/nutrition` | List food logs (persisted in MySQL) | Yes |
| **POST** | `/api/nutrition` | Log a food entry | Yes |
| **DELETE**| `/api/nutrition/{id}` | Delete a food entry | Yes |

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**
- **MySQL 8.0+**

---

### 2. Database Initialization

You have two options to initialize the MySQL database:

#### Option A: One-Command Python Script (Recommended for Windows/PowerShell)
1. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and set `DB_PASSWORD` to your local MySQL root password.
2. Run:
   ```bash
   cd backend
   python init_db.py
   ```
   *This creates the database, applies `schema.sql`, and loads `seed.sql`.*

#### Option B: Native MySQL CLI / PowerShell
In PowerShell, use `Get-Content` with a pipe (PowerShell does not support `<` redirection):
```powershell
# 1. Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS fitness_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Apply schema and seed data
Get-Content backend\schema.sql | mysql -u root -p fitness_tracker
Get-Content backend\seed.sql | mysql -u root -p fitness_tracker
```

---

### 3. Backend Setup (FastAPI)

1. Open a terminal in `/backend`:
   ```bash
   cd backend
   ```
2. (Optional) Create a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment in `backend/.env` (copy it from `.env.example`):
   ```ini
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=fitness_tracker
   JWT_SECRET_KEY=replace-with-a-long-random-string
   ```
   Generate a secure secret key with:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   * Swagger interactive API docs will be available at: `http://localhost:8000/docs`

---

### 4. Frontend Setup (React + Vite)

1. Open a separate terminal in the project root:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser to: `http://localhost:5173`

---

## 👥 Demo Accounts (Pre-Seeded for Quick Testing)

Both accounts use the password: `password123`.

| Username | Email | Purpose | Pre-Seeded Data |
| :--- | :--- | :--- | :--- |
| **`demouser`** | `demo@fitnesstracker.com` | Primary demo account | 4 weeks of workouts, a 4-day streak, Bench/Squat/Deadlift PRs, goals, and nutrition logs |
| **`alex_fit`** | `alex@fitnesstracker.com` | Data isolation check | Separate workouts and goals, to confirm each user only sees their own data |

> **Note**: The seed workout dates are fixed (Oct 13 to Nov 5, 2026), so the *current* streak and this week's goal progress will show 0 after those dates. Personal records, weekly volume and the best streak are not affected.

> **Demo tip**: Use the **`[SWITCH TO @alex_fit]`** button in the app header to see that each user's data is isolated.
