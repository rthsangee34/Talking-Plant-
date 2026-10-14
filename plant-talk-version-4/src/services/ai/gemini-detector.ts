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

const PREFERRED_MODEL_ORDER = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
];

export async function detectGeminiModels(apiKey: string): Promise<DetectedGeminiInfo> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      valid: false,
      selectedModel: 'gemini-2.5-flash',
      allModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
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
        selectedModel: 'gemini-2.5-flash',
        allModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
        message: errorMsg,
      };
    }

    const data = await response.json();
    const rawModels: Array<{ name: string; supportedGenerationMethods?: string[] }> = data?.models || [];

    // Filter to models that can generate text/multimodal content
    const contentModels = rawModels
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));

    if (contentModels.length === 0) {
      return {
        valid: true,
        selectedModel: 'gemini-2.5-flash',
        allModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
        message: 'Key validated successfully (using default models).',
      };
    }

    // Pick top preferred model from the discovered list
    let selected = contentModels[0];
    for (const preferred of PREFERRED_MODEL_ORDER) {
      if (contentModels.includes(preferred)) {
        selected = preferred;
        break;
      }
    }

    return {
      valid: true,
      selectedModel: selected,
      allModels: contentModels,
    };
  } catch (err: unknown) {
    console.warn('Network error during Gemini model detection:', err);
    return {
      valid: false,
      selectedModel: 'gemini-2.5-flash',
      allModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
      message: 'Network error connecting to Google AI. Please check your connection.',
    };
  }
}
