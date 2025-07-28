import httpx
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from supabase import create_client, Client
import uuid
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
router = APIRouter()

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Provider API keys
PROVIDER_KEYS = {"runware": "1OHM2JDWKaIzQW1c1DB3uVqF5u5XoXyV"}

async def get_model_config(model_name: str):
    """Loads a model's full configuration from Supabase."""
    response = supabase.table('models').select('*').eq('name', model_name).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    return response.data

async def poll_runware_async_task(task_uuid: str, max_attempts: int = 60):
    """Poll Runware API for async task completion using getResponse"""
    headers = {"Authorization": f"Bearer {PROVIDER_KEYS['runware']}", "Content-Type": "application/json"}
    
    for attempt in range(max_attempts):
        try:
            # Use exactly the same payload as your successful curl
            poll_payload = [{"taskType": "getResponse", "taskUUID": task_uuid}]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.runware.ai/v1",  # Same URL
                    json=poll_payload, 
                    headers=headers, 
                    timeout=30
                )
                response.raise_for_status()
                result = response.json()
                
                print(f"Polling attempt {attempt + 1}: {result}")
                
                # Check exactly like your curl response
                if result.get("data") and len(result["data"]) > 0:
                    task_data = result["data"][0]
                    if task_data.get("status") == "success" and task_data.get("videoURL"):
                        return task_data["videoURL"]
                
                # Check for errors
                if result.get("errors") and len(result["errors"]) > 0:
                    error = result["errors"][0]
                    raise Exception(f"Task failed: {error.get('message', 'Unknown error')}")
                
                # If still processing, wait and try again
                await asyncio.sleep(5)
                
        except httpx.HTTPError as e:
            print(f"Polling attempt {attempt + 1} failed: {e}")
            if attempt == max_attempts - 1:
                raise Exception(f"Failed to poll task status: {e}")
            await asyncio.sleep(5)
    
    raise Exception("Task timeout - no result after maximum attempts")

async def run_async_job(job_id: str, model_name: str, prompt: str, model_config: dict, extra_params: dict):
    """Background task for async models that need polling"""
    try:
        # Start the generation task
        api_config = model_config['api_config']
        task_uuid = str(uuid.uuid4())
        
        payload = api_config.get('default_params', {}).copy()
        payload.update({
            "taskType": api_config['task_type'],
            "taskUUID": task_uuid,
            "model": api_config['model_id'],
            "positivePrompt": prompt,
            # Remove deliveryMethod - not needed according to your curl
            **{k: v for k, v in extra_params.items() if k != 'prompt'}
        })
        
        headers = {
            "Authorization": f"Bearer {PROVIDER_KEYS[api_config['provider']]}",
            "Content-Type": "application/json"
        }
        
        # Submit the task - use the main Runware endpoint
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.runware.ai/v1",  # Same URL as your successful curl
                json=[payload], 
                headers=headers, 
                timeout=60
            )
            response.raise_for_status()
            
            submit_result = response.json()
            print(f"Runware submission result: {submit_result}")
            
            # Check for immediate errors
            if submit_result.get("errors"):
                error = submit_result["errors"][0]
                raise Exception(f"Submission failed: {error.get('message', 'Unknown error')}")
        
        # Now poll for the result
        result_url = await poll_runware_async_task(task_uuid)
        
        # Job succeeded
        supabase.table('jobs').update({
            'status': 'succeeded', 
            'result_url': result_url
        }).eq('id', job_id).execute()
        
    except Exception as e:
        print(f"Async job {job_id} failed: {e}")
        supabase.table('jobs').update({
            'status': 'failed', 
            'error_message': str(e)
        }).eq('id', job_id).execute()

async def call_model_api_sync(prompt: str, model_config: dict, extra_params: dict):
    """For sync models that return results immediately"""
    api_config = model_config['api_config']
    payload = api_config.get('default_params', {}).copy()
    payload.update({
        "taskType": api_config['task_type'],
        "taskUUID": str(uuid.uuid4()),
        "model": api_config['model_id'],
        "positivePrompt": prompt,
        # Don't add deliveryMethod for sync models
        **{k: v for k, v in extra_params.items() if k != 'prompt'}
    })
    
    headers = {
        "Authorization": f"Bearer {PROVIDER_KEYS[api_config['provider']]}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            api_config['base_url'], 
            json=[payload], 
            headers=headers, 
            timeout=300
        )
        response.raise_for_status()
        result_data = response.json()
        
        # For sync models, expect immediate result
        response_field = api_config.get('response_field', 'imageURL')
        result_url = (result_data["data"][0].get(response_field) or 
                     result_data["data"][0].get("imageURL") or 
                     result_data["data"][0].get("videoURL"))
        
        if not result_url:
            raise Exception("No result URL in provider response")
        return result_url

@router.post("/generate/{model_name}", name="generate")
async def generate(model_name: str, request: Request, background_tasks: BackgroundTasks):
    """Handles both synchronous and asynchronous model generation."""
    data = await request.json()
    prompt = data.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    model_config = await get_model_config(model_name)

    if model_config.get('is_async'):
        # --- ASYNC FLOW (Video models) ---
        new_job = supabase.table('jobs').insert({
            'model_name': model_name,
            'status': 'processing'
        }).execute().data[0]
        job_id = new_job['id']
        
        # Start background task
        background_tasks.add_task(run_async_job, job_id, model_name, prompt, model_config, data)
        
        return {"status": "processing", "job_id": job_id}
    else:
        # --- SYNC FLOW (Image models) ---
        result_url = await call_model_api_sync(prompt, model_config, data)
        return {"status": "succeeded", "result_url": result_url}

@router.get("/status/{job_id}", name="get_status")
async def get_status(job_id: str):
    """Checks the status of an asynchronous job."""
    response = supabase.table('jobs').select('status, result_url, error_message').eq('id', job_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return response.data