import dotenv from 'dotenv';
import path from 'path';
import type { WhatsAppConfig } from './whatsapp/types';

// Load .env.local first, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function checkEnvConfig(): { configured: boolean; message: string } {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'replace-me' || apiKey.trim() === '') {
    return {
      configured: false,
      message: 'GEMINI_API_KEY is missing or set to "replace-me". Please configure a valid Gemini API Key from Google AI Studio.',
    };
  }

  return {
    configured: true,
    message: 'GEMINI_API_KEY is successfully configured.',
  };
}

export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL?.trim() || 'gemini-3.6-flash';

export const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-3.1-flash-live-preview';

// Native female plant voice configuration (Section 8.7)
export const GEMINI_LIVE_VOICE =
  process.env.GEMINI_LIVE_VOICE?.trim() || 'Aoede';

export const GEMINI_TTS_MODEL =
  process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-3.8-flash-tts';

export const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.8-flash';

// ─── WhatsApp Configuration ──────────────────────────────────────────────────

/**
 * Build WhatsApp configuration from environment variables.
 * Returns null if the minimum required variables are missing.
 * Never logs secrets — only reports whether each variable is present.
 */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const ownerNumber = process.env.WHATSAPP_OWNER_NUMBER?.trim();

  // Minimum required
  if (!accessToken || !phoneNumberId || !verifyToken || !appSecret || !ownerNumber) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '',
    verifyToken,
    appSecret,
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v21.0',
    ownerNumber,
    alertsEnabled: process.env.WHATSAPP_ALERTS_ENABLED?.trim()?.toLowerCase() !== 'false',
    alertCooldownMinutes: parseInt(process.env.WHATSAPP_ALERT_COOLDOWN_MINUTES || '30', 10) || 30,
    dailyAlertLimit: parseInt(process.env.WHATSAPP_DAILY_ALERT_LIMIT || '20', 10) || 20,
    alertTemplateName: process.env.WHATSAPP_ALERT_TEMPLATE?.trim() || 'plant_health_alert',
    criticalTemplateName: process.env.WHATSAPP_CRITICAL_TEMPLATE?.trim() || 'plant_critical_alert',
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en',
    automatedAlertsEnabled: process.env.AUTOMATED_WHATSAPP_ALERTS?.trim()?.toLowerCase() !== 'false',
    lightDarkRaw: process.env.LIGHT_DARK_RAW ? parseInt(process.env.LIGHT_DARK_RAW, 10) : undefined,
    lightBrightRaw: process.env.LIGHT_BRIGHT_RAW ? parseInt(process.env.LIGHT_BRIGHT_RAW, 10) : undefined,
  };
}

/**
 * Get the admin secret for protected management endpoints.
 * Falls back to a random value so endpoints are always protected.
 */
export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET?.trim() || crypto.randomUUID();
}
