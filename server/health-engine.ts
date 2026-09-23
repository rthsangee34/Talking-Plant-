/**
 * Deterministic Plant Health Engine, Trend Analysis, Anomaly Detection & Alerting
 *
 * Implements code/math-driven health scoring without relying on AI:
 * 1. Health Score (0-100) + Status (HEALTHY, ATTENTION, STRESSED, CRITICAL)
 * 2. Species-specific threshold profiles
 * 3. Trend analysis (gradual drying, rapid drops, watering detection)
 * 4. Anomaly detection (sudden spikes, rate-of-change anomalies)
 * 5. Debounced alert generation with cooldown and bilingual messages (English + Tamil)
 */

import { getPlantState } from './plant-state';
import {
  getRecentReadings,
  broadcastSse,
  saveHistoricalSample,
  onTelemetry,
  type ValidatedTelemetry,
} from './telemetry-store';
import type {
  PlantHealthStatus,
  HealthScoreBreakdown,
  PlantThresholdConfig,
  TrendAnalysisResult,
  AnomalyEvent,
  MonitoringAlert,
  PlantTimelineEvent,
} from '../src/types/plantMonitoring';
import { logServerEvent, logServerError } from '../src/lib/api/response-logging';

// ─── Plant Species Profiles ─────────────────────────────────────────────────

export const SPECIES_THRESHOLDS: Record<string, PlantThresholdConfig> = {
  'boston-fern': {
    id: 'boston-fern',
    species: 'Boston Fern',
    minMoisture: 40,
    maxMoisture: 70,
    criticalMinMoisture: 20,
    criticalMaxMoisture: 85,
    minTemp: 16,
    maxTemp: 28,
    minHumidity: 50,
    maxHumidity: 80,
    minLight: 30,
    maxLight: 75,
  },
  'peace-lily': {
    id: 'peace-lily',
    species: 'Peace Lily',
    minMoisture: 35,
    maxMoisture: 65,
    criticalMinMoisture: 18,
    criticalMaxMoisture: 80,
    minTemp: 18,
    maxTemp: 29,
    minHumidity: 45,
    maxHumidity: 75,
    minLight: 25,
    maxLight: 60,
  },
  'monstera': {
    id: 'monstera',
    species: 'Monstera Deliciosa',
    minMoisture: 30,
    maxMoisture: 60,
    criticalMinMoisture: 15,
    criticalMaxMoisture: 80,
    minTemp: 18,
    maxTemp: 30,
    minHumidity: 40,
    maxHumidity: 80,
    minLight: 35,
    maxLight: 80,
  },
  'succulent': {
    id: 'succulent',
    species: 'Succulent / Cactus',
    minMoisture: 10,
    maxMoisture: 30,
    criticalMinMoisture: 5,
    criticalMaxMoisture: 55,
    minTemp: 14,
    maxTemp: 35,
    minHumidity: 20,
    maxHumidity: 50,
    minLight: 50,
    maxLight: 100,
  },
  'rose': {
    id: 'rose',
    species: 'Rose',
    minMoisture: 35,
    maxMoisture: 65,
    criticalMinMoisture: 20,
    criticalMaxMoisture: 80,
    minTemp: 15,
    maxTemp: 28,
    minHumidity: 40,
    maxHumidity: 70,
    minLight: 55,
    maxLight: 95,
  },
  'aloe-vera': {
    id: 'aloe-vera',
    species: 'Aloe Vera',
    minMoisture: 15,
    maxMoisture: 35,
    criticalMinMoisture: 8,
    criticalMaxMoisture: 60,
    minTemp: 16,
    maxTemp: 32,
    minHumidity: 25,
    maxHumidity: 55,
    minLight: 45,
    maxLight: 85,
  },
  'tomato': {
    id: 'tomato',
    species: 'Tomato',
    minMoisture: 50,
    maxMoisture: 75,
    criticalMinMoisture: 25,
    criticalMaxMoisture: 90,
    minTemp: 18,
    maxTemp: 32,
    minHumidity: 45,
    maxHumidity: 70,
    minLight: 60,
    maxLight: 100,
  },
  'basil': {
    id: 'basil',
    species: 'Basil',
    minMoisture: 45,
    maxMoisture: 70,
    criticalMinMoisture: 22,
    criticalMaxMoisture: 85,
    minTemp: 18,
    maxTemp: 28,
    minHumidity: 40,
    maxHumidity: 65,
    minLight: 50,
    maxLight: 80,
  },
  'money-plant': {
    id: 'money-plant',
    species: 'Money Plant',
    minMoisture: 30,
    maxMoisture: 60,
    criticalMinMoisture: 15,
    criticalMaxMoisture: 80,
    minTemp: 17,
    maxTemp: 30,
    minHumidity: 40,
    maxHumidity: 75,
    minLight: 30,
    maxLight: 70,
  },
  'default': {
    id: 'default',
    species: 'Indoor Plant',
    minMoisture: 40,
    maxMoisture: 70,
    criticalMinMoisture: 20,
    criticalMaxMoisture: 85,
    minTemp: 18,
    maxTemp: 28,
    minHumidity: 40,
    maxHumidity: 75,
    minLight: 30,
    maxLight: 75,
  },
};

export function getPlantThresholds(speciesName?: string): PlantThresholdConfig {
  if (!speciesName) return SPECIES_THRESHOLDS['default'];
  const normalized = speciesName.toLowerCase();
  for (const [key, config] of Object.entries(SPECIES_THRESHOLDS)) {
    if (normalized.includes(key) || normalized.includes(config.species.toLowerCase())) {
      return config;
    }
  }
  return SPECIES_THRESHOLDS['default'];
}

// ─── Health Evaluation ──────────────────────────────────────────────────────

export function calculateHealthBreakdown(
  telemetry: ValidatedTelemetry,
  thresholds: PlantThresholdConfig,
  stabilityVariance = 0
): HealthScoreBreakdown {
  // Moisture score (0-100)
  let moistureScore = 100;
  if (telemetry.soilMoisture < thresholds.minMoisture) {
    const range = thresholds.minMoisture - thresholds.criticalMinMoisture;
    const diff = thresholds.minMoisture - telemetry.soilMoisture;
    const ratio = Math.min(1, Math.max(0, diff / (range || 1)));
    moistureScore = Math.max(10, Math.round(100 - ratio * 90));
  } else if (telemetry.soilMoisture > thresholds.maxMoisture) {
    const diff = telemetry.soilMoisture - thresholds.maxMoisture;
    moistureScore = Math.max(20, Math.round(100 - (diff / 25) * 80));
  }

  // Temperature score (0-100)
  let tempScore = 85;
  if (telemetry.temperature !== null) {
    if (telemetry.temperature >= thresholds.minTemp && telemetry.temperature <= thresholds.maxTemp) {
      tempScore = 100;
    } else if (telemetry.temperature < thresholds.minTemp) {
      const diff = thresholds.minTemp - telemetry.temperature;
      tempScore = Math.max(10, Math.round(100 - diff * 12));
    } else {
      const diff = telemetry.temperature - thresholds.maxTemp;
      tempScore = Math.max(10, Math.round(100 - diff * 12));
    }
  }

  // Humidity score (0-100)
  let humidityScore = 85;
  if (telemetry.humidity !== null) {
    if (telemetry.humidity >= thresholds.minHumidity && telemetry.humidity <= thresholds.maxHumidity) {
      humidityScore = 100;
    } else {
      const diff = telemetry.humidity < thresholds.minHumidity
        ? thresholds.minHumidity - telemetry.humidity
        : telemetry.humidity - thresholds.maxHumidity;
      humidityScore = Math.max(20, Math.round(100 - diff * 2));
    }
  }

  // Light score (0-100)
  let lightScore = 85;
  if (telemetry.light !== null) {
    if (telemetry.light >= thresholds.minLight && telemetry.light <= thresholds.maxLight) {
      lightScore = 100;
    } else {
      const diff = telemetry.light < thresholds.minLight
        ? thresholds.minLight - telemetry.light
        : telemetry.light - thresholds.maxLight;
      lightScore = Math.max(30, Math.round(100 - diff * 1.5));
    }
  }

  // Stability score (0-100)
  const stabilityScore = Math.max(20, Math.min(100, Math.round(100 - stabilityVariance * 10)));

  // Transparent weighted calculation
  const overall = Math.round(
    0.35 * moistureScore +
    0.25 * tempScore +
    0.20 * humidityScore +
    0.10 * lightScore +
    0.10 * stabilityScore
  );

  let status: PlantHealthStatus = 'HEALTHY';
  if (overall < 40 || moistureScore <= 25 || tempScore <= 25) {
    status = 'CRITICAL';
  } else if (overall < 60 || moistureScore <= 50) {
    status = 'STRESSED';
  } else if (overall < 80) {
    status = 'ATTENTION';
  }

  let summary = 'Environmental conditions appear balanced.';
  if (status === 'CRITICAL') {
    summary = moistureScore < 30 ? 'Critical low soil moisture detected.' : 'Extreme temperature or environmental stress.';
  } else if (status === 'STRESSED') {
    summary = 'Soil moisture or climate outside configured optimal boundaries.';
  } else if (status === 'ATTENTION') {
    summary = 'Mild deviation from target ranges. Keep monitoring.';
  }

  return {
    overall,
    moistureScore,
    tempScore,
    humidityScore,
    lightScore,
    stabilityScore,
    status,
    summary,
  };
}

// ─── Trend Analysis ─────────────────────────────────────────────────────────

export function analyzeTrends(recent: ValidatedTelemetry[]): TrendAnalysisResult[] {
  if (recent.length < 3) {
    return [];
  }

  const results: TrendAnalysisResult[] = [];
  const oldest = recent[0];
  const newest = recent[recent.length - 1];

  const timeDiffHours = (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 3600_000;
  const effectiveHours = Math.max(0.05, timeDiffHours); // Avoid division by near-zero in short buffers

  // Soil moisture trend
  const moistureDelta = newest.soilMoisture - oldest.soilMoisture;
  const moistureRate = Math.round((moistureDelta / effectiveHours) * 10) / 10;

  let moistureDirection: TrendAnalysisResult['direction'] = 'stable';
  let moistureDesc = 'Soil moisture is stable.';
  let moistureDescTamil = 'மண்ணின் ஈரப்பதம் சீராக உள்ளது.';

  if (moistureDelta <= -15 && effectiveHours < 0.2) {
    moistureDirection = 'rapid_drop';
    moistureDesc = `Rapid moisture drop detected (${Math.abs(moistureDelta)}% change). Check for soil desiccation.`;
    moistureDescTamil = `ஈரப்பதத்தில் திடீர் வீழ்ச்சி (${Math.abs(moistureDelta)}%). மண்ணைச் சரிபார்க்கவும்.`;
  } else if (moistureRate < -2) {
    moistureDirection = 'decreasing';
    moistureDesc = `Gradual moisture decrease (${Math.abs(moistureRate)}%/hr).`;
    moistureDescTamil = `மண்ணின் ஈரப்பதம் படிப்படியாக குறைகிறது (${Math.abs(moistureRate)}%/மணி).`;
  } else if (moistureDelta >= 15) {
    moistureDirection = 'rapid_rise';
    moistureDesc = `Watering event detected! Moisture increased by ${moistureDelta}%.`;
    moistureDescTamil = `தண்ணீர் ஊற்றப்பட்டது கண்டறியப்பட்டது! ஈரப்பதம் ${moistureDelta}% அதிகரித்துள்ளது.`;
  } else if (moistureRate > 2) {
    moistureDirection = 'increasing';
    moistureDesc = `Moisture increasing (${moistureRate}%/hr).`;
    moistureDescTamil = `ஈரப்பதம் அதிகரிக்கிறது.`;
  }

  results.push({
    parameter: 'soilMoisture',
    direction: moistureDirection,
    ratePerHour: moistureRate,
    description: moistureDesc,
    tamilDescription: moistureDescTamil,
  });

  return results;
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────

export function detectAnomalies(recent: ValidatedTelemetry[]): AnomalyEvent | null {
  if (recent.length < 2) return null;

  const current = recent[recent.length - 1];
  const prev = recent[recent.length - 2];

  // Sudden moisture drop > 15% between consecutive readings
  const moistureDrop = prev.soilMoisture - current.soilMoisture;
  if (moistureDrop >= 15) {
    return {
      id: `anomaly-moisture-${Date.now()}`,
      parameter: 'soilMoisture',
      detectedValue: current.soilMoisture,
      previousValue: prev.soilMoisture,
      delta: -moistureDrop,
      severity: current.soilMoisture < 25 ? 'CRITICAL' : 'ATTENTION',
      timestamp: current.timestamp,
      message: `Sudden soil moisture drop of ${moistureDrop}% detected (${prev.soilMoisture}% → ${current.soilMoisture}%).`,
      tamilMessage: `மண்ணின் ஈரப்பதத்தில் திடீர் சரிவு (${prev.soilMoisture}% → ${current.soilMoisture}%).`,
    };
  }

  // Sudden temperature spike > 6°C
  if (current.temperature !== null && prev.temperature !== null) {
    const tempJump = current.temperature - prev.temperature;
    if (Math.abs(tempJump) >= 6) {
      return {
        id: `anomaly-temp-${Date.now()}`,
        parameter: 'temperature',
        detectedValue: current.temperature,
        previousValue: prev.temperature,
        delta: tempJump,
        severity: 'ATTENTION',
        timestamp: current.timestamp,
        message: `Sudden temperature shift of ${tempJump > 0 ? '+' : ''}${tempJump.toFixed(1)}°C detected.`,
        tamilMessage: `வெப்பநிலையில் திடீர் மாற்றம் (${tempJump > 0 ? '+' : ''}${tempJump.toFixed(1)}°C).`,
      };
    }
  }

  return null;
}

// ─── Alert Engine & Debounced Cooldown ──────────────────────────────────────

const alertCooldowns = new Map<string, number>();
const activeAlerts = new Map<string, MonitoringAlert>();
const timelineEvents: PlantTimelineEvent[] = [];
const DEFAULT_ALERT_COOLDOWN_MS = 5 * 60_000; // 5 minutes cooldown per alert code

export function processHealthAndAlerts(telemetry: ValidatedTelemetry): {
  health: HealthScoreBreakdown;
  trends: TrendAnalysisResult[];
  anomaly: AnomalyEvent | null;
  newAlert: MonitoringAlert | null;
} {
  const state = getPlantState();
  const thresholds = getPlantThresholds(state.species || state.plantName);

  const recent = getRecentReadings(15);
  const health = calculateHealthBreakdown(telemetry, thresholds);
  const trends = analyzeTrends(recent);
  const anomaly = detectAnomalies(recent);

  let newAlert: MonitoringAlert | null = null;
  const now = Date.now();

  // Check 1: Critical Low Moisture
  if (telemetry.soilMoisture <= thresholds.criticalMinMoisture) {
    const code = 'LOW_MOISTURE_CRITICAL';
    const lastSent = alertCooldowns.get(code) || 0;
    if (now - lastSent > DEFAULT_ALERT_COOLDOWN_MS) {
      alertCooldowns.set(code, now);
      newAlert = {
        id: `alert-${now}`,
        level: 'CRITICAL',
        code,
        title: 'Critical Soil Dryness Detected',
        message: `Soil moisture is at ${telemetry.soilMoisture}% (Critical minimum: ${thresholds.criticalMinMoisture}%). Immediate watering recommended.`,
        tamilMessage: `மண்ணின் ஈரப்பதம் மிகவும் குறைவாக ${telemetry.soilMoisture}% ஆக உள்ளது. உடனடியாக தண்ணீர் ஊற்றவும்!`,
        parameter: 'soilMoisture',
        currentReading: telemetry.soilMoisture,
        configuredRange: `${thresholds.minMoisture}% – ${thresholds.maxMoisture}%`,
        timestamp: new Date().toISOString(),
        recommendedAction: 'Check soil and water thoroughly.',
        recommendedActionTamil: 'மண்ணை பரிசோதித்து உடனடியாக தண்ணீர் ஊற்றவும்.',
      };
    }
  } else if (telemetry.soilMoisture < thresholds.minMoisture) {
    // Check 2: Low Moisture Attention
    const code = 'LOW_MOISTURE_ATTENTION';
    const lastSent = alertCooldowns.get(code) || 0;
    if (now - lastSent > DEFAULT_ALERT_COOLDOWN_MS) {
      alertCooldowns.set(code, now);
      newAlert = {
        id: `alert-${now}`,
        level: 'ATTENTION',
        code,
        title: 'Soil Moisture Below Target',
        message: `Soil moisture is ${telemetry.soilMoisture}% (Target: ${thresholds.minMoisture}%–${thresholds.maxMoisture}%).`,
        tamilMessage: `மண்ணின் ஈரப்பதம் ${telemetry.soilMoisture}% ஆக குறைந்துள்ளது.`,
        parameter: 'soilMoisture',
        currentReading: telemetry.soilMoisture,
        configuredRange: `${thresholds.minMoisture}% – ${thresholds.maxMoisture}%`,
        timestamp: new Date().toISOString(),
        recommendedAction: 'Schedule watering soon.',
        recommendedActionTamil: 'விரைவில் தண்ணீர் ஊற்ற திட்டமிடுங்கள்.',
      };
    }
  } else if (telemetry.soilMoisture > thresholds.criticalMaxMoisture) {
    // Check 3: Waterlogged
    const code = 'HIGH_MOISTURE_WATERLOGGED';
    const lastSent = alertCooldowns.get(code) || 0;
    if (now - lastSent > DEFAULT_ALERT_COOLDOWN_MS) {
      alertCooldowns.set(code, now);
      newAlert = {
        id: `alert-${now}`,
        level: 'ATTENTION',
        code,
        title: 'Soil Waterlogged',
        message: `Soil moisture is ${telemetry.soilMoisture}% (Upper threshold: ${thresholds.maxMoisture}%). Ensure proper pot drainage.`,
        tamilMessage: `மண்ணில் அதிகப்படியான தண்ணீர் உள்ளது (${telemetry.soilMoisture}%). வடிகால் வசதியை சரிபார்க்கவும்.`,
        parameter: 'soilMoisture',
        currentReading: telemetry.soilMoisture,
        configuredRange: `${thresholds.minMoisture}% – ${thresholds.maxMoisture}%`,
        timestamp: new Date().toISOString(),
        recommendedAction: 'Check drainage holes to prevent root rot.',
        recommendedActionTamil: 'வேர் அழுகலைத் தடுக்க வடிகால் துளைகளை சரிபார்க்கவும்.',
      };
    }
  }

  // Check 4: Extreme Temperature
  if (!newAlert && telemetry.temperature !== null) {
    if (telemetry.temperature > thresholds.maxTemp + 5) {
      const code = 'HEATWAVE_CRITICAL';
      const lastSent = alertCooldowns.get(code) || 0;
      if (now - lastSent > DEFAULT_ALERT_COOLDOWN_MS) {
        alertCooldowns.set(code, now);
        newAlert = {
          id: `alert-${now}`,
          level: 'CRITICAL',
          code,
          title: 'High Heatwave Stress',
          message: `Temperature reached ${telemetry.temperature}°C (Optimal maximum: ${thresholds.maxTemp}°C).`,
          tamilMessage: `அதிக வெப்பநிலை கண்டறியப்பட்டது (${telemetry.temperature}°C).`,
          parameter: 'temperature',
          currentReading: telemetry.temperature,
          configuredRange: `${thresholds.minTemp}°C – ${thresholds.maxTemp}°C`,
          timestamp: new Date().toISOString(),
          recommendedAction: 'Move to a cooler spot or provide shade.',
          recommendedActionTamil: 'குளிர்ந்த இடத்திற்கு மாற்றவும் அல்லது நிழல் வழங்கவும்.',
        };
      }
    }
  }

  // Check 5: Sudden Anomaly
  if (!newAlert && anomaly) {
    const code = `ANOMALY_${anomaly.parameter.toUpperCase()}`;
    const lastSent = alertCooldowns.get(code) || 0;
    if (now - lastSent > 2 * 60_000) {
      alertCooldowns.set(code, now);
      newAlert = {
        id: `alert-${now}`,
        level: anomaly.severity,
        code,
        title: 'Sudden Environmental Anomaly',
        message: anomaly.message,
        tamilMessage: anomaly.tamilMessage,
        parameter: anomaly.parameter,
        currentReading: anomaly.detectedValue,
        configuredRange: 'Dynamic',
        timestamp: anomaly.timestamp,
        recommendedAction: 'Inspect physical plant and sensor probe.',
        recommendedActionTamil: 'செடி மற்றும் சென்சாரை நேரில் பரிசோதிக்கவும்.',
      };
    }
  }

  // If new alert, record and broadcast
  if (newAlert) {
    activeAlerts.set(newAlert.code, newAlert);
    broadcastSse('alert', newAlert);
    addTimelineEvent({
      id: `event-${now}`,
      timestamp: newAlert.timestamp,
      timeFormatted: new Date(newAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: newAlert.level === 'CRITICAL' ? 'CRITICAL' : 'ATTENTION',
      title: newAlert.title,
      description: newAlert.message,
      type: 'alert',
    });
    logServerEvent('health-engine:alert', `Triggered alert [${newAlert.level}] ${newAlert.title}`);
  }

  // Broadcast live health and trends
  broadcastSse('health', health);
  broadcastSse('trends', trends);

  return { health, trends, anomaly, newAlert };
}

// ─── Timeline Events Management ─────────────────────────────────────────────

export function addTimelineEvent(event: PlantTimelineEvent): void {
  timelineEvents.unshift(event);
  if (timelineEvents.length > 100) {
    timelineEvents.pop();
  }
  broadcastSse('timeline_event', event);
}

export function getTimelineEvents(): PlantTimelineEvent[] {
  return timelineEvents;
}

export function getActiveAlerts(): MonitoringAlert[] {
  return Array.from(activeAlerts.values());
}

// ─── Wire Health Engine to Telemetry Ingestion ──────────────────────────────
onTelemetry((telemetry) => {
  try {
    processHealthAndAlerts(telemetry);
  } catch (err) {
    logServerError('health-engine:process', err);
  }
});
