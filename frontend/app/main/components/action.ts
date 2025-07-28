import supabase from "@/lib/supabase";

// Interface for model data from database
interface ModelData {
  name: string;
  display_name: string;
  category: "image" | "video";
  price: number;
  reference_image_support: "none" | "optional" | "required";
}

// Fetch available models from database
export async function getAvailableModels(
  category?: "image" | "video"
): Promise<ModelData[]> {
  try {
    let query = supabase
      .from("models")
      .select("name, display_name, category, price, reference_image_support");

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return [];
  }
}

// Generic function that works with any model
export async function generateContent(
  modelName: string,
  prompt: string,
  extraParams: Record<string, any> = {}
): Promise<{
  success: boolean;
  resultUrl?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `http://localhost:8000/api/models/generate/${modelName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, ...extraParams }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Server error: ${errorText}`,
      };
    }

    const result = await response.json();

    if (result.status === "succeeded" && result.result_url) {
      return {
        success: true,
        resultUrl: result.result_url,
      };
    }

    return {
      success: false,
      error: "Generation failed - no result URL received",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Keep these for backward compatibility
export const generateImage = (prompt: string) =>
  generateContent("flux-schnell", prompt);
export const generateVideo = (prompt: string) =>
  generateContent("seedance-pro", prompt);
