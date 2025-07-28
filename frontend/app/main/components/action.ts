// Simple, direct function to call flux-schnell endpoint
export async function generateImage(prompt: string): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  try {
    const response = await fetch("http://localhost:8000/api/py/flux-schnell/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

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
        imageUrl: result.result_url,
      };
    }

    return {
      success: false,
      error: "Generation failed - no image URL received",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}