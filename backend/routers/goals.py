from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/goals", tags=["Goals"])

def format_goal_response(goal: models.Goal) -> schemas.GoalResponse:
    """Formats Goal ORM entity into Pydantic GoalResponse."""
    return schemas.GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        goal_type=goal.goal_type.value if hasattr(goal.goal_type, "value") else str(goal.goal_type),
        target_value=float(goal.target_value),
        exercise_id=goal.exercise_id,
        exercise_name=goal.exercise.name if goal.exercise else None,
        start_date=goal.start_date,
        target_date=goal.target_date,
        status=goal.status.value if hasattr(goal.status, "value") else str(goal.status),
        created_at=goal.created_at
    )

@router.get("", response_model=List[schemas.GoalResponse])
def get_goals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieves all fitness goals set by the authenticated user."""
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.user_id == current_user.id)
        .options(joinedload(models.Goal.exercise))
        .order_by(models.Goal.id.desc())
        .all()
    )
    return [format_goal_response(g) for g in goals]

@router.post("", response_model=schemas.GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal_in: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Creates a new goal (weekly_workouts frequency or exercise_weight target)."""
    # Validate goal_type
    if goal_in.goal_type not in ["weekly_workouts", "exercise_weight"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="goal_type must be either 'weekly_workouts' or 'exercise_weight'."
        )

    # If exercise_weight, validate exercise exists
    if goal_in.goal_type == "exercise_weight":
        if not goal_in.exercise_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="exercise_id is required for 'exercise_weight' goals."
            )
        exercise = db.query(models.Exercise).filter(models.Exercise.id == goal_in.exercise_id).first()
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Exercise ID {goal_in.exercise_id} not found."
            )

    new_goal = models.Goal(
        user_id=current_user.id,
        goal_type=models.GoalTypeEnum(goal_in.goal_type),
        target_value=goal_in.target_value,
        exercise_id=goal_in.exercise_id,
        start_date=goal_in.start_date,
        target_date=goal_in.target_date,
        status=models.GoalStatusEnum(goal_in.status) if goal_in.status else models.GoalStatusEnum.in_progress
    )

    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return format_goal_response(new_goal)

@router.put("/{goal_id}", response_model=schemas.GoalResponse)
def update_goal(
    goal_id: int,
    goal_update: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Updates goal status, target value, or target date."""
    goal = (
        db.query(models.Goal)
        .filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id)
        .options(joinedload(models.Goal.exercise))
        .first()
    )

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found or unauthorized."
        )

    if goal_update.target_value is not None:
        goal.target_value = goal_update.target_value
    if goal_update.status is not None:
        if goal_update.status not in ["in_progress", "completed", "abandoned"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be 'in_progress', 'completed', or 'abandoned'."
            )
        goal.status = models.GoalStatusEnum(goal_update.status)
    if goal_update.target_date is not None:
        goal.target_date = goal_update.target_date

    db.commit()
    db.refresh(goal)
    return format_goal_response(goal)

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Deletes a goal."""
    goal = (
        db.query(models.Goal)
        .filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id)
        .first()
    )

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found or unauthorized."
        )

    db.delete(goal)
    db.commit()
    return None

