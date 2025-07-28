"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { generateImage } from "./action";

interface MediaItem {
  id: string;
  type: "video" | "image" | "audio"; // Match the parent's interface
  name: string;
  url: string;
  thumbnail?: string; // Make optional to match parent
  isPending?: boolean; // Add this for compatibility
  jobId?: string; // Add this for compatibility
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

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    const result = await generateImage(prompt);

    if (result.success && result.imageUrl) {
      const newImage: MediaItem = {
        id: `img-${Date.now()}`,
        type: "image",
        name: `Generated: ${prompt.slice(0, 30)}...`,
        url: result.imageUrl,
        thumbnail: result.imageUrl,
        isPending: false,
      };

      // Use the setMediaLibrary function from props
      setMediaLibrary((prev) => [newImage, ...prev]);
      setPrompt(""); // Clear prompt on success
    } else {
      setError(result.error || "Failed to generate image");
    }

    setIsGenerating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="p-4 bg-zinc-900 border-t border-zinc-800">
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
        <div className="relative">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe the image you want to create..."
            className="w-full bg-transparent border-none resize-none min-h-[80px] focus:outline-none focus:ring-0 text-zinc-100 placeholder-zinc-500 pr-12"
            rows={3}
            disabled={isGenerating}
          />

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
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
