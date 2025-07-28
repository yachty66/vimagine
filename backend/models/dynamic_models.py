import httpx
from fastapi import APIRouter, Request, HTTPException, Depends
from supabase import create_client, Client
import uuid
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

router = APIRouter()

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL", "your-supabase-url")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "your-supabase-anon-key") 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Provider API keys
PROVIDER_KEYS = {
    "runware": "1OHM2JDWKaIzQW1c1DB3uVqF5u5XoXyV"
}

@router.get("/models", name="get_models")
async def get_models(category: str = None):
    """Get available models, optionally filtered by category"""
    try:
        query = supabase.table('models').select('name, display_name, category, price, reference_image_support')
        
        if category:
            query = query.eq('category', category)
            
        response = query.execute()
        return {"models": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/{model_name}", name="generate")
async def generate(model_name: str, request: Request):
    """Generic generation endpoint that works with any configured model"""
    try:
        # Get request data
        data = await request.json()
        prompt = data.get("prompt")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        # Load model configuration from database
        model_config = await get_model_config(model_name)
        
        # Build and send API request
        result_url = await call_model_api(prompt, model_config, data)
        
        return {"status": "succeeded", "result_url": result_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def get_model_config(model_name: str):
    """Load model configuration from Supabase"""
    response = supabase.table('models').select('*').eq('name', model_name).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    return response.data

async def call_model_api(prompt: str, model_config: dict, extra_params: dict):
    """Make API call to the model provider"""
    api_config = model_config['api_config']
    
    # Build payload from default params and add required fields
    payload = api_config.get('default_params', {}).copy()
    payload.update({
        "taskType": api_config['task_type'],
        "taskUUID": str(uuid.uuid4()),
        "model": api_config['model_id'],
        "positivePrompt": prompt,
    })
    
    # Add any extra parameters from request
    for key, value in extra_params.items():
        if key not in ['prompt']:
            payload[key] = value
    
    headers = {
        "Authorization": f"Bearer {PROVIDER_KEYS[api_config['provider']]}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            api_config['base_url'],
            json=[payload],  # Runware expects array
            headers=headers,
            timeout=300
        )
        response.raise_for_status()
        
        result_data = response.json()
        
        # Extract result URL using configured field name
        response_field = api_config.get('response_field', 'imageURL')
        result_url = result_data["data"][0].get(response_field)
        
        # Fallback to common field names
        if not result_url:
            result_url = (result_data["data"][0].get("imageURL") or 
                         result_data["data"][0].get("videoURL"))
        
        if not result_url:
            raise HTTPException(status_code=500, detail="No result URL in response")
        
        return result_url