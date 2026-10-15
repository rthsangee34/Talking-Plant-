/**
 * Gemini API Key & Model Validator
 *
 * Validates Google Gemini API keys directly against Google's Generative Language API (v1beta).
 * Leverages GET /v1beta/models as the primary verification of key authenticity and permissions,
 * discovers all valid models supported by the key, and tests content generation.
 */

import { DEFAULT_GEMINI_MODEL, isChatCapableModel, rankModels } from './gemini-models';

export interface GeminiValidationResult {
  valid: boolean;
  errorType?:
    | 'EMPTY_KEY'
    | 'INVALID_KEY'
    | 'PERMISSION_DENIED'
    | 'RATE_LIMITED'
    | 'MODEL_NOT_FOUND'
    | 'NETWORK_ERROR';
  message: string;
  modelUsed?: string;
  availableModels?: string[];
}

export async function validateGeminiKey(
  rawKey: string,
  preferredModel?: string
): Promise<GeminiValidationResult> {
  const key = rawKey.trim();
  if (!key) {
    return {
      valid: false,
      errorType: 'EMPTY_KEY',
      message: 'Please enter your Gemini API key.',
    };
  }

  // Step 1: Query Google's Generative Language API model registry
  // This verifies key validity, permissions, quota, and fetches exact models for this key
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    if (!listRes.ok) {
      const errData = await listRes.json().catch(() => ({}));
      const errMsg: string = errData?.error?.message || '';
      const errStatus: string = errData?.error?.status || '';

      // A. Invalid Key
      if (
        listRes.status === 400 ||
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errStatus === 'INVALID_ARGUMENT'
      ) {
        return {
          valid: false,
          errorType: 'INVALID_KEY',
          message: 'API key is invalid. Please check your Gemini API key from Google AI Studio.',
        };
      }

      // B. Permission / Billing Disabled
      if (
        listRes.status === 403 ||
        errStatus === 'PERMISSION_DENIED' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('billing')
      ) {
        return {
          valid: false,
          errorType: 'PERMISSION_DENIED',
          message:
            'Permission denied for this key. Please verify that your Google Cloud / AI Studio project has billing or Gemini API access enabled.',
        };
      }

      // C. Rate Limit / Quota Exceeded
      if (
        listRes.status === 429 ||
        errStatus === 'RESOURCE_EXHAUSTED' ||
        errMsg.toLowerCase().includes('quota')
      ) {
        return {
          valid: false,
          errorType: 'RATE_LIMITED',
          message:
            'Gemini request quota exceeded. Please check your usage limits or billing in Google AI Studio.',
        };
      }

      return {
        valid: false,
        errorType: 'INVALID_KEY',
        message: errMsg || 'The API key could not be validated. Please check the key.',
      };
    }

    // Step 2: HTTP 200 — Key is 100% valid! Discover exact supported models
    const listData = await listRes.json().catch(() => ({}));
    const rawModels: Array<{
      name: string;
      supportedGenerationMethods?: string[];
      supported_generation_methods?: string[];
    }> = listData?.models || [];

    const discoveredModels = rawModels
      .filter((m) => {
        const methods = m.supportedGenerationMethods || m.supported_generation_methods || [];
        return methods.length === 0 || methods.includes('generateContent');
      })
      .map((m) => m.name.replace(/^models\//, ''));

    // Being LISTED does not mean a model is usable (retired models still list
    // but return 404 on generateContent). Probe candidates until one answers.
    const candidates = rankModels(discoveredModels, preferredModel);
    if (candidates.length === 0) candidates.push(DEFAULT_GEMINI_MODEL);

    const chatModels = discoveredModels.filter(isChatCapableModel);
    let lastStatus = 0;
    let networkFailures = 0;

    // Step 3: Test generation, falling through retired / unavailable models
    for (const candidate of candidates.slice(0, 6)) {
      try {
        const pingRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            candidate
          )}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'ping' }] }],
            }),
          }
        );

        if (pingRes.ok) {
          return {
            valid: true,
            message: `Gemini AI (${candidate}) connected successfully!`,
            modelUsed: candidate,
            availableModels: chatModels.length > 0 ? rankModels(chatModels, candidate) : [candidate],
          };
        }

        lastStatus = pingRes.status;
        if (pingRes.status === 429) {
          return {
            valid: false,
            errorType: 'RATE_LIMITED',
            message:
              'Gemini request quota exceeded. Please check your usage limits or billing in Google AI Studio.',
          };
        }
        if (pingRes.status === 401 || pingRes.status === 403) {
          return {
            valid: false,
            errorType: 'PERMISSION_DENIED',
            message: 'This key is not allowed to generate content. Check the key restrictions in Google AI Studio.',
          };
        }
        // 404 / 400 / 5xx -> try the next model
      } catch {
        networkFailures++;
      }
    }

    if (networkFailures > 0 && lastStatus === 0) {
      return {
        valid: false,
        errorType: 'NETWORK_ERROR',
        message: 'Unable to reach Google Gemini AI service. Check your internet connection and try again.',
      };
    }

    return {
      valid: false,
      errorType: 'MODEL_NOT_FOUND',
      message:
        'Your API key is valid, but none of the available Gemini models accepted a request. Please try again later.',
    };
  } catch {
    return {
      valid: false,
      errorType: 'NETWORK_ERROR',
      message: 'Unable to connect to Google Gemini AI service. Check your internet connection and try again.',
    };
  }
}
