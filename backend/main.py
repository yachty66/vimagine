from fastapi import FastAPI
from models.flux_schnell import router as flux_schnell_router

app = FastAPI()

# Include the flux_schnell router
app.include_router(
    flux_schnell_router, 
    prefix="/api/py/flux-schnell",  # This creates the endpoint path
    tags=["flux-schnell"]           # Optional: for API documentation grouping
)

@app.get("/")
async def root():
    return {"message": "Hello World"}