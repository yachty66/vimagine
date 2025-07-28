import supabase from "@/lib/supabase";

// Get base URL from environment
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000";

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

// This function now returns a job_id for async models
export async function generateContent(
  modelName: string,
  prompt: string,
  extraParams: Record<string, any> = {}
): Promise<{
  success: boolean;
  resultUrl?: string;
  jobId?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/models/generate/${modelName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...extraParams }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Server error: ${errorText}` };
    }

    const result = await response.json();

    if (result.status === "succeeded") {
      return { success: true, resultUrl: result.result_url };
    } else if (result.status === "processing") {
      return { success: true, jobId: result.job_id };
    } else {
      return { success: false, error: "Generation failed" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// NEW function to poll for job status
export async function pollJobStatus(jobId: string): Promise<{
  status: "processing" | "succeeded" | "failed";
  resultUrl?: string;
  error?: string;
}> {
  const response = await fetch(`${BASE_URL}/api/models/status/${jobId}`);
  if (!response.ok) {
    return { status: "failed", error: "Failed to check job status" };
  }
  const data = await response.json();
  return {
    status: data.status,
    resultUrl: data.result_url,
    error: data.error_message,
  };
}

// Keep these for backward compatibility
export const generateImage = (prompt: string) =>
  generateContent("flux-schnell", prompt);
export const generateVideo = (prompt: string) =>
  generateContent("seedance-pro", prompt);
