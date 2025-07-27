"use client";

import { useState, useEffect, useCallback } from "react";
import MediaLibrary from "./components/MediaLibrary";
import VideoPreview from "./components/VideoPreview";
import ChatInterface from "./components/ChatInterface";
import Timeline from "./components/Timeline";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import supabase from "@/lib/supabase";

interface MediaItem {
  id: string;
  type: "video" | "image" | "audio";
  name: string;
  url: string;
  thumbnail?: string;
  isPending?: boolean; // Add this for loading states
  jobId?: string; // Add this to track generation jobs
}

interface TimelineItem {
  id: string;
  mediaId: string;
  mediaItem: MediaItem;
  track: number;
  startTime: number;
  duration: number;
}

// Track configuration
const TRACK_CONFIG = {
  VIDEO_IMAGE_TRACKS: [0],
  AUDIO_TRACKS: [1],
  TOTAL_TRACKS: 2,
};

export default function MainEditorPage() {
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // Add this state
  const [isScrubbing, setIsScrubbing] = useState(false); // Add this state

  // Load project media files from database
  const loadProjectMediaFiles = async (
    projectId: number
  ): Promise<MediaItem[]> => {
    try {
      const { data: mediaFiles, error } = await supabase
        .from("ai_editor_media_files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load media files:", error);
        throw error;
      }

      // Convert database format to MediaItem format
      const mediaItems: MediaItem[] = (mediaFiles || []).map((file, index) => ({
        id: `db-${file.id}`, // Use database ID with prefix
        type: file.type as "video" | "image" | "audio",
        name: extractFileNameFromUrl(file.file_url),
        url: file.file_url,
        thumbnail: file.type === "image" ? file.file_url : undefined,
      }));

      console.log(
        `Loaded ${mediaItems.length} media files for project ${projectId}`
      );
      return mediaItems;
    } catch (error) {
      console.error("Error loading project media files:", error);
      return [];
    }
  };

  // Extract filename from URL for display
  const extractFileNameFromUrl = (url: string): string => {
    try {
      const urlParts = url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      // Remove any query parameters
      return fileName.split("?")[0] || "Unnamed file";
    } catch {
      return "Unnamed file";
    }
  };

  // Initialize project and load data
  useEffect(() => {
    const initializeProject = async () => {
      try {
        const savedProjectId = localStorage.getItem("currentProjectId");
        const savedProjectName = localStorage.getItem("currentProjectName");

        if (!savedProjectId || !savedProjectName) {
          throw new Error("No project selected");
        }

        const id = parseInt(savedProjectId);
        setProjectId(id);
        setProjectName(savedProjectName);

        // Load existing media files for this project
        console.log("Loading media files for project:", id);
        const existingMediaFiles = await loadProjectMediaFiles(id);
        setMediaLibrary(existingMediaFiles);

        console.log(
          "Project initialized successfully with",
          existingMediaFiles.length,
          "media files"
        );
      } catch (error) {
        console.error("Failed to initialize project:", error);
        // If there's an error, we could redirect back to project selection
        // router.push('/inference/editor');
      } finally {
        setIsLoading(false);
      }
    };

    initializeProject();
  }, []);

  // Save project name to Supabase
  const saveProjectName = async (newName: string) => {
    if (!projectId || !newName.trim()) return false;

    try {
      const { error } = await supabase
        .from("ai_video_editor_projects")
        .update({ name: newName.trim() })
        .eq("id", projectId);

      if (error) {
        console.error("Failed to update project name:", error);
        throw error;
      }

      // Update local state and localStorage
      setProjectName(newName.trim());
      localStorage.setItem("currentProjectName", newName.trim());

      console.log("Project name updated successfully:", newName.trim());
      return true;
    } catch (error) {
      console.error("Error updating project name:", error);
      return false;
    }
  };

  // Enhanced setMediaLibrary to handle both new uploads and existing files
  const updateMediaLibrary = useCallback(
    (newMediaLibrary: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])) => {
      // Handle both direct array and function updates
      if (typeof newMediaLibrary === "function") {
        setMediaLibrary((currentLibrary) => {
          const updatedLibrary = newMediaLibrary(currentLibrary);

          // Only save new items (those that don't start with 'db-')
          if (projectId) {
            const newItems = updatedLibrary.filter(
              (item) =>
                !item.id.startsWith("db-") &&
                !currentLibrary.find((existing) => existing.id === item.id)
            );

            newItems.forEach((item) => {
              if (!item.isPending && item.url) {
                saveFileToSupabase(item).catch(console.error);
              }
            });
          }

          return updatedLibrary;
        });
      } else {
        setMediaLibrary((currentLibrary) => {
          // Only save new items (those that don't start with 'db-')
          if (projectId) {
            const newItems = newMediaLibrary.filter(
              (item) =>
                !item.id.startsWith("db-") &&
                !currentLibrary.find((existing) => existing.id === item.id)
            );

            newItems.forEach((item) => {
              if (!item.isPending && item.url) {
                saveFileToSupabase(item).catch(console.error);
              }
            });
          }

          return newMediaLibrary;
        });
      }
    },
    [projectId] // Remove mediaLibrary dependency!
  );

  // Save new files to Supabase (for newly uploaded/generated files) - with filename deduplication
  const saveFileToSupabase = async (mediaItem: MediaItem) => {
    try {
      if (!projectId) {
        console.warn("No project ID found, skipping Supabase save");
        return;
      }

      // Extract filename from URL for comparison
      const fileName = extractFileNameFromUrl(mediaItem.url);

      // Check if file with same name already exists in database to prevent duplicates
      const { data: existingFiles, error: checkError } = await supabase
        .from("ai_editor_media_files")
        .select("id, file_url")
        .eq("project_id", projectId)
        .limit(100); // Get all files for this project

      if (checkError) {
        console.error("Error checking for existing files:", checkError);
        throw checkError;
      }

      // Check if any existing file has the same filename
      const duplicateFile = existingFiles?.find((file) => {
        const existingFileName = extractFileNameFromUrl(file.file_url);
        return existingFileName === fileName;
      });

      // If file with same name already exists, skip saving
      if (duplicateFile) {
        console.log(
          "File with same name already exists in database, skipping save:",
          fileName
        );
        return;
      }

      // File doesn't exist, safe to insert
      const { error } = await supabase.from("ai_editor_media_files").insert({
        project_id: projectId,
        file_url: mediaItem.url,
        type: mediaItem.type,
      });

      if (error) {
        console.error("Failed to save file to Supabase:", error);
        throw error;
      }

      console.log("File saved to Supabase successfully:", fileName);
    } catch (error) {
      console.error("Error saving to Supabase:", error);
    }
  };

  // Function to get actual media duration
  const getMediaDuration = (mediaItem: MediaItem): Promise<number> => {
    return new Promise((resolve) => {
      if (mediaItem.type === "video") {
        const video = document.createElement("video");
        video.src = mediaItem.url;
        video.onloadedmetadata = () => {
          resolve(Math.round((video.duration || 10) * 100) / 100);
        };
        video.onerror = () => resolve(10);
      } else if (mediaItem.type === "audio") {
        const audio = document.createElement("audio");
        audio.src = mediaItem.url;
        audio.onloadedmetadata = () => {
          resolve(Math.round((audio.duration || 15) * 100) / 100);
        };
        audio.onerror = () => resolve(15);
      } else {
        resolve(5); // Images get default 5 seconds
      }
    });
  };

  // Function to add media to timeline with track type logic
  const addToTimeline = async (mediaItem: MediaItem) => {
    const availableTracks =
      mediaItem.type === "audio"
        ? TRACK_CONFIG.AUDIO_TRACKS
        : TRACK_CONFIG.VIDEO_IMAGE_TRACKS;

    const trackUsage = availableTracks.map((trackIndex) => ({
      track: trackIndex,
      endTime: Math.max(
        0,
        ...timelineItems
          .filter((item) => item.track === trackIndex)
          .map((item) => item.startTime + item.duration)
      ),
    }));

    const bestTrack = trackUsage.reduce((prev, current) =>
      current.endTime < prev.endTime ? current : prev
    );

    const actualDuration = await getMediaDuration(mediaItem);

    const newTimelineItem: TimelineItem = {
      id: `timeline-${Date.now()}-${Math.random()}`,
      mediaId: mediaItem.id,
      mediaItem,
      track: bestTrack.track,
      startTime: bestTrack.endTime,
      duration: actualDuration,
    };

    setTimelineItems((prev) => [...prev, newTimelineItem]);
  };

  // Function to remove item from timeline with smart gap closure
  const removeFromTimeline = (timelineItemId: string) => {
    setTimelineItems((prev) => {
      // Find the item being removed
      const itemToRemove = prev.find((item) => item.id === timelineItemId);
      if (!itemToRemove) return prev;

      const removedItemTrack = itemToRemove.track;
      const removedItemStartTime = itemToRemove.startTime;
      const removedItemEndTime = itemToRemove.startTime + itemToRemove.duration;

      // Filter out the removed item
      const remainingItems = prev.filter((item) => item.id !== timelineItemId);

      // Sort items on the same track by start time
      const itemsOnSameTrack = remainingItems
        .filter((item) => item.track === removedItemTrack)
        .sort((a, b) => a.startTime - b.startTime);

      const itemsOnOtherTracks = remainingItems.filter(
        (item) => item.track !== removedItemTrack
      );

      // Reposition items on the same track to close gaps
      let currentTime = 0;
      const repositionedItems = itemsOnSameTrack.map((item) => {
        const newStartTime = currentTime;
        currentTime = newStartTime + item.duration;

        return {
          ...item,
          startTime: newStartTime,
        };
      });

      return [...itemsOnOtherTracks, ...repositionedItems];
    });
  };

  // Add function to update timeline items
  const updateTimelineItem = (
    itemId: string,
    updates: Partial<TimelineItem>
  ) => {
    setTimelineItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
    setHasUnsavedChanges(true);
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Top Half - Split between left panel and video preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Media Library + AI Prompt - 60% width */}
        <div className="w-[60%] flex flex-col border-r border-zinc-800 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MediaLibrary
              mediaLibrary={mediaLibrary}
              setMediaLibrary={updateMediaLibrary}
              onAddToTimeline={addToTimeline}
              projectName={projectName}
              onUpdateProjectName={saveProjectName}
              projectId={projectId} // Add this prop
            />
          </div>

          <div className="flex-shrink-0">
            <ChatInterface
              mediaLibrary={mediaLibrary}
              setMediaLibrary={updateMediaLibrary}
            />
          </div>
        </div>

        {/* Right Panel - Video Preview - 40% width */}
        <VideoPreview
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          timelineItems={timelineItems}
          currentTime={currentTime}
          onTimeChange={setCurrentTime}
          isScrubbing={isScrubbing}
        />
      </div>

      {/* Bottom Half - Timeline */}
      <div className="h-80 border-t border-zinc-800 flex-shrink-0">
        <Timeline
          timelineItems={timelineItems}
          onRemoveFromTimeline={removeFromTimeline}
          onAddToTimeline={addToTimeline}
          onUpdateTimelineItem={updateTimelineItem}
          currentTime={currentTime}
          onTimeChange={setCurrentTime}
          onScrubbingChange={setIsScrubbing}
          trackConfig={TRACK_CONFIG}
        />
      </div>
    </div>
  );
}