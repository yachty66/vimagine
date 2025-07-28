import supabase from "@/lib/supabase";

interface GenerateRequest {
  modelName: string;
  prompt?: string;
  type: "image" | "video";
  referenceImageUrl?: string;
  // Allow any additional parameters
  [key: string]: any;
}

interface GenerateResponse {
  success: boolean;
  job_id?: string;
  status?: string;
  result_url?: string;
  error?: string;
}

export class AIEditorAPI {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://unitedcompute.ai";
  }

  private async getApiKey(): Promise<string> {
    // --- TEMPORARY BYPASS FOR LOCAL DEVELOPMENT ---
    // The simplified backend doesn't validate the key, so we can use a dummy value.
    // TODO: Re-enable this for production.
    return "local-dev-dummy-key";
    // --- END TEMPORARY BYPASS ---

    if (this.apiKey) return this.apiKey;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: apiKeyData, error } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !apiKeyData?.api_key) {
      throw new Error("API key not found. Please generate an API key first.");
    }

    this.apiKey = apiKeyData.api_key;
    return this.apiKey!;
  }

  private async getModelMetadata(modelName: string) {
    const { data: modelData, error } = await supabase
      .from("models")
      .select("input, ai_video_editor_metadata")
      .eq("name", modelName)
      .single();

    if (error || !modelData) {
      throw new Error(
        `Model ${modelName} not found or not configured for editor`
      );
    }

    const editorMetadata = modelData.ai_video_editor_metadata;

    if (!editorMetadata?.used_in_editor) {
      throw new Error(`Model ${modelName} is not enabled for the video editor`);
    }

    if (!editorMetadata?.api_name) {
      throw new Error(
        `Model ${modelName} does not have an API name configured`
      );
    }

    return {
      inputSchema: modelData.input,
      editorMetadata: editorMetadata,
    };
  }

  private async buildRequestPayload(
    request: GenerateRequest,
    inputSchema: any,
    apiName: string
  ): Promise<any> {
    console.log("Building payload for API:", apiName);
    const payload: any = {};

    if (request.prompt) {
      payload.prompt = request.prompt;
    }

    if (request.referenceImageUrl) {
      payload.image_url = request.referenceImageUrl;
      console.log(`Set image_url = ${request.referenceImageUrl}`);
    } else if (apiName.includes("i2v")) {
      // i2v models require an image
      return {
        success: false,
        error: `Reference image is required for ${apiName}. Please select an image first.`,
      };
    }

    if (inputSchema) {
      Object.keys(inputSchema).forEach((schemaKey) => {
        // Skip fields that have been handled or should be excluded
        if (
          schemaKey.toLowerCase().includes("user") ||
          schemaKey === "user_id" ||
          schemaKey === "prompt" ||
          schemaKey === "image_url" // Also skip our standard key
        ) {
          return;
        }

        if (request[schemaKey] !== undefined) {
          const value = request[schemaKey];
          if (value !== null && value !== "") {
            payload[schemaKey] = value;
            console.log(`Added parameter: ${schemaKey} = ${value}`);
          }
        }
      });
    }

    console.log("Final payload:", payload);
    return payload;
  }

  async generateContent(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const apiKey = await this.getApiKey();

      // Get the model's metadata and input schema
      const modelInfo = await this.getModelMetadata(request.modelName);
      const { inputSchema, editorMetadata } = modelInfo;

      console.log("Model metadata:", editorMetadata);
      console.log("Input schema:", inputSchema);

      // Check if this is an image-to-video model and reference image is required
      if (editorMetadata.reference_image && !request.referenceImageUrl) {
        return {
          success: false,
          error:
            "Reference image is required for this model. Please select an image first.",
        };
      }

      // Build the request payload as JSON
      const payload = await this.buildRequestPayload(
        request,
        inputSchema,
        editorMetadata.api_name
      );

      // If payload building returned an error
      if (payload.success === false) {
        return payload;
      }

      // Build the API endpoint using the api_name from metadata
      const apiEndpoint = `${this.baseUrl}/api/py/${editorMetadata.api_name}/generate`;

      console.log("Sending request to backend:", apiEndpoint);
      console.log("Request payload:", payload);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Backend response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error response:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        return {
          success: false,
          error:
            errorData.detail ||
            errorData.message ||
            `Request failed with status ${response.status}`,
        };
      }

      const result = await response.json();
      console.log("Backend response:", result);

      return {
        success: true,
        job_id: result.job_id || result.request_id,
        status: result.status,
        result_url: result.result_url,
      };
    } catch (error) {
      console.error("Generation request failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async checkJobStatus(
    jobId: string,
    modelName?: string
  ): Promise<{
    status: "processing" | "succeeded" | "failed";
    result_url?: string;
    error?: string;
  }> {
    try {
      const apiKey = await this.getApiKey();

      // Use the correct model's status endpoint if provided, otherwise fall back to flux-kontext-max
      let statusEndpoint = `${this.baseUrl}/api/py/flux-kontext-max/status/${jobId}`;

      if (modelName) {
        try {
          const modelInfo = await this.getModelMetadata(modelName);
          statusEndpoint = `${this.baseUrl}/api/py/${modelInfo.editorMetadata.api_name}/status/${jobId}`;
        } catch (error) {
          console.warn(
            "Could not get model metadata for status check, using default endpoint"
          );
        }
      }

      console.log("Checking status at:", statusEndpoint);

      const response = await fetch(statusEndpoint, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Status check result:", result);

      // Handle both response formats
      let result_url: string | undefined;

      // New format: direct result_url
      if (result.result_url) {
        result_url = result.result_url;
        console.log("Found result_url (new format):", result_url);
      }
      // Old format: content.video_url or content.image_url
      else if (result.content) {
        result_url = result.content.video_url || result.content.image_url;
        console.log("Found content URL (old format):", result_url);
      }

      return {
        status:
          result.status === "succeeded"
            ? "succeeded"
            : result.status === "failed"
            ? "failed"
            : "processing",
        result_url: result_url,
        error: result.detail || result.error,
      };
    } catch (error) {
      console.error("Status check failed:", error);
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Status check failed",
      };
    }
  }

  async pollJobUntilComplete(
    jobId: string,
    onProgress?: (status: string) => void,
    modelName?: string
  ): Promise<{
    success: boolean;
    result_url?: string;
    error?: string;
  }> {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;

    console.log(`Starting to poll job ${jobId} for completion...`);

    while (attempts < maxAttempts) {
      console.log(
        `Poll attempt ${attempts + 1}/${maxAttempts} for job ${jobId}`
      );

      const status = await this.checkJobStatus(jobId, modelName);
      console.log(`Job ${jobId} status:`, status);

      if (onProgress) {
        onProgress(status.status);
      }

      if (status.status === "succeeded") {
        console.log(
          `Job ${jobId} succeeded with result_url:`,
          status.result_url
        );
        return {
          success: true,
          result_url: status.result_url,
        };
      } else if (status.status === "failed") {
        console.log(`Job ${jobId} failed with error:`, status.error);
        return {
          success: false,
          error: status.error || "Generation failed",
        };
      }

      console.log(`Job ${jobId} still processing, waiting 5 seconds...`);
      // Still processing, wait 5 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    console.log(`Job ${jobId} timed out after ${maxAttempts} attempts`);
    return {
      success: false,
      error: "Generation timed out",
    };
  }

  // Helper method to upload reference image if needed
  async uploadReferenceImage(file: File): Promise<string> {
    try {
      console.log("Uploading reference image:", file.name);

      // Use your existing upload system
      const { upload } = await import("@vercel/blob/client");

      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-image",
      });

      const imageUrl = `${blob.url}?download=1$0`;
      console.log("Reference image uploaded:", imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("Image upload failed:", error);
      throw new Error("Failed to upload reference image");
    }
  }

  // --- ADD THIS NEW FUNCTION ---
  async generateFluxImage(
    prompt: string
  ): Promise<{ success: boolean; result_url?: string; error?: string }> {
    try {
      // This still uses your bypassed getApiKey() to get a dummy key
      const apiKey = await this.getApiKey();

      const apiEndpoint = `${this.baseUrl}/api/py/flux-schnell/generate`;

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try {
          // Try to parse the error for a more specific message
          const errorJson = JSON.parse(errorText);
          detail = errorJson.detail || detail;
        } catch (e) {
          // Ignore if parsing fails
        }
        throw new Error(detail);
      }

      const result = await response.json();

      if (result.status === "succeeded" && result.result_url) {
        return { success: true, result_url: result.result_url };
      } else {
        throw new Error(
          result.detail || "Generation failed in an unexpected way."
        );
      }
    } catch (error) {
      console.error("generateFluxImage failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "An unknown error occurred.",
      };
    }
  }
}

// --- ADD THIS COMPLETELY SEPARATE FUNCTION ---
export async function generateFluxImageDirect(
  prompt: string
): Promise<{ success: boolean; result_url?: string; error?: string }> {
  try {
    // Direct call to your backend without any authentication
    const apiEndpoint = "http://localhost:8000/api/py/flux-schnell/generate";

    console.log("Calling flux-schnell directly:", { prompt });

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", errorText);

      let detail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        detail = errorJson.detail || detail;
      } catch (e) {
        // Ignore parsing errors
      }

      throw new Error(`Backend error: ${detail}`);
    }

    const result = await response.json();
    console.log("Backend result:", result);

    if (result.status === "succeeded" && result.result_url) {
      return { success: true, result_url: result.result_url };
    } else {
      throw new Error(result.detail || "Generation failed unexpectedly");
    }
  } catch (error) {
    console.error("Direct flux generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Export singleton instance
export const aiEditorApi = new AIEditorAPI();
