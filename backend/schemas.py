from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

# -----------------------------------------------------------------------------
# User Schemas
# -----------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, max_length=128, description="Plaintext password")

class UserLogin(BaseModel):
    username: str = Field(..., description="Username or email address")
    password: str = Field(..., description="Plaintext password")

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Auth / Token Schemas
# -----------------------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None

# -----------------------------------------------------------------------------
# Exercise Schemas
# -----------------------------------------------------------------------------
class ExerciseBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=255)

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Workout Set Schemas
# -----------------------------------------------------------------------------
class WorkoutSetBase(BaseModel):
    exercise_id: int
    set_number: int = Field(..., gt=0, description="Must be positive (> 0)")
    reps: int = Field(..., gt=0, description="Reps performed (> 0)")
    weight_kg: float = Field(..., ge=0, description="Weight in kg (>= 0)")

class WorkoutSetCreate(WorkoutSetBase):
    pass

class WorkoutSetResponse(WorkoutSetBase):
    id: int
    workout_id: int
    exercise_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Workout Schemas
# -----------------------------------------------------------------------------
class WorkoutBase(BaseModel):
    workout_date: date
    title: str = Field("Workout Session", max_length=100)
    notes: Optional[str] = None

class WorkoutCreate(WorkoutBase):
    sets: List[WorkoutSetCreate] = Field(default_factory=list)

class WorkoutUpdate(BaseModel):
    workout_date: Optional[date] = None
    title: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class WorkoutResponse(WorkoutBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    sets: List[WorkoutSetResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Goal Schemas
# -----------------------------------------------------------------------------
class GoalBase(BaseModel):
    goal_type: str = Field(..., description="weekly_workouts or exercise_weight")
    target_value: float = Field(..., gt=0, description="Target value must be > 0")
    exercise_id: Optional[int] = None
    start_date: date
    target_date: Optional[date] = None
    status: Optional[str] = "in_progress"

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    target_value: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None
    target_date: Optional[date] = None

class GoalResponse(GoalBase):
    id: int
    user_id: int
    exercise_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Nutrition Schemas (persisting existing frontend)
# -----------------------------------------------------------------------------
class NutritionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    protein: float = Field(..., ge=0)
    calories: int = Field(..., ge=0)
    logged_date: Optional[date] = None

class NutritionResponse(BaseModel):
    id: int
    user_id: int
    name: str
    protein: float
    calories: int
    logged_date: date
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
