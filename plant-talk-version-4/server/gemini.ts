import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import { checkEnvConfig, GEMINI_VISION_MODEL, GEMINI_LIVE_MODEL, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL, GEMINI_CHAT_MODEL } from './env';

export { GEMINI_VISION_MODEL, GEMINI_LIVE_MODEL, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL, GEMINI_CHAT_MODEL };

let geminiClient: GoogleGenAI | null = null;

export function isApiKeyConfigured(reqApiKey?: string): boolean {
  if (reqApiKey) return true;
  return checkEnvConfig().configured;
}

export function getGemini(reqApiKey?: string): GoogleGenAI {
  if (reqApiKey) {
    return new GoogleGenAI({
      apiKey: reqApiKey,
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

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
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
      instructions: 'Please configure GEMINI_API_KEY in the server environment.',
    });
    return false;
  }
  return true;
}
