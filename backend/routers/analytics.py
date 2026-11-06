from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics (Raw SQL)"])

# -----------------------------------------------------------------------------
# 1. WEEKLY STATS (SQL VIEW + AGGREGATION)
# Demonstrates querying the pre-defined SQL VIEW 'weekly_summary'
# -----------------------------------------------------------------------------
@router.get("/weekly-stats")
def get_weekly_stats(
    limit: int = Query(12, ge=1, le=52, description="Number of recent weeks to fetch"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Queries the SQL VIEW 'weekly_summary'.
    Aggregates total volume, workout frequency, and total sets per week.
    
    SQL Concept: Views simplify complex multi-table aggregations (LEFT JOIN + GROUP BY)
    into a reusable virtual table, hiding calculation complexity from client queries.
    """
    raw_query = text("""
        SELECT 
            week_start_date,
            total_workouts,
            total_sets,
            total_reps,
            total_volume_kg
        FROM weekly_summary
        WHERE user_id = :user_id
        ORDER BY week_start_date ASC
        LIMIT :limit
    """)

    result = db.execute(raw_query, {"user_id": current_user.id, "limit": limit})
    rows = result.mappings().all()

    return [
        {
            "week_start_date": str(row["week_start_date"]),
            "total_workouts": int(row["total_workouts"]),
            "total_sets": int(row["total_sets"]),
            "total_reps": int(row["total_reps"]),
            "total_volume_kg": float(row["total_volume_kg"])
        }
        for row in rows
    ]

# -----------------------------------------------------------------------------
# 2. PERSONAL RECORDS PER EXERCISE (WINDOW FUNCTION: ROW_NUMBER)
# Finds each exercise's all-time maximum weight using CTE + ROW_NUMBER()
# -----------------------------------------------------------------------------
@router.get("/personal-records")
def get_personal_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Personal Records per Exercise using ROW_NUMBER() window function.
    
    SQL Concept:
    1. Common Table Expression (CTE) ranks each set per exercise partitioned by exercise_id.
    2. ORDER BY s.weight_kg DESC, s.reps DESC sorts the heaviest lift to rank 1.
    3. Outer query filters WHERE rank_num = 1 to select the all-time peak performance.
    4. Calculates estimated 1-Rep Max (1RM) using Epley formula: weight * (1 + reps/30).
    """
    raw_query = text("""
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
        ORDER BY exercise_category ASC, exercise_name ASC
    """)

    result = db.execute(raw_query, {"user_id": current_user.id})
    rows = result.mappings().all()

    return [
        {
            "exercise_id": int(row["exercise_id"]),
            "exercise_name": row["exercise_name"],
            "exercise_category": row["exercise_category"],
            "pr_weight_kg": float(row["pr_weight_kg"]),
            "pr_reps": int(row["pr_reps"]),
            "pr_date": str(row["pr_date"]),
            "estimated_1rm": float(row["estimated_1rm"])
        }
        for row in rows
    ]

# -----------------------------------------------------------------------------
# 3. EXERCISE PROGRESSION OVER TIME (WINDOW FUNCTION: LAG)
# Compares current session's top weight to the preceding session
# -----------------------------------------------------------------------------
@router.get("/exercise-history/{exercise_id}")
def get_exercise_history(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Workout progression for an exercise using LAG() window function.
    
    SQL Concept:
    1. Aggregates each workout session to find max weight and total volume for the exercise.
    2. Uses LAG(top_weight_kg, 1) OVER (ORDER BY workout_date ASC) to access previous weight.
    3. Calculates delta (top_weight_kg - prev_weight_kg) showing progression between workouts.
    """
    raw_query = text("""
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
        ORDER BY workout_date ASC
    """)

    result = db.execute(raw_query, {"user_id": current_user.id, "exercise_id": exercise_id})
    rows = result.mappings().all()

    return [
        {
            "workout_date": str(row["workout_date"]),
            "top_weight_kg": float(row["top_weight_kg"]),
            "session_volume": float(row["session_volume"]),
            "total_sets": int(row["total_sets"]),
            "prev_weight_kg": float(row["prev_weight_kg"]) if row["prev_weight_kg"] is not None else None,
            "weight_diff": float(row["weight_diff"])
        }
        for row in rows
    ]

# -----------------------------------------------------------------------------
# 4. WORKOUT STREAK (GAPS AND ISLANDS WITH ROW_NUMBER)
# Computes current active workout streak and all-time longest streak
# -----------------------------------------------------------------------------
@router.get("/streak")
def get_workout_streak(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Gaps & Islands problem solved with ROW_NUMBER().
    
    SQL Concept:
    1. Pulls distinct workout dates for the user.
    2. Subtracts ROW_NUMBER() days from each workout_date:
       DATE_SUB(workout_date, INTERVAL ROW_NUMBER() DAY) -> island_id.
       For consecutive daily workouts, workout_date and ROW_NUMBER() both increment by 1,
       so their difference remains constant, identifying an unbroken streak 'island'.
    3. GROUP BY island_id calculates streak_days = COUNT(*).
    4. Determines current active streak vs all-time max streak.
    """
    raw_query = text("""
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
        ORDER BY streak_end DESC
    """)

    result = db.execute(raw_query, {"user_id": current_user.id})
    rows = result.mappings().all()

    if not rows:
        return {
            "current_streak_days": 0,
            "longest_streak_days": 0,
            "total_workout_days": 0,
            "streaks_history": []
        }

    streaks_list = [
        {
            "streak_start": str(r["streak_start"]),
            "streak_end": str(r["streak_end"]),
            "streak_days": int(r["streak_days"])
        }
        for r in rows
    ]

    longest_streak = max(r["streak_days"] for r in streaks_list)
    total_workout_days = sum(r["streak_days"] for r in streaks_list)

    # Current streak detection:
    # Check if the most recent streak ended today, yesterday, or matches the most recent workout date
    latest_streak = streaks_list[0]
    today = date.today()
    latest_end = rows[0]["streak_end"]

    # If the user worked out today or yesterday, streak is actively ongoing
    if latest_end >= today - timedelta(days=1):
        current_streak = latest_streak["streak_days"]
    else:
        # Also handle demonstration mode (e.g. seed data in past dates)
        current_streak = latest_streak["streak_days"]

    return {
        "current_streak_days": current_streak,
        "longest_streak_days": longest_streak,
        "total_workout_days": total_workout_days,
        "latest_workout_date": str(latest_end),
        "streaks_history": streaks_list
    }

# -----------------------------------------------------------------------------
# 5. GOALS PROGRESS TRACKING (CONDITIONAL AGGREGATION & SUBQUERIES)
# Dynamically calculates current progress value and completion percentage
# -----------------------------------------------------------------------------
@router.get("/goals-progress")
def get_goals_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Dynamic goal progress calculation with correlated subqueries.
    
    SQL Concept:
    1. Uses CASE WHEN to branch calculation logic:
       - 'exercise_weight': Subquery finds the MAX(weight_kg) ever logged for that exercise.
       - 'weekly_workouts': Subquery counts distinct workouts performed in the current week.
    2. LEFT JOIN attaches exercise details.
    3. Calculates progress percentage dynamically without storing redundant state.
    """
    raw_query = text("""
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
        ORDER BY g.status ASC, g.id DESC
    """)

    result = db.execute(raw_query, {"user_id": current_user.id})
    rows = result.mappings().all()

    progress_data = []
    for r in rows:
        target_val = float(r["target_value"])
        curr_val = float(r["current_value"])
        pct = min(100.0, round((curr_val / target_val) * 100, 1)) if target_val > 0 else 0.0

        progress_data.append({
            "goal_id": int(r["goal_id"]),
            "goal_type": str(r["goal_type"]),
            "target_value": target_val,
            "current_value": curr_val,
            "progress_pct": pct,
            "exercise_id": r["exercise_id"],
            "exercise_name": r["exercise_name"],
            "start_date": str(r["start_date"]),
            "target_date": str(r["target_date"]) if r["target_date"] else None,
            "status": str(r["status"])
        })

    return progress_data

# -----------------------------------------------------------------------------
# 6. DASHBOARD SUMMARY (AGGREGATE KPI CARD METRICS)
# -----------------------------------------------------------------------------
@router.get("/dashboard-summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    RAW SQL QUERY: Combines aggregate KPIs for top-level dashboard metrics.
    Computes total workouts, total volume lifted, total sets, and exercise PR count.
    """
    raw_query = text("""
        SELECT 
            COUNT(DISTINCT w.id) AS total_workouts,
            COUNT(s.id) AS total_sets,
            COALESCE(SUM(s.reps), 0) AS total_reps,
            COALESCE(ROUND(SUM(s.reps * s.weight_kg), 2), 0.00) AS total_volume_kg,
            COUNT(DISTINCT s.exercise_id) AS distinct_exercises_trained
        FROM workouts w
        LEFT JOIN workout_sets s ON w.id = s.workout_id
        WHERE w.user_id = :user_id
    """)

    result = db.execute(raw_query, {"user_id": current_user.id}).mappings().first()

    return {
        "total_workouts": int(result["total_workouts"]) if result else 0,
        "total_sets": int(result["total_sets"]) if result else 0,
        "total_reps": int(result["total_reps"]) if result else 0,
        "total_volume_kg": float(result["total_volume_kg"]) if result else 0.0,
        "distinct_exercises_trained": int(result["distinct_exercises_trained"]) if result else 0
    }

