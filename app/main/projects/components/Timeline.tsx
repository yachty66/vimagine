"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface TrackConfig {
  VIDEO_IMAGE_TRACKS: number[];
  AUDIO_TRACKS: number[];
  TOTAL_TRACKS: number;
}

interface TimelineProps {
  timelineItems: TimelineItem[];
  onRemoveFromTimeline: (timelineItemId: string) => void;
  onAddToTimeline: (item: MediaItem) => void;
  onUpdateTimelineItem: (
    itemId: string,
    updates: Partial<TimelineItem>
  ) => void;
  trackConfig: TrackConfig;
  currentTime?: number;
  onTimeChange?: (time: number) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void; // Add this prop
}

export default function Timeline({
  timelineItems,
  onRemoveFromTimeline,
  onAddToTimeline,
  onUpdateTimelineItem,
  trackConfig,
  currentTime = 0,
  onTimeChange,
  onScrubbingChange, // Add this prop
}: TimelineProps) {
  // Convert time to percentage for positioning - IMPROVED
  const timeToPercentage = (time: number, maxTime: number) => {
    return Math.max(0, Math.min(100, (time / maxTime) * 100));
  };

  const durationToPercentage = (duration: number, maxTime: number) => {
    return Math.max(0, (duration / maxTime) * 100);
  };

  // Get track type and styling
  const getTrackInfo = (trackIndex: number) => {
    if (trackConfig.VIDEO_IMAGE_TRACKS.includes(trackIndex)) {
      return {
        type: "visual",
        label: `Visual`, // Remove the number
        bgColor: "bg-zinc-800",
        borderColor: "border-zinc-700",
        textColor: "text-zinc-400",
        isAudioTrack: false,
      };
    } else if (trackConfig.AUDIO_TRACKS.includes(trackIndex)) {
      return {
        type: "audio",
        label: `Audio`, // Remove the number
        bgColor: "bg-zinc-800", // Change from green to zinc
        borderColor: "border-zinc-700", // Change from green to zinc
        textColor: "text-zinc-400", // Change from green to zinc
        isAudioTrack: true,
      };
    }
    return {
      type: "unknown",
      label: `Track ${trackIndex + 1}`,
      bgColor: "bg-zinc-800",
      borderColor: "border-zinc-700",
      textColor: "text-zinc-400",
      isAudioTrack: false,
    };
  };

  // Helper function to render media content in timeline items
  const renderMediaContent = (item: TimelineItem) => {
    const { mediaItem } = item;

    if (mediaItem.type === "image") {
      return (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${mediaItem.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      );
    } else if (mediaItem.type === "video") {
      // For videos, we'll show multiple frames across the timeline item
      const frameCount = Math.max(
        3,
        Math.min(10, Math.floor(item.duration / 2))
      ); // 3-10 frames based on duration

      return (
        <div className="absolute inset-0 flex">
          {Array.from({ length: frameCount }).map((_, index) => (
            <div
              key={index}
              className="flex-1 bg-cover bg-center bg-no-repeat border-r border-black/20 last:border-r-0"
              style={{
                backgroundImage: `url(${mediaItem.thumbnail || mediaItem.url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
        </div>
      );
    } else if (mediaItem.type === "audio") {
      // For audio, show a waveform-like pattern with zinc colors
      return (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-600 to-zinc-700 flex items-center justify-center">
          <div className="flex items-end gap-0.5 h-8">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="bg-zinc-300 w-0.5 rounded-t" // Change from green to zinc
                style={{
                  height: `${Math.random() * 100 + 20}%`,
                }}
              />
            ))}
          </div>
        </div>
      );
    }
  };

  // Get media item styling - unified styling for all media types
  const getMediaItemStyling = (mediaType: string) => {
    return "border-zinc-600 hover:border-zinc-500";
  };

  // Handle drop events
  const handleDrop = (e: React.DragEvent, trackIndex: number) => {
    e.preventDefault();

    try {
      const mediaItemData = e.dataTransfer.getData("application/json");
      if (mediaItemData) {
        const mediaItem: MediaItem = JSON.parse(mediaItemData);

        // Check if the media type is compatible with the track
        const trackInfo = getTrackInfo(trackIndex);
        const isAudioItem = mediaItem.type === "audio";
        const isVisualItem =
          mediaItem.type === "image" || mediaItem.type === "video";

        if (
          (trackInfo.isAudioTrack && isAudioItem) ||
          (!trackInfo.isAudioTrack && isVisualItem)
        ) {
          onAddToTimeline(mediaItem);
        } else {
          console.warn(
            `Cannot drop ${mediaItem.type} on ${trackInfo.type} track`
          );
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Add state for resizing
  const [resizing, setResizing] = useState<{
    itemId: string;
    handle: "left" | "right";
    startX: number;
    originalStartTime: number;
    originalDuration: number;
  } | null>(null);

  // Handle resize start
  const handleResizeStart = (
    e: React.MouseEvent,
    itemId: string,
    handle: "left" | "right",
    item: TimelineItem
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setResizing({
      itemId,
      handle,
      startX: e.clientX,
      originalStartTime: item.startTime,
      originalDuration: item.duration,
    });
  };

  // Add state for playhead dragging
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);

  // Calculate total timeline duration helper function (for layout)
  const calculateTotalDuration = () => {
    return Math.max(
      60, // Minimum 60 seconds
      ...timelineItems.map((item) => item.startTime + item.duration)
    );
  };

  // NEW: Calculate the actual content end time (for playhead constraints)
  const calculateContentEndTime = () => {
    if (timelineItems.length === 0) return 0;

    return Math.max(
      ...timelineItems.map((item) => item.startTime + item.duration)
    );
  };

  // Add ref for timeline container
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // PRECISE: Use exact measurements matching the layout
  const TRACK_LABELS_WIDTH = 80; // This matches w-20 (5rem = 80px)

  // IMPROVED: Precise mouse handling with content-aware constraints
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing && !draggingPlayhead) return;

      if (draggingPlayhead && onTimeChange) {
        const timelineContainer = timelineContainerRef.current;
        if (!timelineContainer) return;

        const rect = timelineContainer.getBoundingClientRect();
        const availableWidth = rect.width - TRACK_LABELS_WIDTH;
        const mouseX = e.clientX - rect.left - TRACK_LABELS_WIDTH;

        // Clamp to bounds
        const clampedMouseX = Math.max(0, Math.min(availableWidth, mouseX));

        // Calculate time using total duration for coordinate system
        const totalDuration = calculateTotalDuration();
        const calculatedTime = (clampedMouseX / availableWidth) * totalDuration;

        // NEW: Constrain to actual content end time
        const contentEndTime = calculateContentEndTime();
        const newTime = Math.max(0, Math.min(contentEndTime, calculatedTime));

        onTimeChange(newTime);
        return;
      }

      // Existing resizing logic stays the same
      if (!resizing) return;

      const deltaX = e.clientX - resizing.startX;
      const timelineDuration = 60;

      const timelineContainer = document.querySelector(".timeline-container");
      const containerWidth = timelineContainer
        ? timelineContainer.clientWidth - 80
        : window.innerWidth - 200;

      const deltaTime = (deltaX / containerWidth) * timelineDuration;

      const item = timelineItems.find((i) => i.id === resizing.itemId);
      if (!item) return;

      let newStartTime = resizing.originalStartTime;
      let newDuration = resizing.originalDuration;

      if (resizing.handle === "left") {
        const proposedStartTime = Math.max(
          0,
          resizing.originalStartTime + deltaTime
        );
        const timeDiff = proposedStartTime - resizing.originalStartTime;
        newStartTime = proposedStartTime;
        newDuration = Math.max(0.5, resizing.originalDuration - timeDiff);
      } else {
        newDuration = Math.max(0.5, resizing.originalDuration + deltaTime);
        if (newStartTime + newDuration > timelineDuration) {
          newDuration = timelineDuration - newStartTime;
        }
      }

      onUpdateTimelineItem(resizing.itemId, {
        startTime: Math.round(newStartTime * 10) / 10,
        duration: Math.round(newDuration * 10) / 10,
      });
    };

    const handleMouseUp = () => {
      setResizing(null);

      // Notify that scrubbing stopped
      if (draggingPlayhead && onScrubbingChange) {
        onScrubbingChange(false);
      }

      setDraggingPlayhead(false);
      document.body.style.cursor = "default";
    };

    if (resizing || draggingPlayhead) {
      const cursor = resizing ? "ew-resize" : "ew-resize";
      document.body.style.cursor = cursor;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
  }, [
    resizing,
    draggingPlayhead,
    timelineItems,
    onUpdateTimelineItem,
    onTimeChange,
    onScrubbingChange, // Add this dependency
  ]);

  // IMPROVED: Notify scrubbing on click and drag start
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!onTimeChange || resizing || draggingPlayhead) return;

    // Notify that scrubbing started
    if (onScrubbingChange) {
      onScrubbingChange(true);
    }

    const timelineContainer = timelineContainerRef.current;
    if (!timelineContainer) return;

    const rect = timelineContainer.getBoundingClientRect();
    const availableWidth = rect.width - TRACK_LABELS_WIDTH;
    const mouseX = e.clientX - rect.left - TRACK_LABELS_WIDTH;

    const clampedMouseX = Math.max(0, Math.min(availableWidth, mouseX));
    const totalDuration = calculateTotalDuration();
    const calculatedTime = (clampedMouseX / availableWidth) * totalDuration;

    // NEW: Constrain to actual content end time
    const contentEndTime = calculateContentEndTime();
    const newTime = Math.max(0, Math.min(contentEndTime, calculatedTime));

    onTimeChange(newTime);

    // Notify that scrubbing stopped (for click events)
    setTimeout(() => {
      if (onScrubbingChange) {
        onScrubbingChange(false);
      }
    }, 100);
  };

  // Calculate both durations
  const totalDuration = calculateTotalDuration();
  const contentEndTime = calculateContentEndTime();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="h-80 bg-zinc-900 border-t border-zinc-800 flex-shrink-0">
      {/* Updated header with time display */}
      <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-4">
        <span className="text-sm font-medium">Timeline</span>

        {/* Current time display like iMovie */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-sm font-mono text-white">
            {formatTime(currentTime)} /{" "}
            {formatTime(contentEndTime > 0 ? contentEndTime : totalDuration)}
          </div>
          {contentEndTime > 0 && contentEndTime < totalDuration && (
            <div className="text-xs text-zinc-500">
              (Timeline: {formatTime(totalDuration)})
            </div>
          )}
        </div>
      </div>

      <div
        ref={timelineContainerRef}
        className="relative h-72 overflow-x-auto overflow-y-hidden timeline-container"
        onClick={handleTimelineClick}
      >
        {/* REMOVE THE TIME RULER - no more 0s, 5s, 10s, etc. */}

        {/* Tracks - now start from top instead of top-6 */}
        <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col">
          {Array.from({ length: trackConfig.TOTAL_TRACKS }).map(
            (_, trackIndex) => {
              const trackInfo = getTrackInfo(trackIndex);
              return (
                <div
                  key={trackIndex}
                  className="relative flex-1 border-b border-zinc-700"
                >
                  <div
                    className={`absolute left-0 top-0 w-20 h-full ${trackInfo.bgColor} border-r ${trackInfo.borderColor} flex items-center justify-center text-xs ${trackInfo.textColor}`}
                  >
                    {trackInfo.label}
                  </div>

                  {/* Timeline items for this track */}
                  <div
                    className="absolute left-20 top-0 right-0 h-full bg-zinc-900/50 relative transition-colors"
                    onDrop={(e) => handleDrop(e, trackIndex)}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    style={{
                      backgroundColor: "rgba(24, 24, 27, 0.5)",
                    }}
                    onDragOverCapture={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                    }}
                    onDragLeaveCapture={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundColor = "rgba(24, 24, 27, 0.5)";
                    }}
                  >
                    {timelineItems
                      .filter((item) => item.track === trackIndex)
                      .map((item) => (
                        <div
                          key={item.id}
                          className={`absolute top-1 bottom-1 rounded border-2 group cursor-pointer transition-colors overflow-hidden ${getMediaItemStyling(
                            item.mediaItem.type
                          )} ${resizing?.itemId === item.id ? "z-10" : ""}`}
                          style={{
                            left: `${timeToPercentage(
                              item.startTime,
                              totalDuration
                            )}%`,
                            width: `${durationToPercentage(
                              item.duration,
                              totalDuration
                            )}%`,
                            minWidth: "60px",
                          }}
                        >
                          {/* Media content background */}
                          {renderMediaContent(item)}

                          {/* Light overlay for better visibility of controls on hover */}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                          {/* Left trimmer handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white/20"
                            onMouseDown={(e) =>
                              handleResizeStart(e, item.id, "left", item)
                            }
                            style={{
                              zIndex: 20,
                            }}
                          >
                            <div className="w-0.5 h-6 bg-white rounded-full shadow-lg" />
                          </div>

                          {/* Right trimmer handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white/20"
                            onMouseDown={(e) =>
                              handleResizeStart(e, item.id, "right", item)
                            }
                            style={{
                              zIndex: 20,
                            }}
                          >
                            <div className="w-0.5 h-6 bg-white rounded-full shadow-lg" />
                          </div>

                          {/* Remove button only */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromTimeline(item.id);
                              }}
                              size="sm"
                              variant="ghost"
                              className="w-5 h-5 p-0 hover:bg-red-600 bg-black/60 rounded-full"
                              style={{ zIndex: 25 }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Duration indicator */}
                          <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/60 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {Math.round(item.duration * 10) / 10}s
                          </div>
                        </div>
                      ))}

                    {/* Drop zone text */}
                    {timelineItems.filter((item) => item.track === trackIndex)
                      .length === 0 && (
                      <div className="h-full flex items-center justify-center text-xs text-zinc-600">
                        {trackInfo.isAudioTrack
                          ? "Drop audio files here"
                          : "Drop images/videos here"}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* FIXED: Pixel-perfect playhead positioning */}
        {(() => {
          const container = timelineContainerRef.current;
          if (!container) return null;

          const availableWidth = container.clientWidth - TRACK_LABELS_WIDTH;
          const playheadOffset = (currentTime / totalDuration) * availableWidth;

          return (
            <div
              className={`absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none ${
                draggingPlayhead ? "z-50" : "z-10"
              }`}
              style={{
                left: `${TRACK_LABELS_WIDTH + playheadOffset}px`,
              }}
            >
              <div
                className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full -mt-1 cursor-ew-resize pointer-events-auto ${
                  draggingPlayhead ? "scale-125" : "hover:scale-110"
                } transition-transform`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  // Notify that scrubbing started
                  if (onScrubbingChange) {
                    onScrubbingChange(true);
                  }

                  setDraggingPlayhead(true);
                }}
              />
              {/* Larger invisible hit area for easier grabbing */}
              <div
                className="absolute -top-2 -bottom-2 -left-3 -right-3 cursor-ew-resize pointer-events-auto"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDraggingPlayhead(true);
                }}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}