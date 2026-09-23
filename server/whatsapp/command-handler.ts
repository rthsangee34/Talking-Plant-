/**
 * WhatsApp command handler.
 *
 * Processes text commands from the authorized owner.
 * Each command reads from the server-side plant state singleton.
 */

import { getPlantState, formatSriLankanTime } from '../plant-state';
import type { PlantChatState } from '../plant-state';
import { getGemini, isApiKeyConfigured, GEMINI_VISION_MODEL } from '../gemini';
import { PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT } from '../../src/lib/plant/prompts';
import { getTamilTemplate } from './tamil-templates';
import { sendTextMessage } from './client';
import {
  formatStatusMessage,
  formatSensorsMessage,
  formatFlowerMessage,
  formatPestsMessage,
  formatHelpMessage,
  formatUnsupportedMediaMessage,
} from './formatter';
import {
  setMuted,
  isMuted,
  getOwnerLanguage,
  setOwnerLanguage,
} from './alert-store';
import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import { detectPhotosynthesisIntent, getPhotosynthesisDialogue } from '../../src/lib/plantAnalysis/knowledge';
import { calculatePhotosynthesisAnalysis } from '../../src/lib/plantAnalysis/photosynthesisEngine';
import type { WhatsAppConfig, WhatsAppCommand, OwnerLanguage } from './types';

// Track last inbound for status endpoint
let lastInboundAt: string | null = null;

export function getLastInboundAt(): string | null {
  return lastInboundAt;
}

/**
 * Parse the raw text into a recognized command.
 */
export function parseCommand(text: string): WhatsAppCommand {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'STATUS') return 'STATUS';
  if (normalized === 'HEALTH') return 'HEALTH';
  if (normalized === 'SENSORS') return 'SENSORS';
  if (normalized === 'PHOTO') return 'PHOTO';
  if (normalized === 'FLOWER' || normalized === 'FLOWERS') return 'FLOWER';
  if (normalized === 'PESTS' || normalized === 'PEST' || normalized === 'BUGS') return 'PESTS';
  if (normalized === 'HELP' || normalized === '?') return 'HELP';
  if (normalized === 'MUTE') return 'MUTE';
  if (normalized === 'UNMUTE') return 'UNMUTE';
  if (normalized === 'LANG EN' || normalized === 'LANG ENGLISH' || normalized === 'ENGLISH') return 'LANG_EN';
  if (normalized === 'LANG TA' || normalized === 'LANG TAMIL' || normalized === 'TAMIL') return 'LANG_TA';

  return 'UNKNOWN';
}

/**
 * Handle a command from the authorized owner and send a WhatsApp response.
 */
export async function handleCommand(
  config: WhatsAppConfig,
  from: string,
  text: string,
  messageId: string
): Promise<void> {
  lastInboundAt = new Date().toISOString();
  const command = parseCommand(text);
  const lang = getOwnerLanguage();

  logServerEvent('command-handler', `Command: ${command} from ***${from.slice(-4)}`);

  try {
    switch (command) {
      case 'STATUS':
        await handleStatus(config, from, lang);
        break;
      case 'HEALTH':
        await handleHealth(config, from, lang);
        break;
      case 'SENSORS':
        await handleSensors(config, from, lang);
        break;
      case 'PHOTO':
        await handlePhoto(config, from, lang);
        break;
      case 'FLOWER':
        await handleFlower(config, from, lang);
        break;
      case 'PESTS':
        await handlePests(config, from, lang);
        break;
      case 'HELP':
        await handleHelp(config, from, lang);
        break;
      case 'MUTE':
        await handleMute(config, from, lang);
        break;
      case 'UNMUTE':
        await handleUnmute(config, from, lang);
        break;
      case 'LANG_EN':
        await handleLangSwitch(config, from, 'en');
        break;
      case 'LANG_TA':
        await handleLangSwitch(config, from, 'ta-LK');
        break;
      case 'UNKNOWN':
      default:
        await handleUnknown(config, from, text, lang);
        break;
    }
  } catch (err) {
    logServerError('command-handler', err);
    try {
      const errorMsg = lang === 'ta-LK'
        ? '🌱 மன்னிக்கவும், ஒரு பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.'
        : '🌱 Sorry, something went wrong. Please try again.';
      await sendTextMessage(config, from, errorMsg);
    } catch {
      // Failed to send error message — already logged
    }
  }
}

// ─── Command Handlers ───────────────────────────────────────────────────────

async function handleStatus(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  if (lang === 'ta-LK') {
    await handleConversationalQuery(config, to, 'நிலை எப்படி இருக்கிறது?', state, lang);
    return;
  }
  const text = formatStatusMessage(state, lang);
  await sendTextMessage(config, to, text);
}

async function handleSensors(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  const text = formatSensorsMessage(state, lang);
  await sendTextMessage(config, to, text);
}

async function handleFlower(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  const text = formatFlowerMessage(state, lang);
  await sendTextMessage(config, to, text);
}

async function handlePests(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  const text = formatPestsMessage(state, lang);
  await sendTextMessage(config, to, text);
}

async function handleHelp(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const text = formatHelpMessage(lang);
  await sendTextMessage(config, to, text);
}

async function handleMute(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  setMuted(true);
  const text = lang === 'ta-LK'
    ? '🔇 தானியங்கி எச்சரிக்கைகள் நிறுத்தப்பட்டன.\n\nமுக்கியமான (critical) எச்சரிக்கைகள் இன்னும் அனுப்பப்படும்.\nதிரும்ப தொடங்க UNMUTE அனுப்புங்கள்.'
    : '🔇 Automatic alerts paused.\n\nCritical alerts will still be sent.\nSend UNMUTE to resume.';
  await sendTextMessage(config, to, text);
}

async function handleUnmute(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  setMuted(false);
  const text = lang === 'ta-LK'
    ? '🔔 தானியங்கி எச்சரிக்கைகள் மீண்டும் தொடங்கப்பட்டன.'
    : '🔔 Automatic alerts resumed.';
  await sendTextMessage(config, to, text);
}

async function handleLangSwitch(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  setOwnerLanguage(lang);
  const text = lang === 'ta-LK'
    ? '🌱 மொழி தமிழுக்கு மாற்றப்பட்டது. இனிமேல் தமிழில் பதில் அனுப்புவேன்.'
    : '🌱 Language switched to English. I will respond in English from now on.';
  await sendTextMessage(config, to, text);
}

async function handleUnknown(config: WhatsAppConfig, to: string, text: string, lang: OwnerLanguage): Promise<void> {
  const intent = detectPhotosynthesisIntent(text);
  if (intent.isPhotosynthesis) {
    const state = getPlantState();
    const s = state.sensors;
    const activeReadings = {
      moisture: s.soilMoisture ?? 50,
      light: s.light ?? 50,
      temperature: s.temperature ?? null,
      humidity: s.humidity ?? null,
      co2: s.co2 ?? null,
      timestamp: new Date().toISOString(),
    };
    const liveAnalysis = calculatePhotosynthesisAnalysis(activeReadings, null, {
      speciesProfile: {
        speciesName: state.plantName || state.species || 'Plant',
      },
    });
    const reply = getPhotosynthesisDialogue(
      intent.factor,
      intent.suggestedMode,
      lang === 'ta-LK' ? 'ta' : 'en',
      liveAnalysis
    );
    await sendTextMessage(config, to, reply);
    return;
  }

  await handleConversationalQuery(config, to, text, getPlantState(), lang);
}

// ─── PHOTO ──────────────────────────────────────────────────────────────────

async function handlePhoto(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  const image = state.latestImage;

  if (!image?.data || !image.capturedAt) {
    const text = lang === 'ta-LK'
      ? '📷 சமீபத்திய படம் கிடைக்கவில்லை.\n\nகேமராவிலிருந்து படம் எடுக்கப்பட்ட பிறகு மீண்டும் முயற்சிக்கவும்.'
      : '📷 No recent photo available.\n\nTry again after a camera capture has been taken.';
    await sendTextMessage(config, to, text);
    return;
  }

  // Check image freshness (consider >10min old as not recent)
  const imageAge = (Date.now() - new Date(image.capturedAt).getTime()) / 60000;
  if (imageAge > 10) {
    const time = formatSriLankanTime(image.capturedAt);
    const text = lang === 'ta-LK'
      ? `📷 சமீபத்திய படம் ${time} அன்று எடுக்கப்பட்டது (${Math.round(imageAge)} நிமிடங்களுக்கு முன்).\n\nசமீபத்திய படத்திற்கு கேமராவில் புதிய படம் எடுக்கவும்.`
      : `📷 The latest photo was taken at ${time} (${Math.round(imageAge)} minutes ago).\n\nCapture a new frame on the camera for a more recent image.`;
    await sendTextMessage(config, to, text);
    return;
  }

  // WhatsApp Cloud API requires a media URL or media ID for image sending.
  // Since we have a buffer but no public URL, we send a text notification.
  // Full media upload via the Graph API media endpoint could be implemented here.
  const time = formatSriLankanTime(image.capturedAt);
  const text = lang === 'ta-LK'
    ? `📷 சமீபத்திய படம் ${time} அன்று எடுக்கப்பட்டது.\n\nஇந்த படத்தை வலைத்தள டாஷ்போர்டில் பார்க்கலாம்.`
    : `📷 Latest photo captured at ${time}.\n\nView this image on the web dashboard.`;
  await sendTextMessage(config, to, text);
}

// ─── HEALTH (AI-enhanced) ───────────────────────────────────────────────────

async function handleHealth(config: WhatsAppConfig, to: string, lang: OwnerLanguage): Promise<void> {
  const state = getPlantState();
  await handleConversationalQuery(config, to, 'என் உடல்நிலை எப்படி இருக்கிறது?', state, lang);
}

/**
 * Handle unsupported message types (images, audio, etc.)
 */
export async function handleUnsupportedMedia(
  config: WhatsAppConfig,
  from: string
): Promise<void> {
  const lang = getOwnerLanguage();
  const text = formatUnsupportedMediaMessage(lang);
  await sendTextMessage(config, from, text);
}

// ─── CONVERSATIONAL HANDLER (TAMIL ONLY) ────────────────────────────────────

async function handleConversationalQuery(config: import('./types').WhatsAppConfig, to: string, query: string, state: import('../plant-state').PlantChatState, lang: import('./types').OwnerLanguage): Promise<void> {
  if (!isApiKeyConfigured()) {
    await sendTextMessage(config, to, "இப்போது உங்களுடன் பேசுவதில் ஒரு சிறிய தடங்கல் ஏற்பட்டுள்ளது. சிறிது நேரம் கழித்து மீண்டும் பேசலாம்.");
    return;
  }

  const ai = getGemini();
  const s = state.sensors;
  
  const conditions = [];
  if (s.soilMoisture !== null) {
    if (s.soilMoisture < 20) conditions.push('needWater');
    else if (s.soilMoisture < 30) conditions.push('needWater');
    else if (s.soilMoisture > 85) conditions.push('tooMuchWater');
    else conditions.push('happyAndHealthy');
  }
  
  if (s.temperature !== null) {
    if (s.temperature > 35) conditions.push('tooHot');
    else if (s.temperature < 15) conditions.push('tooCold');
  }
  
  if (s.humidity !== null) {
    if (s.humidity > 80) conditions.push('highHumidity');
    else if (s.humidity < 30) conditions.push('lowHumidity');
  }
  
  if (s.light !== null) {
    if (s.light > 80) conditions.push('tooMuchLight');
    else if (s.light < 20) conditions.push('needLight');
    else conditions.push('happyAndHealthy');
  }

  if (state.observation?.pestsDetected) conditions.push('pestVisible');
  if (state.observation?.flowersDetected) conditions.push('flowersVisible');

  const payload = {
    plant: state.plantName || state.species || 'Plant',
    conditions,
    query,
    requestedStyle: 'warm, clear, lightly witty',
    maxSentences: 3
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    let response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: { parts: [{ text: `${PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT}\n\n${JSON.stringify(payload)}` }] },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.6,
        maxOutputTokens: 100,
        candidateCount: 1
      }
    });

    let rawText = response.text?.trim() || '';
    
    clearTimeout(timeout);
    
    let parsed: any;
    try {
      const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new Error('Failed to parse conversational JSON.');
    }
    
    // Import dynamically to avoid circular references or if top level isn't changed yet
    const { getPlantDialogue } = require('../../src/lib/plant/personality');
    
    // Default health status based on conditions list
    const healthStatus = conditions.includes('needWater') || conditions.includes('tooHot') ? 'needs_attention' : 'healthy';
    const text = getPlantDialogue(parsed.conditionKey || conditions[0] || 'happyAndHealthy', parsed.personalityTone || 'humorous', healthStatus);

    if (text && text.length > 5 && text.length < 500) {
      await sendTextMessage(config, to, text);
      return;
    }
    
    // Empty/invalid AI response fallback
    await sendTextMessage(config, to, 'மன்னிக்கவும், இப்போது என் உணர்வைத் தெளிவாகச் சொல்ல முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் என்னுடன் பேசுங்கள்.');
  } catch (err) {
    clearTimeout(timeout);
    logServerError('command-handler:tamil-ai', err);
    await sendTextMessage(config, to, 'மன்னிக்கவும், இப்போது என் உணர்வைத் தெளிவாகச் சொல்ல முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் என்னுடன் பேசுங்கள்.');
  }
}
