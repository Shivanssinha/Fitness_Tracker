from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/workouts", tags=["Workouts"])

def format_workout_response(workout: models.Workout) -> schemas.WorkoutResponse:
    """Helper to convert a Workout ORM model with joined sets & exercise names to WorkoutResponse."""
    sets_data = []
    for s in workout.sets:
        sets_data.append(schemas.WorkoutSetResponse(
            id=s.id,
            workout_id=s.workout_id,
            exercise_id=s.exercise_id,
            exercise_name=s.exercise.name if s.exercise else None,
            set_number=s.set_number,
            reps=s.reps,
            weight_kg=float(s.weight_kg),
            created_at=s.created_at
        ))
    
    return schemas.WorkoutResponse(
        id=workout.id,
        user_id=workout.user_id,
        workout_date=workout.workout_date,
        title=workout.title,
        notes=workout.notes,
        created_at=workout.created_at,
        sets=sets_data
    )

@router.get("", response_model=List[schemas.WorkoutResponse])
def get_workouts(
    start_date: Optional[date] = Query(None, description="Filter workouts from this date"),
    end_date: Optional[date] = Query(None, description="Filter workouts up to this date"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieves all workouts for the authenticated user, ordered from newest to oldest.
    Guarantees user data isolation: queries filter strictly by current_user.id.
    Eagerly loads sets and exercises to avoid N+1 query performance problems.
    """
    query = (
        db.query(models.Workout)
        .filter(models.Workout.user_id == current_user.id)
        .options(joinedload(models.Workout.sets).joinedload(models.WorkoutSet.exercise))
    )

    if start_date:
        query = query.filter(models.Workout.workout_date >= start_date)
    if end_date:
        query = query.filter(models.Workout.workout_date <= end_date)

    workouts = query.order_by(models.Workout.workout_date.desc(), models.Workout.id.desc()).all()
    return [format_workout_response(w) for w in workouts]

@router.get("/{workout_id}", response_model=schemas.WorkoutResponse)
def get_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetches a single workout session by ID with all its sets.
    Returns 404 if the workout does not belong to the authenticated user.
    """
    workout = (
        db.query(models.Workout)
        .filter(
            models.Workout.id == workout_id,
            models.Workout.user_id == current_user.id
        )
        .options(joinedload(models.Workout.sets).joinedload(models.WorkoutSet.exercise))
        .first()
    )

    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout not found or you do not have permission to view it."
        )

    return format_workout_response(workout)

@router.post("", response_model=schemas.WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(
    workout_in: schemas.WorkoutCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Creates a new workout session with multiple sets in a single atomic database transaction.
    
    TRANSACTION RATIONALE (Interview Talking Point):
    If inserting any set fails (e.g. invalid foreign key, negative reps, duplicate set number),
    the entire transaction is rolled back via db.rollback(), leaving no orphaned workout headers.
    """
    try:
        # Step 1: Create Workout header
        new_workout = models.Workout(
            user_id=current_user.id,
            workout_date=workout_in.workout_date,
            title=workout_in.title or "Workout Session",
            notes=workout_in.notes
        )
        db.add(new_workout)
        db.flush()  # Flushes header to MySQL to generate new_workout.id

        # Step 2: Validate exercises and create each set
        for s in workout_in.sets:
            # Check foreign key validity
            exercise = db.query(models.Exercise).filter(models.Exercise.id == s.exercise_id).first()
            if not exercise:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise ID {s.exercise_id} does not exist in the exercises catalog."
                )

            new_set = models.WorkoutSet(
                workout_id=new_workout.id,
                exercise_id=s.exercise_id,
                set_number=s.set_number,
                reps=s.reps,
                weight_kg=s.weight_kg
            )
            db.add(new_set)

        # Step 3: Atomic commit
        db.commit()

        # Step 4: Re-query with joined relationships for response
        saved_workout = (
            db.query(models.Workout)
            .filter(models.Workout.id == new_workout.id)
            .options(joinedload(models.Workout.sets).joinedload(models.WorkoutSet.exercise))
            .first()
        )
        return format_workout_response(saved_workout)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database transaction aborted: {str(e)}"
        )

@router.put("/{workout_id}", response_model=schemas.WorkoutResponse)
def update_workout(
    workout_id: int,
    workout_update: schemas.WorkoutUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Updates workout metadata (title, date, notes)."""
    workout = (
        db.query(models.Workout)
        .filter(
            models.Workout.id == workout_id,
            models.Workout.user_id == current_user.id
        )
        .first()
    )

    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout not found or you do not have permission to edit it."
        )

    if workout_update.workout_date is not None:
        workout.workout_date = workout_update.workout_date
    if workout_update.title is not None:
        workout.title = workout_update.title
    if workout_update.notes is not None:
        workout.notes = workout_update.notes

    db.commit()
    db.refresh(workout)
    return format_workout_response(workout)

@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Deletes a workout session.
    Cascades deletion to workout_sets via foreign key ON DELETE CASCADE.
    """
    workout = (
        db.query(models.Workout)
        .filter(
            models.Workout.id == workout_id,
            models.Workout.user_id == current_user.id
        )
        .first()
    )

    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout not found or you do not have permission to delete it."
        )

    db.delete(workout)
    db.commit()
    return None

