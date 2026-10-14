/**
 * Gemini API Key & Model Validator
 *
 * Validates Google Gemini API keys directly against Google's Generative Language API (v1beta)
 * using the user's selected model (default: gemini-2.5-flash) with robust error differentiation.
 * Supports both direct client-side validation and backend-proxy validation when available.
 */

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
}

export async function validateGeminiKey(
  rawKey: string,
  preferredModel: string = 'gemini-2.5-flash'
): Promise<GeminiValidationResult> {
  const key = rawKey.trim();
  if (!key) {
    return {
      valid: false,
      errorType: 'EMPTY_KEY',
      message: 'Please enter your Gemini API key.',
    };
  }

  // 1. If a custom local backend is active and responds with JSON, test it first
  try {
    const localRes = await fetch('/api/validate-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gemini-API-Key': key,
      },
      body: JSON.stringify({ apiKey: key, model: preferredModel }),
    });

    const contentType = localRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await localRes.json().catch(() => ({}));
      if (localRes.ok && data.valid) {
        return {
          valid: true,
          message: data.message || `Gemini AI (${preferredModel}) connected successfully.`,
          modelUsed: data.model || preferredModel,
        };
      }
      if (data.error && data.message) {
        return {
          valid: false,
          errorType: data.error,
          message: data.message,
        };
      }
    }
  } catch {
    // Local /api endpoint not present or network error — fall through to direct Google AI API
  }

  // 2. Direct Validation via Google Generative Language API (v1beta)
  // Google's endpoint supports CORS requests with API keys directly from web clients.
  const modelsToAttempt = [
    preferredModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let fallbackError: GeminiValidationResult = {
    valid: false,
    errorType: 'INVALID_KEY',
    message: 'The API key could not be validated. Please check the key and try again.',
  };

  for (const model of modelsToAttempt) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(key)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'ping' }],
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.candidates && data.candidates.length > 0) {
          return {
            valid: true,
            message: `Gemini AI (${model}) connected successfully.`,
            modelUsed: model,
          };
        }
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg: string = errData?.error?.message || '';
      const errStatus: string = errData?.error?.status || '';

      // Detailed categorized error responses:
      // A. Invalid Key
      if (
        res.status === 400 ||
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
        res.status === 403 ||
        errStatus === 'PERMISSION_DENIED' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('billing')
      ) {
        return {
          valid: false,
          errorType: 'PERMISSION_DENIED',
          message:
            'Permission denied for this key. Please verify that your Google Cloud / AI Studio project has billing or Gemini API enabled.',
        };
      }

      // C. Rate Limit / Quota Exceeded
      if (
        res.status === 429 ||
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

      // D. Model not supported / 404
      if (res.status === 404 || errMsg.toLowerCase().includes('not found') || errStatus === 'NOT_FOUND') {
        fallbackError = {
          valid: false,
          errorType: 'MODEL_NOT_FOUND',
          message: `Model ${model} is not available for this key. Please select an available model from the list.`,
        };
        // Continue to test the next model in the list
        continue;
      }

      fallbackError = {
        valid: false,
        errorType: 'INVALID_KEY',
        message: errMsg || 'The API key could not be validated. Please check the key.',
      };
    } catch {
      return {
        valid: false,
        errorType: 'NETWORK_ERROR',
        message: 'Unable to connect to Google Gemini AI service. Check your internet connection and try again.',
      };
    }
  }

  return fallbackError;
}
