-- ============================================================================
-- FITNESS TRACKER - SEED DATA
-- Realistic multi-week workout and fitness data for testing analytics, PRs,
-- weekly volume aggregations, streaks, and user data isolation.
-- ============================================================================

-- Disable foreign key checks for clean truncation and insertion
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE workout_sets;
TRUNCATE TABLE workouts;
TRUNCATE TABLE goals;
TRUNCATE TABLE nutrition_logs;
TRUNCATE TABLE exercises;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. USERS
-- Both accounts have password: "password123" (hashed via bcrypt)
-- ----------------------------------------------------------------------------
INSERT INTO users (id, username, email, password_hash, created_at) VALUES
(1, 'demouser', 'demo@fitnesstracker.com', '$2b$12$3Y9UFOn.blIj1M7W3C2S.eOVM16AGMdbET8Hz85ffS8mhQILvM4GS', '2026-10-01 08:00:00'),
(2, 'alex_fit', 'alex@fitnesstracker.com', '$2b$12$3Y9UFOn.blIj1M7W3C2S.eOVM16AGMdbET8Hz85ffS8mhQILvM4GS', '2026-10-05 09:30:00');

-- ----------------------------------------------------------------------------
-- 2. EXERCISE CATALOG
-- Standard exercises categorized by muscle group
-- ----------------------------------------------------------------------------
INSERT INTO exercises (id, name, category, description) VALUES
(1,  'Barbell Bench Press',      'Chest',     'Compound chest press with Olympic barbell'),
(2,  'Incline Dumbbell Press',   'Chest',     'Upper pectoral dumbbell press at 30 degree incline'),
(3,  'Barbell Back Squat',       'Legs',      'Full compound barbell squat below parallel'),
(4,  'Romanian Deadlift',        'Legs',      'Hip-hinge hamstring and posterior chain exercise'),
(5,  'Conventional Deadlift',    'Back',      'Full body posterior compound pull from floor'),
(6,  'Pull-Up',                  'Back',      'Bodyweight / weighted vertical lat pull'),
(7,  'Barbell Bent-Over Row',    'Back',      'Horizontal compound row targeting latissimus and rhomboids'),
(8,  'Overhead Press',           'Shoulders', 'Standing barbell strict overhead military press'),
(9,  'Dumbbell Lateral Raise',   'Shoulders', 'Isolation movement for lateral deltoid heads'),
(10, 'Barbell Bicep Curl',       'Arms',      'Standing barbell curl for biceps brachii'),
(11, 'Tricep Rope Pushdown',     'Arms',      'Cable pushdown targeting the lateral tricep head'),
(12, 'Hanging Leg Raise',        'Core',      'Abdominal flexion movement on pull-up bar');

-- ----------------------------------------------------------------------------
-- 3. WORKOUTS (User 1 - demouser)
-- 4 distinct weeks demonstrating:
-- - Weekly volume progression (Weeks 42, 43, 44, 45)
-- - 4-day active workout streak (2026-11-02 to 2026-11-05)
-- - Progressive overload on Bench Press, Squat, and Deadlift
-- ----------------------------------------------------------------------------
INSERT INTO workouts (id, user_id, workout_date, title, notes) VALUES
-- Week 42 (Oct 12 - Oct 18, 2026)
(1, 1, '2026-10-13', 'Push Day A',  'Chest and Shoulders hyper-focus. Felt energized.'),
(2, 1, '2026-10-15', 'Pull Day A',  'Heavy deadlifts and vertical pulling.'),
(3, 1, '2026-10-17', 'Leg Day A',   'Squat focus, good depth.'),

-- Week 43 (Oct 19 - Oct 25, 2026)
(4, 1, '2026-10-20', 'Push Day B',  'Bench progression + 2.5kg increase.'),
(5, 1, '2026-10-22', 'Pull Day B',  'Rowing and deadlifts.'),
(6, 1, '2026-10-24', 'Leg Day B',   'Squats felt smooth, hamstrings loaded.'),

-- Week 44 (Oct 26 - Nov 01, 2026)
(7, 1, '2026-10-27', 'Push Day C',  'Working up to heavy triples on bench.'),
(8, 1, '2026-10-29', 'Pull Day C',  'Deadlifts at 150kg.'),
(9, 1, '2026-10-31', 'Leg Day C',   'Heavy squat volume.'),

-- Week 45 (Nov 02 - Nov 05, 2026) -> 4 Consecutive Days (Active Streak!)
(10, 1, '2026-11-02', 'Push PR Day',     'Hit 95kg Bench Press for 3 reps! Personal record!'),
(11, 1, '2026-11-03', 'Heavy Pull Day',  'Deadlift PR at 155kg for 2 clean reps.'),
(12, 1, '2026-11-04', 'Heavy Squat Day', 'Squat PR at 125kg for 3 reps.'),
(13, 1, '2026-11-05', 'Arms & Core Day', 'Arms pump and abdominal conditioning to cap off the week.'),

-- ----------------------------------------------------------------------------
-- WORKOUTS (User 2 - alex_fit)
-- For testing data isolation (User 2 should NOT see User 1's workouts)
-- ----------------------------------------------------------------------------
(14, 2, '2026-11-03', 'Alex Push Day', 'Chest focus with dumbbells'),
(15, 2, '2026-11-05', 'Alex Leg Day',  'Moderate squats and posterior chain');

-- ----------------------------------------------------------------------------
-- 4. WORKOUT SETS
-- Individual sets linked to workouts and exercises
-- Total Volume = reps * weight_kg
-- ----------------------------------------------------------------------------
INSERT INTO workout_sets (workout_id, exercise_id, set_number, reps, weight_kg) VALUES
-- Workout 1: Push Day A (2026-10-13) - User 1
(1, 1, 1, 8,  80.00),
(1, 1, 2, 8,  80.00),
(1, 1, 3, 7,  80.00),
(1, 2, 1, 10, 26.00),
(1, 2, 2, 10, 26.00),
(1, 8, 1, 8,  45.00),
(1, 8, 2, 8,  45.00),

-- Workout 2: Pull Day A (2026-10-15) - User 1
(2, 5, 1, 5,  120.00),
(2, 5, 2, 5,  130.00),
(2, 5, 3, 4,  135.00),
(2, 6, 1, 10, 0.00),
(2, 6, 2, 8,  0.00),
(2, 7, 1, 8,  70.00),
(2, 7, 2, 8,  70.00),

-- Workout 3: Leg Day A (2026-10-17) - User 1
(3, 3, 1, 6,  100.00),
(3, 3, 2, 6,  105.00),
(3, 3, 3, 5,  110.00),
(3, 4, 1, 8,  90.00),
(3, 4, 2, 8,  90.00),

-- Workout 4: Push Day B (2026-10-20) - User 1
(4, 1, 1, 8,  82.50),
(4, 1, 2, 6,  85.00),
(4, 1, 3, 6,  85.00),
(4, 2, 1, 8,  28.00),
(4, 2, 2, 8,  28.00),
(4, 8, 1, 7,  47.50),
(4, 8, 2, 6,  47.50),

-- Workout 5: Pull Day B (2026-10-22) - User 1
(5, 5, 1, 5,  130.00),
(5, 5, 2, 4,  140.00),
(5, 5, 3, 4,  140.00),
(5, 7, 1, 8,  72.50),
(5, 7, 2, 8,  72.50),

-- Workout 6: Leg Day B (2026-10-24) - User 1
(6, 3, 1, 6,  105.00),
(6, 3, 2, 5,  110.00),
(6, 3, 3, 5,  115.00),
(6, 4, 1, 8,  95.00),
(6, 4, 2, 8,  95.00),

-- Workout 7: Push Day C (2026-10-27) - User 1
(7, 1, 1, 8,  85.00),
(7, 1, 2, 6,  87.50),
(7, 1, 3, 5,  90.00),
(7, 8, 1, 6,  50.00),
(7, 8, 2, 6,  50.00),

-- Workout 8: Pull Day C (2026-10-29) - User 1
(8, 5, 1, 5,  135.00),
(8, 5, 2, 3,  145.00),
(8, 5, 3, 2,  150.00),
(8, 6, 1, 8,  5.00),
(8, 6, 2, 7,  5.00),

-- Workout 9: Leg Day C (2026-10-31) - User 1
(9, 3, 1, 5,  110.00),
(9, 3, 2, 5,  115.00),
(9, 3, 3, 4,  120.00),

-- Workout 10: Push PR Day (2026-11-02) - User 1 Bench Press PR!
(10, 1, 1, 6,  87.50),
(10, 1, 2, 4,  92.50),
(10, 1, 3, 3,  95.00), -- All-time PR on Bench Press!
(10, 2, 1, 8,  30.00),
(10, 2, 2, 8,  30.00),

-- Workout 11: Heavy Pull Day (2026-11-03) - User 1 Deadlift PR!
(11, 5, 1, 5,  140.00),
(11, 5, 2, 3,  150.00),
(11, 5, 3, 2,  155.00), -- All-time PR on Deadlift!
(11, 7, 1, 8,  75.00),

-- Workout 12: Heavy Squat Day (2026-11-04) - User 1 Squat PR!
(12, 3, 1, 5,  115.00),
(12, 3, 2, 4,  120.00),
(12, 3, 3, 3,  125.00), -- All-time PR on Back Squat!
(12, 4, 1, 8,  100.00),

-- Workout 13: Arms & Core Day (2026-11-05) - User 1 active streak continuation!
(13, 10, 1, 10, 35.00),
(13, 10, 2, 8,  37.50),
(13, 10, 3, 6,  40.00),
(13, 11, 1, 12, 25.00),
(13, 11, 2, 10, 27.50),
(13, 11, 3, 8,  30.00),
(13, 12, 1, 15, 0.00),
(13, 12, 2, 15, 0.00),

-- Workout 14: Alex Push Day (2026-11-03) - User 2 sets
(14, 2, 1, 8,  24.00),
(14, 2, 2, 8,  24.00),
(14, 8, 1, 10, 35.00),
(14, 8, 2, 8,  40.00),

-- Workout 15: Alex Leg Day (2026-11-05) - User 2 sets
(15, 3, 1, 8,  80.00),
(15, 3, 2, 8,  85.00),
(15, 4, 1, 10, 70.00),
(15, 4, 2, 10, 70.00);

-- ----------------------------------------------------------------------------
-- 5. GOALS
-- User 1 goals + User 2 goal for data isolation testing
-- ----------------------------------------------------------------------------
INSERT INTO goals (id, user_id, goal_type, target_value, exercise_id, start_date, target_date, status) VALUES
(1, 1, 'weekly_workouts', 4.00,   NULL, '2026-10-01', '2026-12-31', 'in_progress'),
(2, 1, 'exercise_weight', 100.00, 1,    '2026-10-01', '2026-12-31', 'in_progress'), -- Bench Press 100kg
(3, 1, 'exercise_weight', 130.00, 3,    '2026-10-01', '2026-12-31', 'in_progress'), -- Squat 130kg
(4, 1, 'exercise_weight', 160.00, 5,    '2026-10-01', '2026-12-31', 'in_progress'), -- Deadlift 160kg
(5, 2, 'weekly_workouts', 3.00,   NULL, '2026-10-01', '2026-12-31', 'in_progress'); -- Alex goal

-- ----------------------------------------------------------------------------
-- 6. NUTRITION LOGS (User 1)
-- ----------------------------------------------------------------------------
INSERT INTO nutrition_logs (id, user_id, name, protein, calories, logged_date) VALUES
(1, 1, '3 Eggs',             18.00, 210, '2026-11-05'),
(2, 1, '100g Paneer',        18.00, 300, '2026-11-05'),
(3, 1, 'Chicken Breast 200g', 62.00, 330, '2026-11-05'),
(4, 1, 'Whey Protein Scoop', 24.00, 120, '2026-11-05');
