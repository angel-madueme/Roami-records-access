/**
 * Central configuration for all changeable AI-flow values.
 * Keep route handlers free of model, limit, timeout, and concurrency literals.
 */
export const AI_CONFIG = {
  gemini: {
    model: "gemini-3-flash-preview",
    // The extraction shape is compact; this cap avoids waiting for unnecessary output.
    maxOutputTokens: 2048,
    // Low temperature keeps extraction deterministic and factual.
    temperature: 0.1,
    timeoutMs: 30_000,
  },
  deepseek: {
    // DeepSeek's current API identifier for the PRD's V4.1 Flash model.
    model: "deepseek-flash",
    maxOutputTokens: 1024,
    // Moderate temperature supports useful generative expansion while staying grounded.
    temperature: 0.5,
    timeoutMs: 20_000,
    baseUrl: "https://api.deepseek.com",
  },
  concurrency: {
    maxGeminiExtractions: 2,
  },
  rateLimits: {
    upload: {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    },
    expand: {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    },
  },
  upload: {
    maxFileSizeBytes: 20 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png"] as const,
  },
  client: {
    jobPollIntervalMs: 1_000,
    loadingMessageIntervalMs: 2_800,
  },
} as const;
