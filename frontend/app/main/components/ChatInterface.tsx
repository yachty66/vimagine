"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { generateFluxImageDirect } from "./action"; // Import the direct function
import supabase from "@/lib/supabase";

// A simpler MediaItem for our new, faster flow
interface MediaItem {
  id: string;
  type: "image"; // Only image is supported now
  name: string;
  url: string;
  thumbnail?: string;
}

interface ChatInterfaceProps {
  setMediaLibrary: (
    items: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])
  ) => void;
}

export default function ChatInterface({ setMediaLibrary }: ChatInterfaceProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendPrompt = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    // Use the direct function instead of the class method
    const response = await generateFluxImageDirect(prompt);

    if (response.success && response.result_url) {
      const newMediaItem: MediaItem = {
        id: `media-${Date.now()}`,
        type: "image",
        name: `Generated: ${prompt.substring(0, 30)}...`,
        url: response.result_url,
        thumbnail: response.result_url,
      };

      setMediaLibrary((prev) => [newMediaItem, ...prev]);
      saveGeneratedMediaToSupabase(newMediaItem);
      setPrompt(""); // Clear prompt on success
    } else {
      setError(response.error || "An unknown error occurred.");
    }

    setIsGenerating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
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
            onClick={handleSendPrompt}
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

// This function can remain as it is, saving the result to the database.
const saveGeneratedMediaToSupabase = async (mediaItem: MediaItem) => {
  try {
    const projectId = localStorage.getItem("currentProjectId");
    if (!projectId) return;

    await supabase.from("ai_editor_media_files").insert({
      project_id: projectId,
      file_url: mediaItem.url,
      type: mediaItem.type,
    });
  } catch (error) {
    console.error("Error saving generated media to Supabase:", error);
  }
};
