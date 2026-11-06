from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/exercises", tags=["Exercises"])

@router.get("", response_model=List[schemas.ExerciseResponse])
def get_exercises(db: Session = Depends(get_db)):
    """
    Returns the complete catalog of physical exercises sorted by category and name.
    Publicly accessible so workout logging dropdowns can load without blocking.
    """
    exercises = db.query(models.Exercise).order_by(
        models.Exercise.category.asc(), 
        models.Exercise.name.asc()
    ).all()
    return exercises

@router.get("/{exercise_id}", response_model=schemas.ExerciseResponse)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Returns a single exercise by ID."""
    exercise = db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise with ID {exercise_id} not found."
        )
    return exercise

@router.post("", response_model=schemas.ExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_exercise(
    exercise_in: schemas.ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Allows an authenticated user to add a new custom exercise."""
    existing = db.query(models.Exercise).filter(
        models.Exercise.name.ilike(exercise_in.name.strip())
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An exercise named '{exercise_in.name}' already exists."
        )

    new_exercise = models.Exercise(
        name=exercise_in.name.strip(),
        category=exercise_in.category.strip(),
        description=exercise_in.description
    )
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return new_exercise

