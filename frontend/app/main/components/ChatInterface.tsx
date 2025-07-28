"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image, Video } from "lucide-react";
import { generateContent, getAvailableModels } from "./action";

interface ModelData {
  name: string;
  display_name: string;
  category: "image" | "video";
  price: number;
  reference_image_support: "none" | "optional" | "required";
}

interface MediaItem {
  id: string;
  type: "video" | "image" | "audio";
  name: string;
  url: string;
  thumbnail?: string;
  isPending?: boolean;
  jobId?: string;
}

interface ChatInterfaceProps {
  mediaLibrary: MediaItem[];
  setMediaLibrary: (
    items: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])
  ) => void;
}

export default function ChatInterface({
  mediaLibrary,
  setMediaLibrary,
}: ChatInterfaceProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"image" | "video">("image");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load models on component mount
  useEffect(() => {
    loadModels();
  }, []);

  // Update available models when type changes
  useEffect(() => {
    const filteredModels = models.filter((m) => m.category === selectedType);
    if (
      filteredModels.length > 0 &&
      !filteredModels.find((m) => m.name === selectedModel)
    ) {
      setSelectedModel(filteredModels[0].name);
    }
  }, [selectedType, models]);

  const loadModels = async () => {
    setLoading(true);
    const allModels = await getAvailableModels();
    setModels(allModels);

    // Set default model
    const imageModels = allModels.filter((m) => m.category === "image");
    if (imageModels.length > 0) {
      setSelectedModel(imageModels[0].name);
    }

    setLoading(false);
  };

  const filteredModels = models.filter((m) => m.category === selectedType);
  const currentModel = models.find((m) => m.name === selectedModel);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating || !selectedModel) return;

    setIsGenerating(true);
    setError(null);

    const result = await generateContent(selectedModel, prompt);

    if (result.success && result.resultUrl) {
      const newMediaItem: MediaItem = {
        id: `${selectedType}-${Date.now()}`,
        type: selectedType,
        name: `${currentModel?.display_name}: ${prompt.slice(0, 30)}...`,
        url: result.resultUrl,
        thumbnail: selectedType === "image" ? result.resultUrl : undefined,
        isPending: false,
      };

      setMediaLibrary((prev) => [newMediaItem, ...prev]);
      setPrompt("");
    } else {
      setError(result.error || `Failed to generate ${selectedType}`);
    }

    setIsGenerating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
          <div className="text-zinc-400 text-center">Loading models...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-900 border-t border-zinc-800">
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
        {/* Type selector and Model dropdown */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-zinc-700 rounded-lg p-1">
            <button
              onClick={() => setSelectedType("image")}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedType === "image"
                  ? "bg-zinc-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Image className="w-3 h-3" />
              Image
            </button>
            <button
              onClick={() => setSelectedType("video")}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedType === "video"
                  ? "bg-zinc-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Video className="w-3 h-3" />
              Video
            </button>
          </div>

          {/* Model selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1 text-sm text-white"
          >
            {filteredModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.display_name} - ${model.price}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Describe the ${selectedType} you want to create...`}
            className="w-full bg-transparent border-none resize-none min-h-[80px] focus:outline-none focus:ring-0 text-zinc-100 placeholder-zinc-500 pr-12"
            rows={3}
            disabled={isGenerating}
          />

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating || !selectedModel}
            className="absolute right-2 bottom-2 w-8 h-8 p-0 rounded-lg bg-white hover:bg-gray-100 disabled:bg-zinc-700 text-black"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
