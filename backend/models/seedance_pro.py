import httpx
from fastapi import APIRouter, Request, HTTPException
import uuid

router = APIRouter()

# --- API Configuration ---
RUNWARE_API_KEY = "1OHM2JDWKaIzQW1c1DB3uVqF5u5XoXyV"
RUNWARE_API_URL = "https://api.runware.ai/v1"  # Updated URL
RUNWARE_MODEL_ID = "bytedance:2@1"  # Seedance Pro model

@router.post("/generate", name="generate")
async def generate(request: Request):
    """
    Seedance Pro video generation endpoint.
    """
    # Manually get the JSON body and validate it
    data = await request.json()
    prompt = data.get("prompt")

    # Prepare the payload for Seedance Pro (video generation)
    runware_payload = {
        "taskType": "videoInference",  # Changed from imageInference
        "duration": 5,
        "fps": 24,
        "model": RUNWARE_MODEL_ID,
        "outputFormat": "mp4",
        "height": 480,
        "width": 864,
        "numberResults": 1,
        "includeCost": True,
        "providerSettings": {
            "bytedance": {
                "cameraFixed": False
            }
        },
        "positivePrompt": prompt,
    }

    headers = {
        "Authorization": f"Bearer {RUNWARE_API_KEY}",
        "Content-Type": "application/json"
    }

    # Make the request to the external API
    async with httpx.AsyncClient() as client:
        response = await client.post(
            RUNWARE_API_URL,
            json=[runware_payload],  # Still needs to be an array
            headers=headers,
            timeout=300
        )
        response.raise_for_status()

        result_data = response.json()
        # For video generation, the response might have a different structure
        # Check if it's videoURL or similar
        video_url = result_data["data"][0].get("videoURL") or result_data["data"][0].get("imageURL")

        return {"status": "succeeded", "result_url": video_url}


@router.get("/status/{request_id}", name="get_status")
async def get_status(request_id: str):
    """
    Simple status endpoint - since we're not tracking jobs, just return success.
    """
    return {"status": "succeeded", "result_url": ""}