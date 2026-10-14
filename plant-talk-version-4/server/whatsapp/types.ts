/**
 * WhatsApp Cloud API integration types.
 * All Meta-related types, alert types, and command types for PlantChat v4.0.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  verifyToken: string;
  appSecret: string;
  graphApiVersion: string;
  ownerNumber: string;
  alertsEnabled: boolean;
  alertCooldownMinutes: number;
  dailyAlertLimit: number;
  alertTemplateName: string;
  criticalTemplateName: string;
  templateLanguage: string;
  automatedAlertsEnabled: boolean;
  lightDarkRaw?: number;
  lightBrightRaw?: number;
}

// ─── Alert System ───────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertCode =
  | 'SOIL_TOO_DRY'
  | 'SOIL_TOO_WET'
  | 'TEMPERATURE_TOO_HIGH'
  | 'TEMPERATURE_TOO_LOW'
  | 'HUMIDITY_TOO_LOW'
  | 'HUMIDITY_TOO_HIGH'
  | 'LIGHT_TOO_LOW'
  | 'LIGHT_TOO_HIGH'
  | 'CO2_TOO_HIGH'
  | 'WILTING_DETECTED'
  | 'LEAF_DISCOLORATION'
  | 'PEST_EVIDENCE'
  | 'ESP32_OFFLINE'
  | 'CAMERA_OFFLINE'
  | 'SENSOR_DATA_STALE'
  | 'RECOVERY';

export interface AlertRecord {
  code: AlertCode;
  severity: AlertSeverity;
  message: string;
  reading?: string;
  suggestion?: string;
  timestamp: string;
  sent: boolean;
  sendError?: string;
}

export interface AlertCooldownEntry {
  code: AlertCode;
  lastSentAt: string;
  consecutiveCount: number;
  recoverySent: boolean;
}

export interface AlertStoreState {
  cooldowns: Record<string, AlertCooldownEntry>;
  dailyAlertCount: number;
  dailyCountResetDate: string;
  processedMessageIds: string[];
  muted: boolean;
  activeProblems: Record<string, AlertRecord>;
  lastAlertAt: string | null;
  automatedAlertState?: AlertState;
}

export interface AlertState {
  lowLightActive: boolean;
  highLightActive: boolean;
  highTemperatureActive: boolean;
  criticalDryActive: boolean;

  lowLightReadingCount: number;
  highLightReadingCount: number;
  highTemperatureReadingCount: number;

  dryConditionStartedAt: string | null;
  dryAlertSent: boolean;

  lastAlertSentAt: string | null;
}

// ─── Sensor Thresholds ──────────────────────────────────────────────────────

export interface SensorThresholdRange {
  criticalLow?: number;
  warningLow?: number;
  warningHigh?: number;
  criticalHigh?: number;
}

export interface SensorThresholds {
  soilMoisture: SensorThresholdRange;
  temperature: SensorThresholdRange;
  humidity: SensorThresholdRange;
  light: SensorThresholdRange;
  co2: SensorThresholdRange;
}

export const DEFAULT_THRESHOLDS: SensorThresholds = {
  soilMoisture: {
    criticalLow: 10,
    warningLow: 25,
    warningHigh: 90,
  },
  temperature: {
    criticalLow: 5,
    warningLow: 12,
    warningHigh: 35,
    criticalHigh: 42,
  },
  humidity: {
    warningLow: 25,
    warningHigh: 90,
  },
  light: {
    warningLow: 10,
    warningHigh: 95,
  },
  co2: {
    warningHigh: 1500,
    criticalHigh: 2500,
  },
};

// ─── WhatsApp Commands ──────────────────────────────────────────────────────

export type WhatsAppCommand =
  | 'STATUS'
  | 'HEALTH'
  | 'SENSORS'
  | 'PHOTO'
  | 'FLOWER'
  | 'PESTS'
  | 'HELP'
  | 'MUTE'
  | 'UNMUTE'
  | 'LANG_EN'
  | 'LANG_TA'
  | 'UNKNOWN';

export type OwnerLanguage = 'en' | 'ta-LK';

export interface OwnerPreferences {
  language: OwnerLanguage;
  updatedAt: string;
}

// Webhook inbound payloads removed.

// ─── API Responses ──────────────────────────────────────────────────────────

export interface ApiErrorDetails {
  code?: number;
  message: string;
  details?: string;
  recipient: string;
  wamid?: string;
}

export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
}

export interface WhatsAppSendResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// ─── Status (safe for frontend) ─────────────────────────────────────────────

export interface WhatsAppStatus {
  configured: boolean;
  alertsEnabled: boolean;
  muted: boolean;
  ownerConfigured: boolean;
  lastOutboundMessageAt: string | null;
  lastOutboundMessageId: string | null;
  lastOutboundState: 'sending' | 'accepted_by_meta' | 'failed' | null;
  apiErrorDetails: ApiErrorDetails | null;
  mode: 'test' | 'production';
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
}
