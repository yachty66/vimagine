"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Film,
  Play,
  Pause,
  Volume2,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
} from "lucide-react";

interface MediaItem {
  id: string;
  type: "video" | "image" | "audio";
  name: string;
  url: string;
  thumbnail?: string;
}

interface TimelineItem {
  id: string;
  mediaId: string;
  mediaItem: MediaItem;
  track: number;
  startTime: number;
  duration: number;
}

interface VideoPreviewProps {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  timelineItems: TimelineItem[];
  currentTime: number;
  onTimeChange: (time: number | ((prev: number) => number)) => void; // Fix the type
  isScrubbing: boolean;
}

export default function VideoPreview({
  isPlaying,
  setIsPlaying,
  timelineItems,
  currentTime,
  onTimeChange,
  isScrubbing,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Remove the internal currentTime state - we'll use the prop instead
  // const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentVisualItem, setCurrentVisualItem] =
    useState<TimelineItem | null>(null);
  const [currentAudioItem, setCurrentAudioItem] = useState<TimelineItem | null>(
    null
  );
  const [volume, setVolume] = useState(1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Add state to track when user is scrubbing vs normal playback
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);

  // Add download progress state
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);

  // Get timeline items by track
  const visualItems = timelineItems
    .filter((item) => item.track === 0)
    .sort((a, b) => a.startTime - b.startTime);

  const audioItems = timelineItems
    .filter((item) => item.track === 1)
    .sort((a, b) => a.startTime - b.startTime);

  // Calculate total timeline duration
  useEffect(() => {
    const allItems = [...visualItems, ...audioItems];
    if (allItems.length > 0) {
      const lastItem = allItems.reduce((latest, item) =>
        item.startTime + item.duration > latest.startTime + latest.duration
          ? item
          : latest
      );
      setTotalDuration(lastItem.startTime + lastItem.duration);
    } else {
      setTotalDuration(0);
    }
  }, [visualItems, audioItems]);

  // Find current items based on playback time - IMPROVED end handling
  useEffect(() => {
    let currentVisual = visualItems.find(
      (item) =>
        currentTime >= item.startTime &&
        currentTime < item.startTime + item.duration
    );

    // If we're at the exact end of the timeline, show the last visual item
    if (!currentVisual && visualItems.length > 0) {
      const lastVisual = visualItems[visualItems.length - 1];
      const timelineEnd = lastVisual.startTime + lastVisual.duration;

      // If we're within a small tolerance of the end (0.1 seconds), show the last frame
      if (Math.abs(currentTime - timelineEnd) <= 0.1) {
        currentVisual = lastVisual;
      }
    }

    let currentAudio = audioItems.find(
      (item) =>
        currentTime >= item.startTime &&
        currentTime < item.startTime + item.duration
    );

    // Same logic for audio
    if (!currentAudio && audioItems.length > 0) {
      const lastAudio = audioItems[audioItems.length - 1];
      const audioEnd = lastAudio.startTime + lastAudio.duration;

      if (Math.abs(currentTime - audioEnd) <= 0.1) {
        currentAudio = lastAudio;
      }
    }

    setCurrentVisualItem(currentVisual || null);
    setCurrentAudioItem(currentAudio || null);
  }, [currentTime, visualItems, audioItems]);

  // Handle play/pause for video
  useEffect(() => {
    if (videoRef.current && currentVisualItem?.mediaItem.type === "video") {
      const video = videoRef.current;

      if (isPlaying && hasUserInteracted) {
        video.play().catch(console.error);
      } else {
        video.pause();
      }

      video.volume = volume;
    }
  }, [isPlaying, currentVisualItem, volume, hasUserInteracted]);

  // Handle play/pause for audio
  useEffect(() => {
    if (audioRef.current && currentAudioItem?.mediaItem.type === "audio") {
      const audio = audioRef.current;

      if (isPlaying && hasUserInteracted) {
        audio.play().catch(console.error);
      } else {
        audio.pause();
      }

      audio.volume = volume;
    }
  }, [isPlaying, currentAudioItem, volume, hasUserInteracted]);

  // Timeline playback (simplified - only for images and timeline sync)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && totalDuration > 0) {
      interval = setInterval(() => {
        // Use a ref to track current time or get it from the callback
        if (
          videoRef.current &&
          currentVisualItem?.mediaItem.type === "video" &&
          !videoRef.current.paused
        ) {
          // For video: sync with video's actual time
          const videoTimeInTimeline =
            currentVisualItem.startTime + videoRef.current.currentTime;
          const newTime = Math.min(videoTimeInTimeline, totalDuration);
          onTimeChange(newTime);
        } else {
          // For images: increment by small amount
          // We'll use setState callback pattern but with a different approach
          onTimeChange((prevTime: number) => {
            const newTime = prevTime + 0.1;
            return newTime >= totalDuration ? totalDuration : newTime;
          });
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, currentVisualItem, onTimeChange]);

  // Stop playback when reaching the end (separate effect to avoid React warning)
  useEffect(() => {
    if (currentTime >= totalDuration && totalDuration > 0 && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentTime, totalDuration, isPlaying, setIsPlaying]);

  // FIXED: Only update video time when scrubbing or when video changes
  useEffect(() => {
    if (videoRef.current && currentVisualItem?.mediaItem.type === "video") {
      const timeWithinVideo = currentTime - currentVisualItem.startTime;
      const clampedTime = Math.max(0, timeWithinVideo);

      // Only update when scrubbing or when not playing (to preserve smooth playback)
      if (isScrubbing || !isPlaying) {
        if (videoRef.current.readyState >= 1) {
          videoRef.current.currentTime = clampedTime;
        }
      }
    }
  }, [currentTime, currentVisualItem, isScrubbing, isPlaying]);

  useEffect(() => {
    if (audioRef.current && currentAudioItem?.mediaItem.type === "audio") {
      const timeWithinAudio = currentTime - currentAudioItem.startTime;
      const clampedTime = Math.max(0, timeWithinAudio);

      // Only update when scrubbing or when not playing
      if (isScrubbing || !isPlaying) {
        if (audioRef.current.readyState >= 1) {
          audioRef.current.currentTime = clampedTime;
        }
      }
    }
  }, [currentTime, currentAudioItem, isScrubbing, isPlaying]);

  const togglePlayback = () => {
    if (visualItems.length === 0 && audioItems.length === 0) return;

    // Mark user interaction for autoplay policy
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    setIsPlaying(!isPlaying);
  };

  const seekToTime = (time: number) => {
    const newTime = Math.max(0, Math.min(time, totalDuration));
    onTimeChange(newTime); // Use onTimeChange instead of setCurrentTime

    // Update video time if playing video
    if (videoRef.current && currentVisualItem?.mediaItem.type === "video") {
      const timeWithinVideo = newTime - currentVisualItem.startTime;
      videoRef.current.currentTime = Math.max(0, timeWithinVideo);
    }

    // Update audio time if playing audio
    if (audioRef.current && currentAudioItem?.mediaItem.type === "audio") {
      const timeWithinAudio = newTime - currentAudioItem.startTime;
      audioRef.current.currentTime = Math.max(0, timeWithinAudio);
    }
  };

  const skipBackward = () => {
    seekToTime(currentTime - 5);
  };

  const skipForward = () => {
    seekToTime(currentTime + 5);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const hasContent = visualItems.length > 0 || audioItems.length > 0;

  // Enhanced download function with progress
  const handleDownload = async () => {
    if (!hasContent) return;

    setIsDownloading(true);

    try {
      // Prepare timeline data for backend composition
      const timelineData = {
        duration: totalDuration,
        visualTrack: visualItems.map((item) => ({
          id: item.id,
          type: item.mediaItem.type,
          url: item.mediaItem.url,
          name: item.mediaItem.name,
          startTime: item.startTime,
          duration: item.duration,
          track: item.track,
        })),
        audioTrack: audioItems.map((item) => ({
          id: item.id,
          type: item.mediaItem.type,
          url: item.mediaItem.url,
          name: item.mediaItem.name,
          startTime: item.startTime,
          duration: item.duration,
          track: item.track,
        })),
      };

      console.log("Sending timeline data for composition:", timelineData);

      // Send timeline data to backend for video composition
      const response = await fetch("/api/py/video-composer/compose-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(timelineData),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", errorText);
        throw new Error(
          `Video composition failed: ${response.status} - ${errorText}`
        );
      }

      // Get the composed video URL or job ID
      const result = await response.json();
      console.log("Composition result:", result);

      if (result.jobId) {
        // If it's an async job, poll for completion
        await pollForCompositionComplete(result.jobId);
      } else if (result.downloadUrl) {
        // If immediate download is available
        downloadComposedVideo(result.downloadUrl);
      }
    } catch (error) {
      console.error("Video composition failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Failed to compose timeline video: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to poll for composition completion
  const pollForCompositionComplete = async (jobId: string) => {
    const maxAttempts = 24; // 2 minutes max (5 second intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(
          `/api/py/video-composer/compose-video/status/${jobId}`
        );

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const result = await response.json();
        console.log("Composition status:", result);

        if (result.status === "succeeded") {
          downloadComposedVideo(result.downloadUrl);
          return;
        } else if (result.status === "failed") {
          throw new Error(result.error || "Video composition failed");
        }

        // Wait 5 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        console.error("Error checking composition status:", error);
        throw error;
      }
    }

    throw new Error("Video composition timed out");
  };

  // Simplified download function using the existing proxy endpoint
  const downloadComposedVideo = async (downloadUrl: string) => {
    try {
      setIsDownloadingFile(true);
      console.log("Starting video download via proxy...");

      // Use the existing download proxy endpoint to bypass CORS
      const proxyUrl = `/api/download-video?url=${encodeURIComponent(
        downloadUrl
      )}`;

      // Create a temporary link and click it to trigger download
      const link = document.createElement("a");
      link.href = proxyUrl;
      link.download = `timeline-video-${Date.now()}.mp4`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("Video download started successfully");
    } catch (error) {
      console.error("Failed to download video:", error);
      alert("Failed to download video. Please try again.");
    } finally {
      setIsDownloadingFile(false);
    }
  };

  return (
    <div className="flex-1 bg-zinc-950 border-r border-zinc-800 flex flex-col min-w-0">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold">Preview</h3>
        <Button
          onClick={handleDownload}
          disabled={!hasContent || isDownloading || isDownloadingFile}
          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing...
            </>
          ) : isDownloadingFile ? (
            <>
              <Download className="w-3 h-3 mr-1" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-3 h-3 mr-1" />
              Download Timeline Video
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 rounded-lg overflow-hidden w-full max-w-4xl">
          {/* Video Container - No controls overlaid */}
          <div className="aspect-video bg-zinc-900 rounded-lg flex items-center justify-center relative">
            {hasContent && currentVisualItem ? (
              <div className="w-full h-full flex items-center justify-center">
                {currentVisualItem.mediaItem.type === "video" ? (
                  <video
                    ref={videoRef}
                    key={currentVisualItem.id}
                    className="w-full h-full object-contain rounded-lg"
                    src={currentVisualItem.mediaItem.url}
                    controls={false}
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={currentVisualItem.mediaItem.url}
                    alt={currentVisualItem.mediaItem.name}
                    className="w-full h-full object-contain rounded-lg"
                  />
                )}
                {/* Timeline progress overlay - keep this minimal */}
                <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs">
                  {currentVisualItem.mediaItem.name}
                </div>
              </div>
            ) : hasContent ? (
              <div className="text-center">
                <Film className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-500">
                  Timeline: {formatTime(currentTime)} /{" "}
                  {formatTime(totalDuration)}
                </p>
                <p className="text-zinc-400 text-sm">
                  {currentAudioItem
                    ? `Playing: ${currentAudioItem.mediaItem.name}`
                    : "No visual content at current time"}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Film className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-500">No content loaded</p>
                <p className="text-zinc-400 text-sm">
                  Add content to timeline to start
                </p>
              </div>
            )}
          </div>

          {/* Hidden audio element for audio tracks */}
          {currentAudioItem && (
            <audio
              ref={audioRef}
              key={currentAudioItem.id}
              src={currentAudioItem.mediaItem.url}
              preload="metadata"
            />
          )}

          {/* Minimalistic Controls Below Video - iMovie Style (No Timeline) */}
          {hasContent && (
            <div className="p-4 bg-zinc-900">
              {/* Control Buttons Row */}
              <div className="flex items-center justify-center gap-6">
                {/* Skip Backward */}
                <button
                  onClick={skipBackward}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <SkipBack className="w-5 h-5 text-white" />
                </button>

                {/* Play/Pause - Larger central button */}
                <button
                  onClick={togglePlayback}
                  className="p-3 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>

                {/* Skip Forward */}
                <button
                  onClick={skipForward}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <SkipForward className="w-5 h-5 text-white" />
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2 ml-6">
                  <Volume2 className="w-4 h-4 text-zinc-400" />
                  <div className="relative w-16 h-1 bg-zinc-700 rounded-full">
                    <div
                      className="absolute top-0 left-0 h-full bg-zinc-400 rounded-full"
                      style={{ width: `${volume * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Time Display */}
                <div className="ml-6 text-sm font-mono text-zinc-400 min-w-[80px]">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}