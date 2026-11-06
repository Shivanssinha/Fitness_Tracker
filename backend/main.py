from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import engine, get_db, Base
import models
from routers import auth, exercises, workouts, goals, nutrition, analytics

# Initialize FastAPI application
app = FastAPI(
    title="Fitness Tracker Full-Stack API",
    description="Intermediate Full-Stack Fitness Tracker API with MySQL, SQLAlchemy CRUD & Raw SQL Analytics",
    version="1.0.0"
)

# Enable CORS for the React + Vite frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(goals.router)
app.include_router(nutrition.router)
app.include_router(analytics.router)

@app.get("/")
def root():
    """Root healthcheck endpoint."""
    return {
        "message": "Fitness Tracker API is online",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """
    Database connectivity probe.
    Executes a simple SELECT 1 to verify MySQL connection liveness.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
