"use client";

import {
  Plus,
  Upload,
  Edit2,
  Check,
  X,
  Loader2,
  Download,
  Play,
  Camera,
  Music,
  Trash2, // Add this import
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { upload } from "@vercel/blob/client";
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

// Update the interface to allow both direct array and function updates
interface MediaLibraryProps {
  mediaLibrary: MediaItem[];
  setMediaLibrary: (
    items: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])
  ) => void; // Fix this line
  onAddToTimeline: (item: MediaItem) => void;
  projectName: string;
  onUpdateProjectName: (newName: string) => Promise<boolean>;
  projectId: number | null;
}

// Add the missing function
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

// Updated helper function to generate video thumbnails with multiple retry positions
const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Use the backend proxy to fetch the video as a blob
      const response = await fetch(`/api/download-video?url=${encodeURIComponent(videoUrl)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      const videoBlob = await response.blob();
      const proxiedUrl = URL.createObjectURL(videoBlob);

      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";

      let seekAttempts = 0;
      const maxAttempts = 5;
      // Try different seek positions: 1s, 2s, 5s, 10% of duration, 25% of duration
      const getSeekPositions = (duration: number): number[] => [
        1,
        2,
        5,
        Math.min(duration * 0.1, 10),
        Math.min(duration * 0.25, 30),
      ];

      let seekPositions: number[] = [];
      let currentAttempt = 0;

      // Function to check if an image is mostly black/empty
      const isBlackFrame = (imageData: ImageData): boolean => {
        const data = imageData.data;
        let totalBrightness = 0;

        // Sample every 10th pixel for performance
        for (let i = 0; i < data.length; i += 40) {
          // RGBA = 4 bytes, so every 10th pixel
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r + g + b) / 3;
        }

        const avgBrightness = totalBrightness / (data.length / 40);
        return avgBrightness < 30; // Consider it black if average brightness is very low
      };

      // Function to attempt thumbnail capture
      const attemptCapture = () => {
        if (
          currentAttempt >= seekPositions.length ||
          currentAttempt >= maxAttempts
        ) {
          // If all attempts failed, return a basic frame anyway
          if (ctx) {
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8);
              resolve(thumbnailDataUrl);
              return;
            } catch (error) {
              reject(new Error("Failed to generate any thumbnail"));
              return;
            }
          }
          reject(new Error("No canvas context available"));
          return;
        }

        const seekTime = seekPositions[currentAttempt];
        console.log(
          `Attempting thumbnail capture at ${seekTime}s (attempt ${
            currentAttempt + 1
          })`
        );

        // Make sure we don't seek beyond video duration
        if (seekTime <= video.duration) {
          video.currentTime = seekTime;
        } else {
          // If seek time is beyond duration, try the middle of the video
          video.currentTime = video.duration / 2;
        }
      };

      // Step 1: Wait for metadata to load
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        seekPositions = getSeekPositions(video.duration);

        // Start with the first attempt
        attemptCapture();
      };

      // Step 2: Wait for seek to complete, then capture frame
      video.onseeked = () => {
        if (ctx) {
          try {
            // Draw the frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get image data to check if it's black
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Check if this frame is mostly black
            if (
              isBlackFrame(imageData) &&
              currentAttempt < seekPositions.length - 1
            ) {
              console.log(
                `Frame at ${seekPositions[currentAttempt]}s appears to be black, trying next position`
              );
              currentAttempt++;
              attemptCapture();
              return;
            }

            // Frame looks good or we've exhausted attempts, use it
            const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8);
            console.log(
              `Successfully generated thumbnail at ${seekPositions[currentAttempt]}s`
            );
            resolve(thumbnailDataUrl);
          } catch (error) {
            console.error("Error capturing frame:", error);
            currentAttempt++;
            if (currentAttempt < maxAttempts) {
              attemptCapture();
            } else {
              reject(new Error("Failed to draw video frame to canvas"));
            }
          }
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      };

      // Error handling
      video.onerror = (e) => {
        console.error("Video error:", e);
        reject(new Error("Failed to load video"));
      };

      video.onabort = () => {
        console.error("Video loading aborted");
        reject(new Error("Video loading aborted"));
      };

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.error("Video thumbnail generation timed out");
        reject(new Error("Video thumbnail generation timed out"));
      }, 15000); // 15 second timeout (increased from 10s)

      // Clear timeout when done
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
      reject = (reason) => {
        clearTimeout(timeout);
        originalReject(reason);
      };

      // Start loading the video
      video.src = proxiedUrl; // Use the proxied URL
      video.load();

      // Clean up the object URL after use
      video.onended = () => URL.revokeObjectURL(proxiedUrl);
      video.onerror = (e) => {
        URL.revokeObjectURL(proxiedUrl);
        reject(new Error("Failed to load video from proxied URL"));
      };

    } catch (error) {
      reject(error);
    }
  });
};

export default function MediaLibrary({
  mediaLibrary,
  setMediaLibrary,
  onAddToTimeline,
  projectName,
  onUpdateProjectName,
  projectId, // Add this parameter
}: MediaLibraryProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Project name editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Add upload progress tracking state
  const [uploadProgress, setUploadProgress] = useState<{
    uploading: boolean;
    currentFile: string;
    completed: number;
    total: number;
  }>({
    uploading: false,
    currentFile: "",
    completed: 0,
    total: 0,
  });

  // Get file type based on MIME type
  const getFileType = (file: File): "video" | "image" | "audio" | null => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return null;
  };

  // Get appropriate upload endpoint based on file type
  const getUploadEndpoint = (type: "video" | "image" | "audio"): string => {
    switch (type) {
      case "image":
        return "/api/upload-image";
      case "video":
        return "/api/upload-video";
      case "audio":
        return "/api/upload-audio";
    }
  };

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

  // Start editing project name
  const startEditingName = () => {
    setEditingName(projectName);
    setIsEditingName(true);
  };

  // Cancel editing project name
  const cancelEditingName = () => {
    setEditingName("");
    setIsEditingName(false);
  };

  // Save edited project name
  const saveEditedName = async () => {
    if (!editingName.trim()) {
      cancelEditingName();
      return;
    }

    setIsSavingName(true);
    const success = await onUpdateProjectName(editingName);
    setIsSavingName(false);

    if (success) {
      setIsEditingName(false);
      setEditingName("");
    }
  };

  // Handle Enter key to save, Escape key to cancel
  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditedName();
    } else if (e.key === "Escape") {
      cancelEditingName();
    }
  };

  // Add state for video thumbnails
  const [videoThumbnails, setVideoThumbnails] = useState<Map<string, string>>(
    new Map()
  );

  // Generate thumbnails for videos when they're added
  useEffect(() => {
    const generateThumbnails = async () => {
      for (const item of mediaLibrary) {
        if (
          item.type === "video" &&
          item.url &&
          !item.isPending &&
          !videoThumbnails.has(item.id)
        ) {
          try {
            console.log(`Generating thumbnail for video: ${item.name}`);
            const thumbnail = await generateVideoThumbnail(item.url);
            console.log(`Successfully generated thumbnail for: ${item.name}`);
            setVideoThumbnails((prev) => new Map(prev).set(item.id, thumbnail));
          } catch (error) {
            console.warn(
              `Failed to generate thumbnail for video ${item.name}:`,
              error
            );
            // Set a fallback for failed thumbnails
            setVideoThumbnails((prev) => new Map(prev).set(item.id, "failed"));
          }
        }
      }
    };

    generateThumbnails();
  }, [mediaLibrary]); // Remove videoThumbnails from dependencies to avoid infinite loop

  // Handle file upload - with better visual feedback
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const filesToUpload = Array.from(files).filter((file) => {
      const fileType = getFileType(file);
      if (!fileType) {
        console.warn(`Unsupported file type: ${file.type}`);
        return false;
      }

      // Check if file with same name already exists in media library
      const existingFile = mediaLibrary.find((item) => item.name === file.name);
      if (existingFile) {
        console.log(
          `File "${file.name}" already exists in media library, skipping upload`
        );
        return false;
      }

      return true;
    });

    if (filesToUpload.length === 0) {
      return;
    }

    // Initialize upload progress
    setUploadProgress({
      uploading: true,
      currentFile: filesToUpload[0].name,
      completed: 0,
      total: filesToUpload.length,
    });

    setIsUploading(true);
    const uploadedItems: MediaItem[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const fileType = getFileType(file);

      // Update current file being uploaded
      setUploadProgress((prev) => ({
        ...prev,
        currentFile: file.name,
        completed: i,
      }));

      try {
        // Upload to blob storage
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: getUploadEndpoint(fileType!),
        });

        const newMediaItem: MediaItem = {
          id: `uploaded-${Date.now()}-${Math.random()}`,
          type: fileType!,
          name: file.name,
          url: blob.url,
          thumbnail: fileType === "image" ? blob.url : undefined,
        };

        uploadedItems.push(newMediaItem);

        // Save to database immediately after successful upload
        if (projectId) {
          await saveFileToSupabase(newMediaItem);
        }

        // Update progress
        setUploadProgress((prev) => ({
          ...prev,
          completed: i + 1,
        }));
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    // Add all uploaded items to media library
    if (uploadedItems.length > 0) {
      setMediaLibrary([...mediaLibrary, ...uploadedItems]);
    }

    // Reset upload state
    setIsUploading(false);
    setUploadProgress({
      uploading: false,
      currentFile: "",
      completed: 0,
      total: 0,
    });
  };

  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(
    new Set()
  );

  // Updated download function that uses the backend proxy
  const handleDownload = async (item: MediaItem) => {
    try {
      // Add item to downloading set for loading state
      setDownloadingItems((prev) => new Set(prev).add(item.id));

      // Use the existing download-video API endpoint which handles CORS
      const downloadUrl = `/api/download-video?url=${encodeURIComponent(
        item.url
      )}`;

      // Create temporary anchor element
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        item.name ||
        `download.${
          item.type === "image" ? "jpg" : item.type === "video" ? "mp4" : "mp3"
        }`;

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      // Remove item from downloading set
      setDownloadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(files);
    }
    e.target.value = "";
  };

  // Open file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Function to get type icon - consistent styling, different icons
  const getTypeIndicator = (type: "video" | "image" | "audio") => {
    switch (type) {
      case "video":
        return {
          icon: <Play className="w-3 h-3 fill-white text-white" />,
          bgColor: "bg-black/70",
          label: "Video",
        };
      case "image":
        return {
          icon: <Camera className="w-3 h-3 text-white" />,
          bgColor: "bg-black/70",
          label: "Image",
        };
      case "audio":
        return {
          icon: <Music className="w-3 h-3 text-white" />,
          bgColor: "bg-black/70",
          label: "Audio",
        };
    }
  };

  // Add Trash icon to the imports
  const handleDelete = async (item: MediaItem) => {
    try {
      // Remove from local media library first
      setMediaLibrary(
        mediaLibrary.filter((mediaItem) => mediaItem.id !== item.id)
      );

      // If this item came from the database (ID starts with "db-"), delete it from Supabase
      if (item.id.startsWith("db-") && projectId) {
        const dbId = item.id.replace("db-", ""); // Extract the actual database ID

        const { error } = await supabase
          .from("ai_editor_media_files")
          .delete()
          .eq("id", parseInt(dbId))
          .eq("project_id", projectId); // Extra safety check

        if (error) {
          console.error("Failed to delete file from database:", error);
          // Re-add the item back to the library if database deletion failed
          setMediaLibrary((prev) => [...prev, item]);
          return;
        }

        console.log("File deleted from database successfully:", item.name);
      }

      console.log("File deleted from media library:", item.name);
    } catch (error) {
      console.error("Error deleting file:", error);
      // Re-add the item back to the library if there was an error
      setMediaLibrary((prev) => [...prev, item]);
    }
  };

  return (
    <div className="w-full h-full bg-zinc-900 border-r border-zinc-800 border-b border-zinc-800 flex flex-col max-h-full">
      <div className="p-4 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Editable Project Name */}
          <div className="flex items-center gap-2 flex-1 mr-4">
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleNameKeyPress}
                  className="bg-zinc-800 border-zinc-600 text-white font-semibold h-8 px-2 flex-1"
                  autoFocus
                  disabled={isSavingName}
                />
                <Button
                  onClick={saveEditedName}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:text-gray-300"
                  disabled={isSavingName}
                >
                  {isSavingName ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  onClick={cancelEditingName}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:text-gray-300"
                  disabled={isSavingName}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group flex-1">
                <h3 className="font-semibold text-white truncate">
                  {projectName}
                </h3>
                <Button
                  onClick={startEditingName}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white flex-shrink-0"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button
            onClick={openFilePicker}
            size="sm"
            variant="outline"
            className="flex items-center gap-1 flex-shrink-0 bg-white text-black border-white hover:bg-gray-100 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isUploading || uploadProgress.uploading}
          >
            {isUploading || uploadProgress.uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            {isUploading || uploadProgress.uploading
              ? "Uploading..."
              : "Upload"}
          </Button>
        </div>
      </div>

      <div
        className="flex-1 p-1.5 overflow-y-auto min-h-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload Progress Overlay */}
        {(isUploading || uploadProgress.uploading) && (
          <div className="mb-4 p-3 bg-zinc-800/50 border border-zinc-600 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">
                  Uploading files... ({uploadProgress.completed} of{" "}
                  {uploadProgress.total})
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  Current: {uploadProgress.currentFile}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-700 rounded-full h-1.5">
              <div
                className="bg-white h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width:
                    uploadProgress.total > 0
                      ? `${
                          (uploadProgress.completed / uploadProgress.total) *
                          100
                        }%`
                      : "0%",
                }}
              />
            </div>
          </div>
        )}

        {mediaLibrary.length === 0 &&
        !isUploading &&
        !uploadProgress.uploading ? (
          <div className="text-center text-zinc-500 mt-8">
            <div className="mb-4">
              <Upload className="w-16 h-16 mx-auto text-zinc-600 mb-3" />
            </div>
            <p className="text-lg font-medium">No media yet</p>
            <p className="text-sm mt-1 text-zinc-400">
              Click Upload above, drag & drop files, or use AI chat below
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {mediaLibrary.map((item) => {
              const typeIndicator = getTypeIndicator(item.type);

              return (
                <div
                  key={item.id}
                  className="bg-zinc-800 rounded border border-zinc-700 hover:border-zinc-600 transition-colors group relative overflow-hidden"
                  draggable={!item.isPending}
                  onDragStart={(e) => {
                    if (!item.isPending) {
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify(item)
                      );
                      e.dataTransfer.effectAllowed = "copy";
                    }
                  }}
                  style={{
                    cursor: item.isPending ? "default" : "grab",
                  }}
                >
                  <div className="aspect-square bg-zinc-700 overflow-hidden relative">
                    {item.isPending ? (
                      // Show loading state for pending items
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-700 to-zinc-800">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    ) : item.type === "image" && item.url ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        style={{ pointerEvents: "none" }}
                      />
                    ) : item.type === "video" && item.url ? (
                      // Use thumbnail instead of video element
                      <div className="w-full h-full relative">
                        {videoThumbnails.has(item.id) ? (
                          videoThumbnails.get(item.id) === "failed" ? (
                            // Show fallback for failed thumbnail generation
                            <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-700 to-zinc-800">
                              <Play className="w-6 h-6 text-white" />
                            </div>
                          ) : (
                            <img
                              src={videoThumbnails.get(item.id)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              style={{ pointerEvents: "none" }}
                            />
                          )
                        ) : (
                          // Loading state while thumbnail is generating
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-700 to-zinc-800">
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-700 to-zinc-800">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                    )}

                    {/* Type indicator badge - only show for completed items */}
                    {!item.isPending && (
                      <div
                        className={`absolute top-1 left-1 ${typeIndicator.bgColor} rounded-full p-1 text-white shadow-lg`}
                      >
                        {typeIndicator.icon}
                      </div>
                    )}

                    {/* Smaller, more compact buttons */}
                    {!item.isPending && (
                      <>
                        {/* Add button - top right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToTimeline(item);
                          }}
                          className="absolute top-1 right-1 bg-white/90 hover:bg-white text-black rounded px-1 py-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 backdrop-blur-sm shadow-sm text-[9px] font-medium"
                          title="Add to Timeline"
                        >
                          <Plus className="w-2 h-2" />
                          Add
                        </button>

                        {/* Download button - bottom right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                          disabled={downloadingItems.has(item.id)}
                          className="absolute bottom-1 right-1 bg-white/90 hover:bg-white text-black rounded px-1 py-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 backdrop-blur-sm shadow-sm text-[9px] font-medium disabled:opacity-50"
                          title="Download"
                        >
                          {downloadingItems.has(item.id) ? (
                            <>
                              <Loader2 className="w-2 h-2 animate-spin" />
                              Saving
                            </>
                          ) : (
                            <>
                              <Download className="w-2 h-2" />
                              Save
                            </>
                          )}
                        </button>

                        {/* Delete button - bottom left */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `Are you sure you want to delete "${item.name}"?`
                              )
                            ) {
                              handleDelete(item);
                            }
                          }}
                          className="absolute bottom-1 left-1 bg-white/90 hover:bg-white text-black rounded px-1 py-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 backdrop-blur-sm shadow-sm text-[9px] font-medium"
                          title="Delete"
                        >
                          <Trash2 className="w-2 h-2" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}