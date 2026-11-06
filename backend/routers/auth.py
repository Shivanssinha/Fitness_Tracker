from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
import models
import schemas
from auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user:
    1. Checks for duplicate username or email.
    2. Hashes password using bcrypt.
    3. Persists new user to MySQL.
    4. Issues a signed JWT access token.
    """
    # Check if username or email already exists
    existing_user = db.query(models.User).filter(
        or_(
            models.User.username == user_in.username.strip(),
            models.User.email == user_in.email.strip().lower()
        )
    ).first()

    if existing_user:
        if existing_user.username.lower() == user_in.username.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash password with bcrypt
    hashed_pwd = get_password_hash(user_in.password)

    new_user = models.User(
        username=user_in.username.strip(),
        email=user_in.email.strip().lower(),
        password_hash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create JWT access token
    access_token = create_access_token(data={"sub": str(new_user.id), "username": new_user.username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    JSON-based login endpoint for frontend applications (React):
    Accepts username or email and validates bcrypt password.
    Returns signed JWT access token and user info.
    """
    identifier = login_data.username.strip()
    user = db.query(models.User).filter(
        or_(
            models.User.username == identifier,
            models.User.email == identifier.lower()
        )
    ).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/token", response_model=schemas.Token)
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Form-based login endpoint specifically enabling FastAPI's Swagger UI (/docs)
    Authorize modal to authenticate seamlessly.
    """
    user = db.query(models.User).filter(
        or_(
            models.User.username == form_data.username.strip(),
            models.User.email == form_data.username.strip().lower()
        )
    ).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """
    Returns the currently authenticated user profile based on Bearer token in header.
    """
    return current_user

