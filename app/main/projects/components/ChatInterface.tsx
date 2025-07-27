"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Image,
  Video,
  ChevronDown,
  Play,
  X,
  Upload,
  Camera,
} from "lucide-react";
import supabase from "@/lib/supabase";
// Import the AI Editor API
import { aiEditorApi } from "./action";

// Add MediaItem interface
interface MediaItem {
  id: string;
  type: "video" | "image" | "audio";
  name: string;
  url: string;
  thumbnail?: string;
  isPending?: boolean; // Add this for loading states
  jobId?: string; // Add this to track generation jobs
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIVideoEditorMetadata {
  cost: number;
  category: "image" | "video";
  display_name: string;
  used_in_editor: boolean;
  reference_image: boolean;
}

interface ModelData {
  id: string;
  name: string;
  ai_video_editor_metadata: AIVideoEditorMetadata;
}

interface ChatInterfaceProps {
  mediaLibrary: MediaItem[];
  setMediaLibrary: (
    items: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])
  ) => void; // Update type
}

export default function ChatInterface({
  mediaLibrary,
  setMediaLibrary,
}: ChatInterfaceProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedType, setSelectedType] = useState<"image" | "video">("image");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedStartFrame, setSelectedStartFrame] = useState<File | null>(
    null
  );
  const [selectedMediaLibraryImage, setSelectedMediaLibraryImage] =
    useState<MediaItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReferenceSelector, setShowReferenceSelector] = useState(false);

  // Add the missing state variables
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [pollingStatus, setPollingStatus] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get images from media library
  const mediaLibraryImages = mediaLibrary.filter(
    (item) => item.type === "image"
  );

  // Fetch models from Supabase
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("models")
          .select("id, name, ai_video_editor_metadata")
          .not("ai_video_editor_metadata", "is", null);

        if (error) {
          console.error("Error fetching models:", error);
          return;
        }

        // Filter models that have used_in_editor: true
        const validModels =
          data?.filter((model) => {
            const metadata =
              model.ai_video_editor_metadata as AIVideoEditorMetadata;
            return metadata && metadata.used_in_editor === true;
          }) || [];

        setModels(validModels);

        // Set default model for current type
        const defaultModel = validModels.find(
          (m) => m.ai_video_editor_metadata.category === selectedType
        );
        if (defaultModel) {
          setSelectedModel(defaultModel.name);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Get filtered models for current category
  const getFilteredModels = () => {
    return models.filter(
      (model) => model.ai_video_editor_metadata.category === selectedType
    );
  };

  // Get current model metadata
  const getCurrentModelMetadata = () => {
    const currentModel = models.find((m) => m.name === selectedModel);
    return currentModel?.ai_video_editor_metadata;
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;

    const currentMetadata = getCurrentModelMetadata();

    // Store the prompt and generate unique job ID for pending item
    const promptToSend = prompt;
    const pendingJobId = `pending-${Date.now()}-${Math.random()}`;

    // Clear the input fields immediately when request starts
    setPrompt("");
    removeStartFrame(); // Clear reference image immediately

    // Immediately add pending item to media library
    const pendingMediaItem: MediaItem = {
      id: pendingJobId,
      type: selectedType as "video" | "image",
      name: `Generating ${selectedType} - ${promptToSend.substring(0, 30)}...`,
      url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+", // Empty 1x1 transparent SVG
      isPending: true,
      jobId: pendingJobId,
    };

    // Add pending item to media library immediately
    setMediaLibrary([pendingMediaItem, ...mediaLibrary]);

    setError(null);
    setGenerationResult(null);
    setPollingStatus("");

    try {
      let referenceImageUrl: string | undefined;

      // Handle reference image - either from file upload or media library
      if (showReferenceImage) {
        if (selectedStartFrame) {
          console.log("Uploading reference image...");
          referenceImageUrl = await aiEditorApi.uploadReferenceImage(
            selectedStartFrame
          );
        } else if (selectedMediaLibraryImage) {
          console.log("Using media library image as reference...");
          referenceImageUrl = selectedMediaLibraryImage.url;
        }
      }

      console.log("Sending generation request...");

      // Send generation request with the stored prompt
      const response = await aiEditorApi.generateContent({
        modelName: selectedModel,
        prompt: promptToSend,
        type: selectedType,
        referenceImageUrl: referenceImageUrl,
      });

      if (!response.success) {
        throw new Error(response.error || "Generation failed");
      }

      console.log("Generation request successful:", response);
      setGenerationResult(response);

      // Start polling for completion
      if (response.job_id) {
        setPollingStatus("Starting generation...");

        const result = await aiEditorApi.pollJobUntilComplete(
          response.job_id,
          (status) => {
            console.log("Polling status update:", status);
            setPollingStatus(
              status === "processing"
                ? "Generating..."
                : status === "succeeded"
                ? "Complete!"
                : "Failed"
            );
          },
          selectedModel
        );

        console.log("Polling completed with result:", result);

        if (result.success && result.result_url) {
          console.log("Generation successful, result URL:", result.result_url);

          // Update the pending item with actual result - KEEP THE SAME ID
          const completedMediaItem: MediaItem = {
            id: pendingJobId, // Keep the same ID as the pending item!
            type: selectedType as "video" | "image",
            name: `Generated ${selectedType} - ${promptToSend.substring(
              0,
              30
            )}...`,
            url: result.result_url,
            thumbnail: selectedType === "image" ? result.result_url : undefined,
            isPending: false,
            jobId: response.job_id, // Store the API job ID separately if needed
          };

          console.log(
            "Updating pending item to completed:",
            completedMediaItem
          );

          // Use functional update to avoid stale closure
          setMediaLibrary((currentLibrary) => {
            console.log("Current library when updating:", currentLibrary);
            const updatedLibrary = currentLibrary.map((item) =>
              item.id === pendingJobId ? completedMediaItem : item
            );
            console.log("Updated library:", updatedLibrary);
            return updatedLibrary;
          });

          // Save to Supabase directly
          saveGeneratedMediaToSupabase(completedMediaItem);

          setPollingStatus("Added to media library!");

          // Clear the success message after 3 seconds
          setTimeout(() => {
            setGenerationResult(null);
            setPollingStatus("");
          }, 3000);
        } else {
          console.error("Generation failed or missing result_url:", result);
          throw new Error(
            result.error || "Generation failed - no result URL received"
          );
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      setError(error instanceof Error ? error.message : "Generation failed");

      // Remove the pending item on error using functional update
      setMediaLibrary((currentLibrary) =>
        currentLibrary.filter((item) => item.id !== pendingJobId)
      );
    }
  };

  const handleReferenceButtonClick = () => {
    setShowReferenceSelector(!showReferenceSelector);
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear media library selection
      setSelectedMediaLibraryImage(null);
      setSelectedStartFrame(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setShowReferenceSelector(false);
      console.log("Selected start frame:", file.name);
    }
  };

  const handleMediaLibraryImageSelect = (item: MediaItem) => {
    // Clear file selection
    setSelectedStartFrame(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedMediaLibraryImage(item);
    setPreviewUrl(item.url);
    setShowReferenceSelector(false);
    console.log("Selected media library image:", item.name);
  };

  const removeStartFrame = () => {
    setSelectedStartFrame(null);
    setSelectedMediaLibraryImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const handleReferenceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleReferenceDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleReferenceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    try {
      const draggedData = e.dataTransfer.getData("application/json");
      if (draggedData) {
        const draggedItem: MediaItem = JSON.parse(draggedData);

        // Only accept image items
        if (draggedItem.type === "image" && !draggedItem.isPending) {
          console.log("Dropped image from media library:", draggedItem.name);
          handleMediaLibraryImageSelect(draggedItem);
        }
      }
    } catch (error) {
      console.error("Failed to parse dropped item:", error);
    }
  };

  // Update model when type changes
  const handleTypeChange = (type: "image" | "video") => {
    setSelectedType(type);
    // Auto-select the first available model for this category
    const filteredModels = models.filter(
      (m) => m.ai_video_editor_metadata.category === type
    );
    if (filteredModels.length > 0) {
      setSelectedModel(filteredModels[0].name);
    }
  };

  const filteredModels = getFilteredModels();
  const currentMetadata = getCurrentModelMetadata();
  const showReferenceImage = currentMetadata?.reference_image === true;

  // Check if reference image is required but not provided
  const isReferenceImageRequired =
    showReferenceImage && !selectedStartFrame && !selectedMediaLibraryImage;

  // Updated condition for disabling the send button (removed isGenerating)
  const isSendDisabled = !prompt.trim() || isReferenceImageRequired;

  if (loading) {
    return (
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
          <div className="flex items-center justify-center h-32">
            <span className="text-zinc-400">Loading models...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-900 border-t border-zinc-800">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Prompt input area with integrated controls */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
        {/* Top row - Image/Video tabs and Model selector */}
        <div className="flex items-center justify-between mb-4">
          {/* Left side - Image/Video tabs */}
          <div className="flex bg-zinc-700 rounded-lg p-1">
            <button
              onClick={() => handleTypeChange("image")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedType === "image"
                  ? "bg-zinc-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Image className="w-4 h-4" />
              Image
            </button>
            <button
              onClick={() => handleTypeChange("video")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedType === "video"
                  ? "bg-zinc-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Video className="w-4 h-4" />
              Video
            </button>
          </div>

          {/* Right side - Model selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="appearance-none bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredModels.map((model) => (
                <option key={model.id} value={model.name}>
                  {model.ai_video_editor_metadata.display_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Textarea with image preview */}
        <div
          className="relative mb-3"
          onDragOver={showReferenceImage ? handleReferenceDragOver : undefined}
          onDragLeave={
            showReferenceImage ? handleReferenceDragLeave : undefined
          }
          onDrop={showReferenceImage ? handleReferenceDrop : undefined}
        >
          {/* Start frame preview */}
          {previewUrl && showReferenceImage && (
            <div className="absolute top-2 left-2 z-10">
              <div className="relative group">
                <img
                  src={previewUrl}
                  alt="Reference image"
                  className="w-12 h-12 object-cover rounded-md border border-zinc-600"
                />
                <button
                  onClick={removeStartFrame}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2 h-2 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Add drag overlay when dragging over the reference area */}
          {isDraggingOver && showReferenceImage && (
            <div className="absolute inset-0 bg-white/5 border-2 border-white/30 border-dashed rounded-lg flex items-center justify-center z-20 pointer-events-none backdrop-blur-sm">
              <div className="bg-white text-black rounded-lg px-6 py-3 shadow-lg border border-zinc-300">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Drop image here
                </div>
              </div>
            </div>
          )}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              showReferenceImage && !previewUrl
                ? "Describe what you want to create... (Drag an image here or use the Reference Image button to add a reference)"
                : "Describe what you want to create or click 'Inspire' to generate a prompt..."
            }
            className={`w-full bg-transparent border-none resize-none min-h-[80px] focus:outline-none focus:ring-0 text-zinc-100 placeholder-zinc-500 ${
              previewUrl && showReferenceImage ? "pl-16" : ""
            } ${isDraggingOver && showReferenceImage ? "opacity-50" : ""}`}
            rows={3}
            disabled={isGenerating}
          />

          <Button
            onClick={handleSendPrompt}
            disabled={isSendDisabled}
            className="absolute right-2 bottom-2 w-8 h-8 p-0 rounded-lg bg-white hover:bg-gray-100 disabled:bg-zinc-700 text-black"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Bottom controls row */}
        <div className="flex items-center justify-between">
          {/* Left side - Reference Image button (conditional) */}
          <div className="flex items-center gap-2 relative">
            {showReferenceImage && (
              <>
                <Button
                  onClick={handleReferenceButtonClick}
                  variant="outline"
                  size="sm"
                  className="bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600 hover:text-white flex items-center gap-2"
                >
                  <Play className="w-3 h-3" />
                  Reference Image
                </Button>

                {/* Reference image selector dropdown */}
                {showReferenceSelector && (
                  <div className="absolute top-full left-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-3 w-80 z-20">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-zinc-300 mb-2">
                        Select Reference Image
                      </h4>

                      {/* Upload option */}
                      <Button
                        onClick={handleFileUpload}
                        variant="outline"
                        size="sm"
                        className="w-full mb-3 bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600 flex items-center gap-2"
                      >
                        <Upload className="w-3 h-3" />
                        Upload from Computer
                      </Button>

                      {/* Media library images */}
                      {mediaLibraryImages.length > 0 ? (
                        <div>
                          <p className="text-xs text-zinc-400 mb-2">
                            From Media Library:
                          </p>
                          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                            {mediaLibraryImages.map((item) => (
                              <div
                                key={item.id}
                                onClick={() =>
                                  handleMediaLibraryImageSelect(item)
                                }
                                className="aspect-square bg-zinc-700 rounded border border-zinc-600 hover:border-zinc-500 cursor-pointer overflow-hidden group"
                              >
                                <img
                                  src={item.url}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          No images in media library
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side - Cost display */}
          <div className="flex items-center gap-1 text-zinc-400 text-sm">
            <span className="bg-zinc-700 rounded-full w-6 h-6 flex items-center justify-center text-xs">
              $
            </span>
            <span>{currentMetadata?.cost || "0.00"}</span>
          </div>
        </div>
      </div>

      {/* Backdrop to close reference selector */}
      {showReferenceSelector && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowReferenceSelector(false)}
        />
      )}
    </div>
  );
}

const saveGeneratedMediaToSupabase = async (mediaItem: MediaItem) => {
  try {
    const projectId = localStorage.getItem("currentProjectId");

    if (!projectId) {
      console.warn("No project ID found, skipping Supabase save");
      return;
    }

    const { error } = await supabase.from("ai_editor_media_files").insert({
      project_id: projectId,
      file_url: mediaItem.url,
      type: mediaItem.type,
    });

    if (error) {
      console.error("Failed to save generated media to Supabase:", error);
      throw error;
    }

    console.log(
      "Generated media saved to Supabase successfully:",
      mediaItem.name
    );
  } catch (error) {
    console.error("Error saving generated media to Supabase:", error);
  }
};