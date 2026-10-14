/**
 * WhatsApp message formatter.
 * Generates bilingual (English / Sri Lankan Tamil) status messages,
 * alert notifications, and help text for mobile display.
 */

import type { PlantChatState } from '../plant-state';
import { formatSriLankanTime } from '../plant-state';
import type { AlertRecord, OwnerLanguage } from './types';
import { sanitizePlantVoiceResponse } from '../../src/lib/plant/voice-translator';

// ─── Helpers ────────────────────────────────────────────────────────────────

function sensorLabel(value: number | null | undefined, unit: string, naText = 'N/A'): string {
  if (value === null || value === undefined) return naText;
  return `${value}${unit}`;
}

function getMoistureDescription(moisture: number | null | undefined, lang: OwnerLanguage): string {
  if (moisture === null || moisture === undefined) return lang === 'ta-LK' ? 'தரவு இல்லை' : 'No data';
  if (moisture < 20) return lang === 'ta-LK' ? 'மிகவும் உலர்ந்தது' : 'Very Dry';
  if (moisture < 30) return lang === 'ta-LK' ? 'உலர்ந்தது' : 'Dry';
  if (moisture < 70) return lang === 'ta-LK' ? 'நல்ல நிலை' : 'Good';
  if (moisture < 85) return lang === 'ta-LK' ? 'ஈரமானது' : 'Moist';
  return lang === 'ta-LK' ? 'மிகவும் ஈரமானது' : 'Very Wet';
}

// ─── STATUS ─────────────────────────────────────────────────────────────────

export function formatStatusMessage(state: PlantChatState, lang: OwnerLanguage): string {
  const s = state.sensors;
  const obs = state.observation;
  const time = formatSriLankanTime(state.updatedAt);

  if (lang === 'ta-LK') {
    const lines = [
      '🌱 PlantChat நிலை',
      '',
    ];
    if (state.plantName || state.species) {
      lines.push(`செடி: ${state.plantName || ''} ${state.species ? `(${state.species})` : ''}`);
    }
    if (obs?.overallCondition) {
      lines.push(`நிலைமை: ${obs.overallCondition}`);
    }
    lines.push('');
    lines.push(`💧 மண் ஈரப்பதம்: ${sensorLabel(s.soilMoisture, '%')} — ${getMoistureDescription(s.soilMoisture, 'ta-LK')}`);
    lines.push(`🌡 வெப்பநிலை: ${sensorLabel(s.temperature, '°C')}`);
    lines.push(`💨 ஈரப்பதம்: ${sensorLabel(s.humidity, '%')}`);
    lines.push(`☀️ ஒளி: ${sensorLabel(s.light, '%')}`);
    lines.push(`🌿 CO₂: ${sensorLabel(s.co2, ' ppm')}`);

    if (obs?.flowersDetected === true) {
      lines.push('🌸 பூக்கள்: கண்டறியப்பட்டது');
    } else if (obs?.flowersDetected === false) {
      lines.push('🌸 பூக்கள்: தெரியவில்லை');
    }

    if (obs?.pestsDetected === true) {
      lines.push(`🐛 பூச்சிகள்: ${obs.pestDescription || 'கண்டறியப்பட்டது'}`);
    } else if (obs?.pestsDetected === false) {
      lines.push('🐛 பூச்சிகள்: தெளிவான ஆதாரம் இல்லை');
    }

    if (obs?.recommendedAction) {
      lines.push('');
      lines.push(`பரிந்துரை: ${obs.recommendedAction}`);
    }

    lines.push(`புதுப்பிக்கப்பட்டது: ${time}`);

    return lines.join('\n');
  }

  // English
  const lines = [
    '🌱 PlantChat Status',
    '',
  ];
  if (state.plantName || state.species) {
    lines.push(`Plant: ${state.plantName || ''} ${state.species ? `(${state.species})` : ''}`.trim());
  }
  if (obs?.overallCondition) {
    lines.push(`Condition: ${obs.overallCondition}`);
  }
  lines.push('');
  lines.push(`💧 Soil: ${sensorLabel(s.soilMoisture, '%')} — ${getMoistureDescription(s.soilMoisture, 'en')}`);
  lines.push(`🌡 Temperature: ${sensorLabel(s.temperature, '°C')}`);
  lines.push(`💨 Humidity: ${sensorLabel(s.humidity, '%')}`);
  lines.push(`☀️ Light: ${sensorLabel(s.light, '%')}`);
  lines.push(`🌿 CO₂: ${sensorLabel(s.co2, ' ppm')}`);

  if (obs?.flowersDetected === true) {
    lines.push('🌸 Flowers: Detected');
  } else if (obs?.flowersDetected === false) {
    lines.push('🌸 Flowers: Not visible');
  }

  if (obs?.pestsDetected === true) {
    lines.push(`🐛 Pests: ${obs.pestDescription || 'Evidence detected'}`);
  } else if (obs?.pestsDetected === false) {
    lines.push('🐛 Pests: No clear evidence');
  }

  if (obs?.recommendedAction) {
    lines.push('');
    lines.push(`Suggestion: ${obs.recommendedAction}`);
  }

  lines.push(`Updated: ${time}`);

  return lines.join('\n');
}

// ─── SENSORS ────────────────────────────────────────────────────────────────

export function formatSensorsMessage(state: PlantChatState, lang: OwnerLanguage): string {
  const s = state.sensors;
  const hw = state.hardware;
  const time = formatSriLankanTime(state.updatedAt);

  if (lang === 'ta-LK') {
    return [
      '📡 ESP32 சென்சர் தரவு',
      '',
      `💧 மண் ஈரப்பதம்: ${sensorLabel(s.soilMoisture, '%')}`,
      `🌡 வெப்பநிலை: ${sensorLabel(s.temperature, '°C')}`,
      `💨 ஈரப்பதம்: ${sensorLabel(s.humidity, '%')}`,
      `☀️ ஒளி: ${sensorLabel(s.light, '%')}`,
      `🌿 CO₂: ${sensorLabel(s.co2, ' ppm')}`,
      '',
      `ESP32: ${hw.espConnected ? '🟢 இணைக்கப்பட்டுள்ளது' : '🔴 துண்டிக்கப்பட்டுள்ளது'}`,
      `கேமரா: ${hw.cameraConnected ? '🟢 இணைக்கப்பட்டுள்ளது' : '🔴 துண்டிக்கப்பட்டுள்ளது'}`,
      `நேரம்: ${time}`,
    ].join('\n');
  }

  return [
    '📡 ESP32 Sensor Readings',
    '',
    `💧 Soil Moisture: ${sensorLabel(s.soilMoisture, '%')}`,
    `🌡 Temperature: ${sensorLabel(s.temperature, '°C')}`,
    `💨 Humidity: ${sensorLabel(s.humidity, '%')}`,
    `☀️ Light: ${sensorLabel(s.light, '%')}`,
    `🌿 CO₂: ${sensorLabel(s.co2, ' ppm')}`,
    '',
    `ESP32: ${hw.espConnected ? '🟢 Connected' : '🔴 Disconnected'}`,
    `Camera: ${hw.cameraConnected ? '🟢 Connected' : '🔴 Disconnected'}`,
    `Time: ${time}`,
  ].join('\n');
}

// ─── FLOWER ─────────────────────────────────────────────────────────────────

export function formatFlowerMessage(state: PlantChatState, lang: OwnerLanguage): string {
  const obs = state.observation;

  if (lang === 'ta-LK') {
    if (obs?.flowersDetected === true) {
      return '🌸 என்னைப் பாருங்கள்! இன்று என் அழகான பூக்களை மகிழ்ச்சியாக மலர வைத்திருக்கிறேன்!';
    }
    if (obs?.flowersDetected === false && obs.flowerConfidence != null && obs.flowerConfidence > 0.3) {
      return '🌸 என் இலைகளுக்குள் சிறிய மொட்டுகள் மறைந்திருக்கலாம் போல உணர்கிறேன்.\n\nஎன் கிளைகளின் நுனிகளையும் இலைகளின் அருகிலுள்ள பகுதிகளையும் மெதுவாகப் பாருங்கள்.';
    }
    return '🌸 இப்போது தெரியும் என் கிளைகளில் பூக்கள் இல்லை. ஆனாலும் என்னை அன்பாகப் பராமரியுங்கள்; நான் தயாரானதும் பூக்கள் மலரலாம்.';
  }

  if (obs?.flowersDetected === true) {
    return "🌸 Look at me—I'm happily showing off my beautiful flowers today!";
  }
  if (obs?.flowersDetected === false && obs?.flowerConfidence != null && obs.flowerConfidence > 0.3) {
    return '🌸 I feel like tiny buds may be hiding among my leaves.\n\nPlease gently look around my branch tips and leaf corners.';
  }
  return "🌸 I'm not showing any visible flowers right now, but please keep caring for me—they may appear when I'm ready.";
}

// ─── PESTS ──────────────────────────────────────────────────────────────────

export function formatPestsMessage(state: PlantChatState, lang: OwnerLanguage): string {
  const obs = state.observation;

  if (lang === 'ta-LK') {
    if (obs?.pestsDetected === true) {
      return `🐛 என் இலைகளை ஏதோ தொந்தரவு செய்வது போல் உணர்கிறேன்.\n\n${obs.pestDescription || 'தயவு செய்து என் இலைகளை மெதுவாகச் சரிபார்க்க முடியுமா?'}`;
    }
    return '🐛 என் இலைகள் அமைதியாகவும் சுத்தமாகவும் இருக்கின்றன.';
  }

  if (obs?.pestsDetected === true) {
    return `🐛 Something seems to be bothering my leaves.\n\n${obs.pestDescription || 'Could you gently check around my leaves for me?'}`;
  }
  return '🐛 My leaves feel clean and undisturbed today.';
}

// ─── HELP ───────────────────────────────────────────────────────────────────

export function formatHelpMessage(lang: OwnerLanguage): string {
  if (lang === 'ta-LK') {
    return [
      '🌱 PlantChat கட்டளைகள்',
      '',
      'STATUS — முழு செடி நிலை',
      'HEALTH — AI உடல்நல விளக்கம்',
      'SENSORS — ESP32 சென்சர் தரவு',
      'PHOTO — சமீபத்திய படம்',
      'FLOWER — பூக்கள் நிலை',
      'PESTS — பூச்சி ஆய்வு',
      'MUTE — எச்சரிக்கைகளை நிறுத்து',
      'UNMUTE — எச்சரிக்கைகளை தொடங்கு',
      'LANG EN — ஆங்கிலத்தில் பதில்',
      'LANG TA — தமிழில் பதில்',
      'HELP — இந்த உதவி',
    ].join('\n');
  }

  return [
    '🌱 PlantChat Commands',
    '',
    'STATUS — Full plant status report',
    'HEALTH — AI health explanation',
    'SENSORS — ESP32 sensor readings',
    'PHOTO — Latest plant photo',
    'FLOWER — Flower detection status',
    'PESTS — Pest observation report',
    'MUTE — Pause non-critical alerts',
    'UNMUTE — Resume alerts',
    'LANG EN — Switch to English',
    'LANG TA — Switch to Tamil',
    'HELP — Show this help',
  ].join('\n');
}

// ─── ALERT ──────────────────────────────────────────────────────────────────

export function formatAlertMessage(alert: AlertRecord, state: PlantChatState, lang: OwnerLanguage): string {
  const time = formatSriLankanTime(alert.timestamp);
  const plantName = state.plantName || state.species || (lang === 'ta-LK' ? 'உங்கள் செடி' : 'Your plant');
  const sanitizedMsg = sanitizePlantVoiceResponse(alert.message, lang);
  const sanitizedSugg = alert.suggestion ? sanitizePlantVoiceResponse(alert.suggestion, lang) : '';

  if (lang === 'ta-LK') {
    // For Tamil, the plant speaks directly. No technical headings.
    return [
      `"${sanitizedMsg}"`,
      sanitizedSugg ? `\n${sanitizedSugg}` : ''
    ].filter(Boolean).join('');
  }

  return [
    '🌱 PlantChat Alert',
    '',
    `${plantName} wants to speak with you:`,
    '',
    `"${sanitizedMsg}"`,
    sanitizedSugg ? `Suggestion: ${sanitizedSugg}` : '',
    `Time: ${time}`,
    '',
    'Reply STATUS for full plant state.',
  ].filter(Boolean).join('\n');
}

// ─── RECOVERY ───────────────────────────────────────────────────────────────

export function formatRecoveryMessage(resolvedCode: string, state: PlantChatState, lang: OwnerLanguage): string {
  const time = formatSriLankanTime();
  const plantName = state.plantName || (lang === 'ta-LK' ? 'உங்கள் செடி' : 'Your plant');

  const codeDescriptions: Record<string, { en: string; ta: string }> = {
    SOIL_TOO_DRY: { en: 'Soil moisture has returned to a healthy level.', ta: 'மண் ஈரப்பதம் ஆரோக்கியமான நிலைக்கு திரும்பியுள்ளது.' },
    SOIL_TOO_WET: { en: 'Soil moisture has returned to normal.', ta: 'மண் ஈரப்பதம் சாதாரண நிலைக்கு திரும்பியுள்ளது.' },
    TEMPERATURE_TOO_HIGH: { en: 'Temperature has come down to a safe range.', ta: 'வெப்பநிலை பாதுகாப்பான நிலைக்கு குறைந்துள்ளது.' },
    TEMPERATURE_TOO_LOW: { en: 'Temperature has risen to a safe range.', ta: 'வெப்பநிலை பாதுகாப்பான நிலைக்கு உயர்ந்துள்ளது.' },
    CO2_TOO_HIGH: { en: 'CO₂ levels are back to normal.', ta: 'CO₂ அளவு சாதாரண நிலைக்கு திரும்பியுள்ளது.' },
  };

  const desc = codeDescriptions[resolvedCode];
  const msg = desc ? (lang === 'ta-LK' ? desc.ta : desc.en) : (lang === 'ta-LK' ? 'நிலை சாதாரணமாக மாறியுள்ளது.' : 'The condition has returned to normal.');

  if (lang === 'ta-LK') {
    // For Tamil, the plant speaks directly. No technical headings.
    return `"${msg}"`;
  }

  return `✅ ${plantName} has recovered!\n\n${msg}\n\nTime: ${time}`;
}

// ─── UNAUTHORIZED ───────────────────────────────────────────────────────────

export function formatUnauthorizedMessage(): string {
  return '🌱 This PlantChat bot is private. Contact the owner for access.';
}

// ─── UNSUPPORTED MEDIA ──────────────────────────────────────────────────────

export function formatUnsupportedMediaMessage(lang: OwnerLanguage): string {
  if (lang === 'ta-LK') {
    return '🌱 மன்னிக்கவும், நான் உரைச் செய்திகளை மட்டுமே புரிந்துகொள்வேன். கட்டளைகளுக்கு HELP என்று அனுப்புங்கள்.';
  }
  return '🌱 Sorry, I only understand text messages. Send HELP for available commands.';
}

// ─── TEMPLATE PARAMETER BUILDERS ────────────────────────────────────────────

/**
 * Build template parameters for plant_health_alert.
 * Template: {{1}} needs attention. Problem: {{2}} Reading: {{3}} Suggestion: {{4}} Time: {{5}}
 */
export function buildAlertTemplateParams(
  alert: AlertRecord,
  state: PlantChatState
): string[] {
  const plantName = state.plantName || state.species || 'Your plant';
  return [
    plantName,
    alert.message,
    alert.reading || 'N/A',
    alert.suggestion || 'Check your plant.',
    formatSriLankanTime(alert.timestamp),
  ];
}
