import os
import boto3
import httpx
from botocore.exceptions import NoCredentialsError, PartialCredentialsError
from fastapi import HTTPException
from datetime import datetime
from dotenv import load_dotenv
import random
from urllib.parse import urlparse
import string

# Load environment variables from .env file
load_dotenv()

# --- Load AWS Credentials and S3 Configuration from Environment Variables ---
# Best practice is to use environment variables for sensitive data and configuration.
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1") # Default to us-east-1 if not set

# --- Basic Configuration Check ---
if not all([S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY]):
    raise ValueError(
        "S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set in environment variables."
    )

# --- Initialize S3 Client ---
try:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
    )
except (NoCredentialsError, PartialCredentialsError) as e:
    print(f"Error initializing S3 client: {e}")
    raise

async def upload_video_to_s3(video_url: str) -> str:
    """
    Downloads a video from a URL, then uploads it to an S3 bucket.
    Returns the final S3 URL.
    """
    try:
        # Determine file extension from URL
        parsed_url = urlparse(video_url)
        original_path = parsed_url.path
        original_extension = os.path.splitext(original_path)[1]
        
        # If no extension, default to .mp4 for backward compatibility
        if not original_extension:
            original_extension = '.mp4'

        print(f"--- 📥 Downloading {original_extension} file from: {video_url} ---")
        async with httpx.AsyncClient() as client:
            response = await client.get(video_url)
            response.raise_for_status()
            video_data = response.content
        print("--- ✅ File downloaded successfully ---")
        
        # Define a unique filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_chars = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        s3_filename = f"united-compute-{timestamp}-{random_chars}{original_extension}"
        
        print(f"--- 📤 Uploading {original_extension} file to S3 bucket '{S3_BUCKET_NAME}' as '{s3_filename}' ---")
        
        # Determine content type based on extension
        content_type = 'application/octet-stream' # Default
        if original_extension == '.mp4':
            content_type = 'video/mp4'
        elif original_extension in ['.jpg', '.jpeg']:
            content_type = 'image/jpeg'
        elif original_extension == '.png':
            content_type = 'image/png'
        elif original_extension == '.gif':
            content_type = 'image/gif'
        elif original_extension == '.webp':
            content_type = 'image/webp'
        elif original_extension == '.mp3':
            content_type = 'audio/mpeg'
        elif original_extension == '.wav':
            content_type = 'audio/wav'

        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_filename,
            Body=video_data,
            ContentType=content_type
        )
        
        final_url = f"https://{S3_BUCKET_NAME}.s3.amazonaws.com/{s3_filename}"
        print(f"--- ✅ File uploaded successfully. Permanent download URL is: {final_url} ---")
        return final_url

    except Exception as e:
        print(f"--- ❌ Error in upload_video_to_s3: {e} ---")
        raise e

async def upload_local_file_to_s3(local_path: str) -> str:
    """
    Upload a local file to S3 and return the public URL.
    
    Args:
        local_file_path: Path to the local file to upload
        
    Returns:
        The public URL of the uploaded file in S3
    """
    try:
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_number = random.randint(1000, 9999)
        
        # Get file extension from the local file
        original_extension = os.path.splitext(local_path)[1]
        if not original_extension:
            original_extension = '.mp4'  # Default to mp4
        
        # Define a unique filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_chars = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        s3_filename = f"united-compute-{timestamp}-{random_chars}{original_extension}"

        print(f"--- 📤 Uploading local {original_extension} file to S3 bucket '{S3_BUCKET_NAME}' as '{s3_filename}' ---")
        
        # Determine content type based on extension
        content_type = 'application/octet-stream'
        if original_extension == '.mp4':
            content_type = 'video/mp4'
        elif original_extension in ['.jpg', '.jpeg']:
            content_type = 'image/jpeg'
        elif original_extension == '.png':
            content_type = 'image/png'
        elif original_extension == '.gif':
            content_type = 'image/gif'
        elif original_extension == '.webp':
            content_type = 'image/webp'
        elif original_extension == '.mp3':
            content_type = 'audio/mpeg'
        elif original_extension == '.wav':
            content_type = 'audio/wav'

        s3_client.upload_file(
            local_path, 
            S3_BUCKET_NAME, 
            s3_filename,
            ExtraArgs={'ContentType': content_type}
        )
        
        final_url = f"https://{S3_BUCKET_NAME}.s3.amazonaws.com/{s3_filename}"
        print(f"--- ✅ Local file uploaded successfully. Permanent URL: {final_url} ---")
        
        # Clean up the local file after upload
        try:
            os.remove(local_path)
            print(f"--- 🗑️ Cleaned up local file: {local_path} ---")
        except OSError as e:
            print(f"--- ⚠️ Warning: Could not remove local file {local_path}: {e} ---")
            
        return final_url
    except Exception as e:
        print(f"--- ❌ Error in upload_local_file_to_s3: {e} ---")
        raise e

if __name__ == "__main__":
    import sys
    import asyncio

    if len(sys.argv) > 2 and sys.argv[1] == 'upload_local':
        file_path = sys.argv[2]
        # Run the async function and print the result
        url = asyncio.run(upload_local_file_to_s3(file_path))
        if url:
            print(url)
    # You can add more command-line actions here if needed
    # For example, for upload_video_to_s3
    # elif len(sys.argv) > 2 and sys.argv[1] == 'upload_from_url':
    #     video_url = sys.argv[2]
    #     url = asyncio.run(upload_video_to_s3(video_url))
    #     if url:
    #         print(url)