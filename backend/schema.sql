-- ============================================================================
-- FITNESS TRACKER - DATABASE SCHEMA (MySQL 8.0+)
-- Source of Truth for Database Tables, Constraints, Indexes, and Views
-- ============================================================================

-- Disable foreign key checks during schema creation
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores user credentials with bcrypt password hashes
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. EXERCISES TABLE
-- Normalized catalog of physical exercises categorized by muscle group
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS exercises;
CREATE TABLE exercises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exercises_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. WORKOUTS TABLE
-- Represents a single workout session performed by a user on a given date
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS workouts;
CREATE TABLE workouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    workout_date DATE NOT NULL,
    title VARCHAR(100) NOT NULL DEFAULT 'Workout Session',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workouts_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_workouts_user_date (user_id, workout_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. WORKOUT_SETS TABLE
-- Detailed set-level entries (reps, weight) for each exercise in a workout
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS workout_sets;
CREATE TABLE workout_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workout_id INT NOT NULL,
    exercise_id INT NOT NULL,
    set_number INT NOT NULL,
    reps INT NOT NULL,
    weight_kg DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sets_workout FOREIGN KEY (workout_id) 
        REFERENCES workouts(id) ON DELETE CASCADE,
    CONSTRAINT fk_sets_exercise FOREIGN KEY (exercise_id) 
        REFERENCES exercises(id) ON DELETE RESTRICT,
    CONSTRAINT uq_workout_exercise_set UNIQUE (workout_id, exercise_id, set_number),
    CONSTRAINT chk_set_number CHECK (set_number > 0),
    CONSTRAINT chk_reps CHECK (reps > 0),
    CONSTRAINT chk_weight_kg CHECK (weight_kg >= 0),
    INDEX idx_sets_workout (workout_id),
    INDEX idx_sets_exercise (exercise_id),
    INDEX idx_sets_exercise_weight (exercise_id, weight_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. GOALS TABLE
-- Target goals per user (weekly frequency or 1RM weight targets)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS goals;
CREATE TABLE goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    goal_type ENUM('weekly_workouts', 'exercise_weight') NOT NULL,
    target_value DECIMAL(10, 2) NOT NULL,
    exercise_id INT NULL,
    start_date DATE NOT NULL,
    target_date DATE NULL,
    status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_goals_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_goals_exercise FOREIGN KEY (exercise_id) 
        REFERENCES exercises(id) ON DELETE SET NULL,
    CONSTRAINT chk_target_value CHECK (target_value > 0),
    INDEX idx_goals_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. NUTRITION_LOGS TABLE
-- Preserves and persists the existing frontend nutrition tracking functionality
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS nutrition_logs;
CREATE TABLE nutrition_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    protein DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    calories INT NOT NULL DEFAULT 0,
    logged_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nutrition_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_nutrition_user_date (user_id, logged_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 7. SQL VIEW: WEEKLY SUMMARY
-- Groups by user_id and Monday of each week using DATE_SUB(workout_date, INTERVAL WEEKDAY(workout_date) DAY)
-- Avoiding Year-split boundary issues around New Year.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW weekly_summary AS
SELECT 
    w.user_id,
    DATE_SUB(w.workout_date, INTERVAL WEEKDAY(w.workout_date) DAY) AS week_start_date,
    COUNT(DISTINCT w.id) AS total_workouts,
    COUNT(s.id) AS total_sets,
    COALESCE(SUM(s.reps), 0) AS total_reps,
    COALESCE(ROUND(SUM(s.reps * s.weight_kg), 2), 0.00) AS total_volume_kg
FROM workouts w
LEFT JOIN workout_sets s ON w.id = s.workout_id
GROUP BY 
    w.user_id, 
    DATE_SUB(w.workout_date, INTERVAL WEEKDAY(w.workout_date) DAY);
