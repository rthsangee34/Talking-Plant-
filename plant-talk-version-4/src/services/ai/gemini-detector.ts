/**
 * Automatic Gemini Version and Model Detector
 * Queries Google Generative Language API to discover available models for a provided key.
 */

export interface DetectedGeminiInfo {
  valid: boolean;
  selectedModel: string;
  allModels: string[];
  message?: string;
}

import { DEFAULT_GEMINI_MODEL, PREFERRED_GEMINI_MODELS, rankModels } from './gemini-models';

const FALLBACK_MODELS: string[] = [...PREFERRED_GEMINI_MODELS.slice(0, 4)];

export async function detectGeminiModels(apiKey: string): Promise<DetectedGeminiInfo> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      valid: false,
      selectedModel: DEFAULT_GEMINI_MODEL,
      allModels: FALLBACK_MODELS,
      message: 'API key is required.',
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg =
        errorData?.error?.message ||
        `Google AI API rejected key (Status ${response.status}). Please check your key.`;
      return {
        valid: false,
        selectedModel: DEFAULT_GEMINI_MODEL,
        allModels: FALLBACK_MODELS,
        message: errorMsg,
      };
    }

    const data = await response.json();
    const rawModels: Array<{ name: string; supportedGenerationMethods?: string[] }> = data?.models || [];

    // Filter to models that can generate text/multimodal content
    const contentModels = rawModels
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));

    const ranked = rankModels(contentModels);

    if (ranked.length === 0) {
      return {
        valid: true,
        selectedModel: DEFAULT_GEMINI_MODEL,
        allModels: FALLBACK_MODELS,
        message: 'Key validated successfully (using default models).',
      };
    }

    // NOTE: this is only the *preferred* model; gemini-validator confirms it actually generates.
    return {
      valid: true,
      selectedModel: ranked[0],
      allModels: ranked,
    };
  } catch (err: unknown) {
    console.warn('Network error during Gemini model detection:', err);
    return {
      valid: false,
      selectedModel: DEFAULT_GEMINI_MODEL,
      allModels: FALLBACK_MODELS,
      message: 'Network error connecting to Google AI. Please check your connection.',
    };
  }
}
