import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import {
  checkEnvConfig,
  geminiApiKey,
  getGeminiApiKey,
  GEMINI_VISION_MODEL,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_VOICE,
  GEMINI_TTS_MODEL,
  GEMINI_CHAT_MODEL,
} from './env';

export {
  geminiApiKey,
  getGeminiApiKey,
  GEMINI_VISION_MODEL,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_VOICE,
  GEMINI_TTS_MODEL,
  GEMINI_CHAT_MODEL,
};

let geminiClient: GoogleGenAI | null = null;

export function isApiKeyConfigured(reqApiKey?: string): boolean {
  if (reqApiKey && reqApiKey.trim() !== '') return true;
  return checkEnvConfig().configured;
}

export function getGemini(reqApiKey?: string): GoogleGenAI {
  if (reqApiKey && reqApiKey.trim() !== '') {
    return new GoogleGenAI({
      apiKey: reqApiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  const envCheck = checkEnvConfig();
  if (!envCheck.configured) {
    throw new Error(envCheck.message);
  }

  const secretKey = getGeminiApiKey();
  if (!secretKey) {
    throw new Error('GEMINI_API_KEY is not configured in Firebase Secret Manager or server environment.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: secretKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return geminiClient;
}

export function ensureApiKey(res: Response, reqApiKey?: string): boolean {
  if (!isApiKeyConfigured(reqApiKey)) {
    res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API configuration is missing on the server.',
      instructions: 'Please configure GEMINI_API_KEY in Firebase Secret Manager (firebase functions:secrets:set GEMINI_API_KEY).',
    });
    return false;
  }
  return true;
}
