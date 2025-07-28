from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.flux_schnell import router as flux_schnell_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include the flux_schnell router
app.include_router(
    flux_schnell_router, 
    prefix="/api/py/flux-schnell",
    tags=["flux-schnell"]
)

@app.get("/")
async def root():
    return {"message": "Hello World"}