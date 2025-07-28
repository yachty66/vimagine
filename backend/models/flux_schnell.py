import httpx
from fastapi import APIRouter, Request, HTTPException
import uuid

router = APIRouter()

# --- API Configuration ---
RUNWARE_API_KEY = "1OHM2JDWKaIzQW1c1DB3uVqF5u5XoXyV"
RUNWARE_API_URL = "https://api.runware.ai/v1/image"
RUNWARE_MODEL_ID = "runware:101@1"

@router.post("/generate", name="generate")
async def generate(request: Request):
    """
    Ultra-minimalist generation endpoint without a Pydantic model.
    """
    # Manually get the JSON body and validate it
    data = await request.json()
    prompt = data.get("prompt")

    # Prepare the payload for the external API
    runware_payload = {
        "taskType": "imageInference",
        "taskUUID": str(uuid.uuid4()),
        "model": RUNWARE_MODEL_ID,
        "positivePrompt": prompt,
        "width": 1024,
        "height": 1024,
        "steps": 4,
        "CFGScale": 8,
    }

    headers = {
        "Authorization": f"Bearer {RUNWARE_API_KEY}",
        "Content-Type": "application/json"
    }

    # Make the request to the external API
    async with httpx.AsyncClient() as client:
        response = await client.post(
            RUNWARE_API_URL,
            json=[runware_payload],
            headers=headers,
            timeout=300
        )
        response.raise_for_status()

        result_data = response.json()
        image_url = result_data["data"][0]["imageURL"]

        return {"status": "succeeded", "result_url": image_url}


@router.get("/status/{request_id}", name="get_status")
async def get_status(request_id: str):
    """
    Simple status endpoint - since we're not tracking jobs, just return success.
    """
    return {"status": "succeeded", "result_url": ""}