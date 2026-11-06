import enum
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime,
    Numeric, ForeignKey, Enum as SQLEnum,
    UniqueConstraint, CheckConstraint, Index, func
)
from sqlalchemy.orm import relationship
from database import Base

# -----------------------------------------------------------------------------
# Enums matching schema.sql definitions
# -----------------------------------------------------------------------------
class GoalTypeEnum(str, enum.Enum):
    weekly_workouts = "weekly_workouts"
    exercise_weight = "exercise_weight"

class GoalStatusEnum(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"

# -----------------------------------------------------------------------------
# 1. USER MODEL
# Matches users table in schema.sql
# -----------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # ORM Relationships
    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    nutrition_logs = relationship("NutritionLog", back_populates="user", cascade="all, delete-orphan")

# -----------------------------------------------------------------------------
# 2. EXERCISE MODEL
# Matches exercises table in schema.sql
# -----------------------------------------------------------------------------
class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    workout_sets = relationship("WorkoutSet", back_populates="exercise")
    goals = relationship("Goal", back_populates="exercise")

# -----------------------------------------------------------------------------
# 3. WORKOUT MODEL
# Matches workouts table in schema.sql
# -----------------------------------------------------------------------------
class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workout_date = Column(Date, nullable=False)
    title = Column(String(100), nullable=False, default="Workout Session")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Composite Index: fast lookup of a user's workouts ordered by date
    __table_args__ = (
        Index("idx_workouts_user_date", "user_id", "workout_date"),
    )

    # Relationships
    user = relationship("User", back_populates="workouts")
    sets = relationship(
        "WorkoutSet", 
        back_populates="workout", 
        cascade="all, delete-orphan",
        order_by="WorkoutSet.set_number"
    )

# -----------------------------------------------------------------------------
# 4. WORKOUT SET MODEL
# Matches workout_sets table in schema.sql
# -----------------------------------------------------------------------------
class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workout_id = Column(Integer, ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="RESTRICT"), nullable=False, index=True)
    set_number = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    weight_kg = Column(Numeric(6, 2), nullable=False, default=0.00)
    created_at = Column(DateTime, server_default=func.now())

    # Constraints and Indexes matching schema.sql
    __table_args__ = (
        UniqueConstraint("workout_id", "exercise_id", "set_number", name="uq_workout_exercise_set"),
        CheckConstraint("set_number > 0", name="chk_set_number"),
        CheckConstraint("reps > 0", name="chk_reps"),
        CheckConstraint("weight_kg >= 0", name="chk_weight_kg"),
        Index("idx_sets_exercise_weight", "exercise_id", "weight_kg"),
    )

    # Relationships
    workout = relationship("Workout", back_populates="sets")
    exercise = relationship("Exercise", back_populates="workout_sets")

# -----------------------------------------------------------------------------
# 5. GOAL MODEL
# Matches goals table in schema.sql
# -----------------------------------------------------------------------------
class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_type = Column(
        SQLEnum(GoalTypeEnum, values_callable=lambda obj: [e.value for e in obj]), 
        nullable=False
    )
    target_value = Column(Numeric(10, 2), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True)
    start_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=True)
    status = Column(
        SQLEnum(GoalStatusEnum, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False, 
        default=GoalStatusEnum.in_progress
    )
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("target_value > 0", name="chk_target_value"),
        Index("idx_goals_user_status", "user_id", "status"),
    )

    # Relationships
    user = relationship("User", back_populates="goals")
    exercise = relationship("Exercise", back_populates="goals")

# -----------------------------------------------------------------------------
# 6. NUTRITION LOG MODEL
# Matches nutrition_logs table in schema.sql (preserves frontend food tracker)
# -----------------------------------------------------------------------------
class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    protein = Column(Numeric(6, 2), nullable=False, default=0.00)
    calories = Column(Integer, nullable=False, default=0)
    logged_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_nutrition_user_date", "user_id", "logged_date"),
    )

    # Relationships
    user = relationship("User", back_populates="nutrition_logs")

