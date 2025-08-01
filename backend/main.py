from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.dynamic_models import router as dynamic_models_router
from helpers.video_composer import router as video_composer_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include the dynamic models router
app.include_router(
    dynamic_models_router, 
    prefix="/api/models",
    tags=["models"]
)

# Include the video composer router
app.include_router(
    video_composer_router,
    prefix="/api/py/video-composer",
    tags=["video-composer"]
)

@app.get("/")
async def root():
    return {"message": "Hello World"}