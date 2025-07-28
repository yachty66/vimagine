from fastapi import APIRouter, HTTPException, BackgroundTasks
import uuid
import os
import json
from typing import List, Dict, Any
import tempfile
import asyncio
import subprocess
import httpx

# Import the S3 uploader
from s3_uploader import upload_local_file_to_s3

router = APIRouter()

# Store for tracking composition jobs
composition_jobs = {}

@router.post("/compose-video")
async def compose_video(timeline_data: Dict[str, Any], background_tasks: BackgroundTasks):
    try:
        job_id = str(uuid.uuid4())
        composition_jobs[job_id] = {
            "status": "processing", 
            "progress": 0,
            "message": "Starting composition..."
        }
        
        print(f"Starting video composition job {job_id}")
        print(f"Timeline data: {timeline_data}")
        
        # Start background composition
        background_tasks.add_task(compose_video_background, job_id, timeline_data)
        
        return {"jobId": job_id, "status": "processing"}
    
    except Exception as e:
        print(f"Error starting composition: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start video composition: {str(e)}")

@router.get("/compose-video/status/{job_id}")
async def get_composition_status(job_id: str):
    if job_id not in composition_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return composition_jobs[job_id]

async def compose_video_background(job_id: str, timeline_data: Dict[str, Any]):
    try:
        print(f"Processing composition job {job_id}")
        composition_jobs[job_id]["progress"] = 10
        composition_jobs[job_id]["message"] = "Analyzing timeline..."
        
        # Parse timeline data
        visual_items = timeline_data.get("visualTrack", [])
        audio_items = timeline_data.get("audioTrack", [])
        total_duration = timeline_data.get("duration", 60)
        
        print(f"Visual items: {len(visual_items)}, Audio items: {len(audio_items)}")
        print(f"Total duration: {total_duration}")
        
        if not visual_items:
            composition_jobs[job_id]["status"] = "failed"
            composition_jobs[job_id]["error"] = "No visual content found in timeline"
            return
        
        composition_jobs[job_id]["progress"] = 30
        composition_jobs[job_id]["message"] = "Downloading media files..."
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Created temp directory: {temp_dir}")
            
            # Download all media files
            local_files = {}
            for i, item in enumerate(visual_items):
                try:
                    local_path = await download_media_file(item["url"], temp_dir, f"item_{i}")
                    local_files[item["id"]] = {
                        "path": local_path,
                        "item": item
                    }
                    print(f"Downloaded {item['name']} to {local_path}")
                except Exception as e:
                    print(f"Failed to download {item['url']}: {str(e)}")
                    composition_jobs[job_id]["status"] = "failed"
                    composition_jobs[job_id]["error"] = f"Failed to download media: {str(e)}"
                    return
            
            composition_jobs[job_id]["progress"] = 50
            composition_jobs[job_id]["message"] = "Composing video..."
            
            # Sort items by start time
            sorted_items = sorted(visual_items, key=lambda x: x["startTime"])
            
            # Create FFmpeg command to compose timeline
            output_path = os.path.join(temp_dir, f"composed_{job_id}.mp4")
            success = await create_composed_video(sorted_items, local_files, output_path, total_duration)
            
            if not success:
                composition_jobs[job_id]["status"] = "failed"
                composition_jobs[job_id]["error"] = "Video composition failed"
                return
            
            composition_jobs[job_id]["progress"] = 80
            composition_jobs[job_id]["message"] = "Uploading composed video to S3..."
            
            # Upload the composed video to S3 using the existing uploader
            try:
                download_url = await upload_local_file_to_s3(output_path)
                print(f"Successfully uploaded composed video to S3: {download_url}")
            except Exception as e:
                print(f"Failed to upload to S3: {str(e)}")
                composition_jobs[job_id]["status"] = "failed"
                composition_jobs[job_id]["error"] = f"Failed to upload composed video: {str(e)}"
                return
            
            composition_jobs[job_id]["progress"] = 100
            composition_jobs[job_id]["status"] = "succeeded"
            composition_jobs[job_id]["downloadUrl"] = download_url
            composition_jobs[job_id]["message"] = "Composition succeeded!"
            
            print(f"Composition job {job_id} succeeded successfully")
        
    except Exception as e:
        print(f"Error in composition job {job_id}: {str(e)}")
        composition_jobs[job_id]["status"] = "failed"
        composition_jobs[job_id]["error"] = str(e)

async def download_media_file(url: str, temp_dir: str, prefix: str) -> str:
    """Download media file from URL to local temp directory"""
    try:
        # Extract file extension from URL
        file_extension = url.split('.')[-1].split('?')[0]
        local_filename = f"{prefix}.{file_extension}"
        local_path = os.path.join(temp_dir, local_filename)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                f.write(response.content)
        
        return local_path
    except Exception as e:
        print(f"Error downloading {url}: {str(e)}")
        raise

async def create_composed_video(sorted_items, local_files, output_path: str, total_duration: float) -> bool:
    """Create a composed video from timeline items using FFmpeg"""
    try:
        print(f"Creating composed video with {len(sorted_items)} items in timeline order")
        
        # Debug: Print timeline order
        for i, item in enumerate(sorted_items):
            print(f"Timeline position {i}: {item['name']} (type: {item['type']}, start: {item['startTime']}, duration: {item['duration']})")
        
        # Use a two-pass approach: first create standardized clips, then concatenate
        temp_clips = []
        
        with tempfile.TemporaryDirectory() as clip_temp_dir:
            # Process each item into a standardized clip
            for i, item in enumerate(sorted_items):
                file_info = local_files[item["id"]]
                local_path = file_info["path"]
                duration = float(item['duration'])
                
                standardized_clip = os.path.join(clip_temp_dir, f"clip_{i}.mp4")
                
                if item["type"] == "image":
                    success = await create_image_clip(local_path, standardized_clip, duration)
                else:  # video
                    success = await create_video_clip(local_path, standardized_clip, duration)
                
                if not success:
                    print(f"Failed to create standardized clip for item {i}")
                    return False
                
                temp_clips.append(standardized_clip)
                print(f"Created standardized clip {i}: {standardized_clip}")
            
            # Now concatenate all standardized clips
            success = await concatenate_clips(temp_clips, output_path)
            return success
        
    except Exception as e:
        print(f"Error in create_composed_video: {str(e)}")
        return False

async def create_image_clip(image_path: str, output_path: str, duration: float) -> bool:
    """Convert an image into a video clip with specified duration"""
    try:
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", image_path,
            "-f", "lavfi",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-t", str(duration),
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
            "-ar", "48000",
            "-ac", "2",
            "-shortest",
            output_path
        ]
        
        print(f"Creating image clip: {duration}s from {os.path.basename(image_path)}")
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if process.returncode != 0:
            print(f"Image clip creation failed: {process.stderr}")
            return False
            
        return True
        
    except Exception as e:
        print(f"Error creating image clip: {str(e)}")
        return False

async def create_video_clip(video_path: str, output_path: str, duration: float) -> bool:
    """Process a video into a standardized clip with specified duration"""
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-t", str(duration),
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
            "-ar", "48000",
            "-ac", "2",
            output_path
        ]
        
        print(f"Creating video clip: {duration}s from {os.path.basename(video_path)}")
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if process.returncode != 0:
            print(f"Video clip creation failed: {process.stderr}")
            return False
            
        return True
        
    except Exception as e:
        print(f"Error creating video clip: {str(e)}")
        return False

async def concatenate_clips(clip_paths: list, output_path: str) -> bool:
    """Concatenate multiple video clips in order"""
    try:
        if len(clip_paths) == 1:
            # Single clip - just copy it
            import shutil
            shutil.copy2(clip_paths[0], output_path)
            print(f"Single clip copied to output")
            return True
        
        # Create concat file for FFmpeg
        concat_file_path = output_path + ".concat.txt"
        
        with open(concat_file_path, 'w') as f:
            for clip_path in clip_paths:
                f.write(f"file '{clip_path}'\n")
        
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file_path,
            "-c", "copy",  # Copy streams without re-encoding
            output_path
        ]
        
        print(f"Concatenating {len(clip_paths)} clips")
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        # Clean up concat file
        try:
            os.remove(concat_file_path)
        except:
            pass
        
        if process.returncode != 0:
            print(f"Concatenation failed: {process.stderr}")
            return False
        
        # Verify output
        if not os.path.exists(output_path):
            print("Output file was not created")
            return False
            
        file_size = os.path.getsize(output_path)
        if file_size < 1000:
            print(f"Output file is too small: {file_size} bytes")
            return False
        
        print(f"Concatenation succeeded. Output: {output_path} ({file_size} bytes)")
        return True
        
    except Exception as e:
        print(f"Error concatenating clips: {str(e)}")
        return False

# Test endpoint to verify the router is working
@router.get("/test")
async def test_endpoint():
    return {"message": "Video composer is working!"}