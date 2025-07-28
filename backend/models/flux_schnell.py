import httpx
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
import json
import os
import tempfile
import uuid
# from auth import verify_api_key
# from s3_uploader import upload_local_file_to_s3

"""
Simplified Flux Schnell Text-to-Image model router implementation.
- Uses Runware API as the provider.
- No billing, logging, or job management.
"""
router = APIRouter()

# Configuration - Runware API
RUNWARE_API_KEY = "1OHM2JDWKaIzQW1c1DB3uVqF5u5XoXyV"
RUNWARE_API_URL = "https://api.runware.ai/v1/image"
RUNWARE_MODEL_ID = "runware:101@1"

@router.post("/generate", name="generate")
async def generate(
    request: Request,
    # user_id: str = Depends(verify_api_key),
):
    """
    Simple generation endpoint - just generate and return the image.
    """
    # --- 1. Extract parameters ---
    try:
        data = await request.json()
        prompt = data.get("prompt")
        seed = data.get("seed")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not prompt:
        raise HTTPException(status_code=400, detail="A 'prompt' is required.")

    # --- 2. Generate with Runware ---
    task_uuid = str(uuid.uuid4())
    runware_payload = [{
        "taskType": "imageInference",
        "taskUUID": task_uuid,
        "model": RUNWARE_MODEL_ID,
        "positivePrompt": prompt,
        "width": 1024,
        "height": 1024,
        "steps": 30,
        "CFGScale": 8,
    }]
    if seed:
        runware_payload[0]['seed'] = int(seed)

    headers = {
        "Authorization": f"Bearer {RUNWARE_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            # Run the model
            response = await client.post(RUNWARE_API_URL, json=runware_payload, headers=headers)
            response.raise_for_status()

            # Extract the image URL from the Runware JSON response
            result_data = response.json()
            if not result_data.get("data") or not isinstance(result_data["data"], list) or len(result_data["data"]) == 0:
                raise Exception("Runware API returned no data in the expected format.")
            
            image_url = result_data["data"][0].get("imageURL")
            if not image_url:
                raise Exception("Runware API response did not contain an imageURL.")

            # The function was ending without returning a value, which results in a `null` response.
            # For testing, we can return the provider's URL directly.
            return {"status": "succeeded", "result_url": image_url}

    except httpx.HTTPStatusError as e:
        error_msg = f"Runware API Error: {e.response.status_code} - {e.response.text}"
        raise HTTPException(status_code=e.response.status_code, detail=error_msg)
    except Exception as e:
        error_message = f"Image generation failed: {str(e)}"
        raise HTTPException(status_code=500, detail=error_message)

@router.get("/status/{request_id}", name="get_status")
async def get_status(request_id: str):
    """
    Simple status endpoint - since we're not tracking jobs, just return success.
    """
    return {"status": "succeeded", "result_url": ""}