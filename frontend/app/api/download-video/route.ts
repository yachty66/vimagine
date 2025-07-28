import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    console.log('Downloading video from:', url);

    // Fetch the video from the provided URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoDownloader/1.0)',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch video:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the content type from the original response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // Get the video data
    const videoData = await response.arrayBuffer();

    // Create the response with proper headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': 'attachment; filename="video.mp4"',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(videoData, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error in download-video:', error);
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    );
  }
}