from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/nutrition", tags=["Nutrition"])

@router.get("", response_model=List[schemas.NutritionResponse])
def get_nutrition_logs(
    logged_date: Optional[date] = Query(None, description="Filter logs by date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns nutrition food entries for the authenticated user.
    Preserves and persists the existing frontend food tracker in MySQL.
    """
    query = db.query(models.NutritionLog).filter(models.NutritionLog.user_id == current_user.id)
    if logged_date:
        query = query.filter(models.NutritionLog.logged_date == logged_date)
    
    logs = query.order_by(models.NutritionLog.id.desc()).all()
    return logs

@router.post("", response_model=schemas.NutritionResponse, status_code=status.HTTP_201_CREATED)
def create_nutrition_log(
    log_in: schemas.NutritionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Logs a food item with protein and calories."""
    entry_date = log_in.logged_date or date.today()
    new_log = models.NutritionLog(
        user_id=current_user.id,
        name=log_in.name.strip(),
        protein=log_in.protein,
        calories=log_in.calories,
        logged_date=entry_date
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nutrition_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Deletes a nutrition log entry for the authenticated user."""
    log = db.query(models.NutritionLog).filter(
        models.NutritionLog.id == log_id,
        models.NutritionLog.user_id == current_user.id
    ).first()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nutrition entry not found or unauthorized."
        )

    db.delete(log)
    db.commit()
    return None

