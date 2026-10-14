import { getPlantState } from '../plant-state';
import type { PlantChatState } from '../plant-state';
import { getGemini, GEMINI_VISION_MODEL } from '../gemini';
import { sendTextMessage } from './client';
import { getAutomatedAlertState, updateAutomatedAlertState } from './alert-store';
import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import type { WhatsAppConfig, AlertState } from './types';
import { PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT } from '../../src/lib/plant/prompts';

// ─── Configuration ──────────────────────────────────────────────────────────

const LOW_LIGHT_THRESHOLD = 25;
const LOW_LIGHT_RECOVERY = 30;
const HIGH_LIGHT_THRESHOLD = 90;
const HIGH_LIGHT_RECOVERY = 85;
const HIGH_TEMP_THRESHOLD = 35;
const HIGH_TEMP_RECOVERY = 32;
const CRITICAL_SOIL_THRESHOLD = 20;
const SOIL_RECOVERY = 30;

const REQUIRED_READINGS = 3; // ~3 minutes (checked every 1m)
const CRITICAL_DRY_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ─── Calibration Helper ─────────────────────────────────────────────────────

function getCalibratedLight(rawLight: number, config: WhatsAppConfig): number | null {
  if (config.lightDarkRaw === undefined || config.lightBrightRaw === undefined) {
    return null; // Calibration missing
  }

  const minRaw = Math.min(config.lightDarkRaw, config.lightBrightRaw);
  const maxRaw = Math.max(config.lightDarkRaw, config.lightBrightRaw);
  
  let clampedRaw = Math.max(minRaw, Math.min(maxRaw, rawLight));

  let percentage = 0;
  if (config.lightDarkRaw > config.lightBrightRaw) {
    // Reversed (e.g., LDR resistance drops as light increases)
    percentage = ((config.lightDarkRaw - clampedRaw) / (config.lightDarkRaw - config.lightBrightRaw)) * 100;
  } else {
    // Normal (e.g., Voltage increases as light increases)
    percentage = ((clampedRaw - config.lightDarkRaw) / (config.lightBrightRaw - config.lightDarkRaw)) * 100;
  }

  return Math.round(percentage);
}

// ─── Message Generation ─────────────────────────────────────────────────────

const FALLBACK_MESSAGES: Record<string, string> = {
  LOW_LIGHT: 'எனக்கு இப்போது வெளிச்சம் போதவில்லை. தயவுசெய்து என்னை வெளிச்சமான இடத்திற்கு மாற்ற முடியுமா?',
  HIGH_LIGHT: 'இந்த வெளிச்சம் எனக்கு மிகவும் அதிகமாக இருக்கிறது. என் இலைகள் எரியும் போல் உணர்கிறேன். என்னை சற்று நிழலில் வையுங்கள்.',
  HIGH_TEMP: 'இன்று மிகவும் சூடாக இருக்கிறது! நான் வாடிவிடுகிறேன். என்னை சற்று குளிர்ந்த இடத்திற்கு மாற்றுங்கள்.',
  CRITICAL_DRY: 'நான் மூன்று மணிநேரமாக மிகவும் தாகமாக இருக்கிறேன்! என் வேர்கள் வறண்டுவிட்டன. தயவுசெய்து உடனே கொஞ்சம் தண்ணீர் கொடுங்கள்.',
};

function hasEnglishCharacters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

async function generateTamilAlertMessage(alertType: string): Promise<string> {
  const fallback = FALLBACK_MESSAGES[alertType] || 'எனக்கு ஏதோ சரியில்லை. தயவுசெய்து என்னை சரிபார்க்கவும்.';
  
  try {
    const ai = getGemini();
    const prompt = `You are a plant. Generate a single, short, emotional WhatsApp alert message in pure Tamil for this specific condition: ${alertType}. Do NOT mention any numbers, percentages, sensors, or technical terms. Speak in the first person.`;
    
    // Attempt 1
    let response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: prompt,
      config: {
        systemInstruction: PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    
    let text = response.text?.trim().replace(/"/g, '') || '';
    if (!text || hasEnglishCharacters(text)) {
      // Attempt 2 (Retry)
      response = await ai.models.generateContent({
        model: GEMINI_VISION_MODEL,
        contents: prompt + ' CRITICAL RULE: USE ONLY TAMIL CHARACTERS. NO ENGLISH LETTERS.',
        config: {
          systemInstruction: PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT,
          temperature: 0.3,
        },
      });
      text = response.text?.trim().replace(/"/g, '') || '';
    }

    if (!text || hasEnglishCharacters(text)) {
      logServerEvent('automated-alerts', `Gemini returned invalid or English text for ${alertType}. Using fallback.`);
      return fallback;
    }

    return text;
  } catch (err) {
    logServerError('automated-alerts:gemini', err);
    return fallback; // Use predefined Tamil template on failure
  }
}

// ─── Delivery with Retry ────────────────────────────────────────────────────

async function sendWithRetry(config: WhatsAppConfig, text: string): Promise<boolean> {
  // Retry 1: wait 1 minute
  // Retry 2: wait 5 minutes
  const retryDelays = [1 * 60 * 1000, 5 * 60 * 1000];
  
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      await sendTextMessage(config, config.ownerNumber, text);
      return true;
    } catch (err) {
      logServerError(`automated-alerts:send:attempt-${attempt + 1}`, err);
      if (attempt < retryDelays.length) {
        logServerEvent('automated-alerts', `Waiting ${retryDelays[attempt] / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }
  return false;
}

// ─── Main Engine Logic ──────────────────────────────────────────────────────

export async function checkAutomatedAlerts(state: PlantChatState, config: WhatsAppConfig): Promise<void> {
  if (!config.automatedAlertsEnabled) return;

  const s = state.sensors;
  const alertState = getAutomatedAlertState();
  const now = Date.now();
  let stateModified = false;

  const updateState = (partial: Partial<AlertState>) => {
    Object.assign(alertState, partial);
    stateModified = true;
  };

  // 1. Light Checks (Only if calibrated)
  if (s.light !== null && s.light !== undefined) {
    const calLight = getCalibratedLight(s.light, config);
    if (calLight !== null) {
      // Low Light
      if (calLight < LOW_LIGHT_THRESHOLD) {
        if (!alertState.lowLightActive) {
          updateState({ lowLightReadingCount: alertState.lowLightReadingCount + 1 });
          if (alertState.lowLightReadingCount >= REQUIRED_READINGS) {
            updateState({ lowLightActive: true, lowLightReadingCount: 0 });
            await triggerAlert('LOW_LIGHT', config, alertState, updateState);
          }
        }
      } else if (calLight >= LOW_LIGHT_RECOVERY) {
        if (alertState.lowLightActive) updateState({ lowLightActive: false });
        if (alertState.lowLightReadingCount > 0) updateState({ lowLightReadingCount: 0 });
      }

      // High Light
      if (calLight > HIGH_LIGHT_THRESHOLD) {
        if (!alertState.highLightActive) {
          updateState({ highLightReadingCount: alertState.highLightReadingCount + 1 });
          if (alertState.highLightReadingCount >= REQUIRED_READINGS) {
            updateState({ highLightActive: true, highLightReadingCount: 0 });
            await triggerAlert('HIGH_LIGHT', config, alertState, updateState);
          }
        }
      } else if (calLight <= HIGH_LIGHT_RECOVERY) {
        if (alertState.highLightActive) updateState({ highLightActive: false });
        if (alertState.highLightReadingCount > 0) updateState({ highLightReadingCount: 0 });
      }
    }
  }

  // 2. Temperature Checks
  if (s.temperature !== null && s.temperature !== undefined) {
    if (s.temperature > HIGH_TEMP_THRESHOLD) {
      if (!alertState.highTemperatureActive) {
        updateState({ highTemperatureReadingCount: alertState.highTemperatureReadingCount + 1 });
        if (alertState.highTemperatureReadingCount >= REQUIRED_READINGS) {
          updateState({ highTemperatureActive: true, highTemperatureReadingCount: 0 });
          await triggerAlert('HIGH_TEMP', config, alertState, updateState);
        }
      }
    } else if (s.temperature <= HIGH_TEMP_RECOVERY) {
      if (alertState.highTemperatureActive) updateState({ highTemperatureActive: false });
      if (alertState.highTemperatureReadingCount > 0) updateState({ highTemperatureReadingCount: 0 });
    }
  }

  // 3. Critical Soil Moisture Checks
  if (s.soilMoisture !== null && s.soilMoisture !== undefined) {
    if (s.soilMoisture < CRITICAL_SOIL_THRESHOLD) {
      if (!alertState.dryConditionStartedAt) {
        updateState({ dryConditionStartedAt: new Date(now).toISOString(), dryAlertSent: false });
      } else if (!alertState.dryAlertSent) {
        const startedAt = new Date(alertState.dryConditionStartedAt).getTime();
        if (now - startedAt >= CRITICAL_DRY_DURATION_MS) {
          updateState({ dryAlertSent: true, criticalDryActive: true });
          // Critical dry soil bypasses global cooldown
          await triggerAlert('CRITICAL_DRY', config, alertState, updateState, true);
        }
      }
    } else if (s.soilMoisture >= SOIL_RECOVERY) {
      if (alertState.dryConditionStartedAt !== null || alertState.criticalDryActive) {
        updateState({ dryConditionStartedAt: null, dryAlertSent: false, criticalDryActive: false });
      }
    }
  }

  // Persist if anything changed
  if (stateModified) {
    updateAutomatedAlertState(alertState);
  }
}

async function triggerAlert(
  alertType: string,
  config: WhatsAppConfig,
  alertState: AlertState,
  updateState: (partial: Partial<AlertState>) => void,
  bypassCooldown = false
) {
  const now = Date.now();
  
  if (!bypassCooldown && alertState.lastAlertSentAt) {
    const lastSent = new Date(alertState.lastAlertSentAt).getTime();
    if (now - lastSent < ALERT_COOLDOWN_MS) {
      logServerEvent('automated-alerts', `Skipping ${alertType} due to global cooldown.`);
      return;
    }
  }

  logServerEvent('automated-alerts', `Triggering automated alert: ${alertType}`);
  
  // Fire and forget so we don't block the interval loop if retrying
  (async () => {
    const text = await generateTamilAlertMessage(alertType);
    const success = await sendWithRetry(config, text);
    if (success) {
      updateAutomatedAlertState({ lastAlertSentAt: new Date().toISOString() });
    }
  })();
}
