/**
 * Deterministic plant problem detection engine.
 *
 * Combines ESP32 sensor readings, visual observations, hardware status,
 * and data freshness to detect genuine plant problems.
 *
 * IMPORTANT: This engine makes ALL triggering decisions deterministically.
 * Gemini is NEVER used to decide whether to send an alert — only to
 * optionally improve the wording of the message.
 */

import { getPlantState, getDataAgeMinutes } from '../plant-state';
import type { PlantChatState } from '../plant-state';
import { checkAutomatedAlerts } from './automated-alerts';
import {
  sendTextMessage,
  sendTemplateMessage,
} from './client';
import {
  formatAlertMessage,
  formatRecoveryMessage,
  buildAlertTemplateParams,
} from './formatter';
import {
  isAlertOnCooldown,
  recordAlertSent,
  isDailyLimitReached,
  isMuted,
  isActiveProblem,
  isRecoverySent,
  markRecoverySent,
  clearCooldown,
  incrementConsecutiveCount,
  getConsecutiveCount,
  getOwnerLanguage,
} from './alert-store';
import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import type {
  WhatsAppConfig,
  AlertCode,
  AlertSeverity,
  AlertRecord,
  SensorThresholds,
  SensorThresholdRange,
} from './types';
import { DEFAULT_THRESHOLDS } from './types';

// ─── Configuration ──────────────────────────────────────────────────────────

const STALE_DATA_THRESHOLD_MINUTES = 15;
const REQUIRED_CONSECUTIVE_READINGS = 2;

// Template failure tracking — don't repeatedly retry permanent template errors
let templateFailureCount = 0;
const MAX_TEMPLATE_FAILURES = 1;
let templatePermanentlyFailed = false;

// ─── Alert Check Interval ───────────────────────────────────────────────────

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startAlertEngine(config: WhatsAppConfig, intervalMs = 60_000): void {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  logServerEvent('alert-engine', `Starting alert engine (interval: ${intervalMs}ms)`);
  checkInterval = setInterval(() => {
    runAlertCheck(config).catch((err) => {
      logServerError('alert-engine:check', err);
    });
  }, intervalMs);
}

export function stopAlertEngine(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    logServerEvent('alert-engine', 'Alert engine stopped');
  }
}

// ─── Main Alert Check ───────────────────────────────────────────────────────

export async function runAlertCheck(config: WhatsAppConfig): Promise<void> {
  if (!config.alertsEnabled) return;

  const state = getPlantState();
  const thresholds = DEFAULT_THRESHOLDS; // TODO: plant-specific overrides
  const alerts = detectAlerts(state, thresholds, config);

  // Check for recoveries (active problems that are no longer detected)
  await checkRecoveries(config, state, alerts);

  // Process new alerts
  for (const alert of alerts) {
    await processAlert(config, alert, state);
  }

  // Run the new specific automated alerts engine
  if (config.automatedAlertsEnabled) {
    await checkAutomatedAlerts(state, config).catch((err) => {
      logServerError('alert-engine:automated', err);
    });
  }
}

// ─── Detection ──────────────────────────────────────────────────────────────

export function detectAlerts(
  state: PlantChatState,
  thresholds: SensorThresholds,
  config: WhatsAppConfig
): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const now = new Date().toISOString();

  // ── Stale data detection (separate from health) ──
  const dataAge = getDataAgeMinutes();
  if (dataAge > STALE_DATA_THRESHOLD_MINUTES) {
    alerts.push({
      code: 'SENSOR_DATA_STALE',
      severity: 'info',
      message: `Sensor data is ${dataAge} minutes old.`,
      reading: `Last update: ${dataAge}min ago`,
      suggestion: 'Check ESP32 connection.',
      timestamp: now,
      sent: false,
    });
  }

  // ── Hardware offline ──
  if (!state.hardware.espConnected) {
    alerts.push({
      code: 'ESP32_OFFLINE',
      severity: 'warning',
      message: 'ESP32 sensor board is offline.',
      suggestion: 'Check the USB connection and power supply.',
      timestamp: now,
      sent: false,
    });
  }

  if (!state.hardware.cameraConnected) {
    alerts.push({
      code: 'CAMERA_OFFLINE',
      severity: 'info',
      message: 'Plant camera is offline.',
      suggestion: 'Check camera connection.',
      timestamp: now,
      sent: false,
    });
  }

  // ── Sensor threshold checks (only on valid data) ──
  const s = state.sensors;

  if (s.soilMoisture != null) {
    const result = checkThreshold(s.soilMoisture, thresholds.soilMoisture);
    if (result) {
      const isDry = s.soilMoisture < (thresholds.soilMoisture.warningLow || 25);
      
      // Suppress SOIL_TOO_DRY if automated alerts handle it
      if (!(isDry && config.automatedAlertsEnabled)) {
        alerts.push({
          code: isDry ? 'SOIL_TOO_DRY' : 'SOIL_TOO_WET',
          severity: result.severity,
          message: isDry ? 'Soil moisture is too low.' : 'Soil moisture is too high.',
          reading: `Soil: ${s.soilMoisture}%`,
          suggestion: isDry ? 'Please water me gently.' : 'Reduce watering and check drainage.',
          timestamp: now,
          sent: false,
        });
      }
    }
  }

  if (s.temperature != null) {
    const result = checkThreshold(s.temperature, thresholds.temperature);
    if (result) {
      const isHigh = s.temperature > (thresholds.temperature.warningHigh || 35);
      
      // Suppress TEMPERATURE_TOO_HIGH if automated alerts handle it
      if (!(isHigh && config.automatedAlertsEnabled)) {
        alerts.push({
          code: isHigh ? 'TEMPERATURE_TOO_HIGH' : 'TEMPERATURE_TOO_LOW',
          severity: result.severity,
          message: isHigh ? 'Temperature is too high.' : 'Temperature is too low.',
          reading: `Temperature: ${s.temperature}°C`,
          suggestion: isHigh
            ? 'Move me to a cooler spot or provide shade.'
            : 'Move me to a warmer location.',
          timestamp: now,
          sent: false,
        });
      }
    }
  }

  if (s.humidity != null) {
    const result = checkThreshold(s.humidity, thresholds.humidity);
    if (result) {
      const isLow = s.humidity < (thresholds.humidity.warningLow || 25);
      alerts.push({
        code: isLow ? 'HUMIDITY_TOO_LOW' : 'HUMIDITY_TOO_HIGH',
        severity: result.severity,
        message: isLow ? 'Air humidity is too low.' : 'Air humidity is very high.',
        reading: `Humidity: ${s.humidity}%`,
        suggestion: isLow ? 'Consider misting the leaves.' : 'Improve air circulation.',
        timestamp: now,
        sent: false,
      });
    }
  }

  if (s.light != null) {
    const result = checkThreshold(s.light, thresholds.light);
    if (result) {
      const isLow = s.light < (thresholds.light.warningLow || 10);
      
      // Suppress LIGHT alerts if automated alerts handle it
      if (!config.automatedAlertsEnabled) {
        alerts.push({
          code: isLow ? 'LIGHT_TOO_LOW' : 'LIGHT_TOO_HIGH',
          severity: result.severity,
          message: isLow ? 'Light level is very low.' : 'Light level is extremely high.',
          reading: `Light: ${s.light}%`,
          suggestion: isLow
            ? 'Move me closer to a window or add a grow light.'
            : 'Provide some shade or move me from direct sunlight.',
          timestamp: now,
          sent: false,
        });
      }
    }
  }

  if (s.co2 != null) {
    const result = checkThreshold(s.co2, thresholds.co2);
    if (result) {
      alerts.push({
        code: 'CO2_TOO_HIGH',
        severity: result.severity,
        message: 'CO₂ level is elevated.',
        reading: `CO₂: ${s.co2} ppm`,
        suggestion: 'Improve ventilation in the room.',
        timestamp: now,
        sent: false,
      });
    }
  }

  // ── Visual observation-based alerts ──
  const obs = state.observation;
  if (obs) {
    if (obs.overallCondition?.toLowerCase().includes('wilt')) {
      alerts.push({
        code: 'WILTING_DETECTED',
        severity: 'warning',
        message: 'Wilting observed in visual inspection.',
        suggestion: 'Check water and temperature.',
        timestamp: now,
        sent: false,
      });
    }

    if (obs.pestsDetected === true) {
      alerts.push({
        code: 'PEST_EVIDENCE',
        severity: 'warning',
        message: 'Possible pest activity detected.',
        reading: obs.pestDescription || undefined,
        suggestion: 'Inspect the plant closely and consider treatment.',
        timestamp: now,
        sent: false,
      });
    }
  }

  return alerts;
}

// ─── Threshold Checker ──────────────────────────────────────────────────────

function checkThreshold(
  value: number,
  range: SensorThresholdRange
): { severity: AlertSeverity } | null {
  if (range.criticalLow !== undefined && value <= range.criticalLow) {
    return { severity: 'critical' };
  }
  if (range.criticalHigh !== undefined && value >= range.criticalHigh) {
    return { severity: 'critical' };
  }
  if (range.warningLow !== undefined && value <= range.warningLow) {
    return { severity: 'warning' };
  }
  if (range.warningHigh !== undefined && value >= range.warningHigh) {
    return { severity: 'warning' };
  }
  return null;
}

// ─── Alert Processing ───────────────────────────────────────────────────────

async function processAlert(
  config: WhatsAppConfig,
  alert: AlertRecord,
  state: PlantChatState
): Promise<void> {
  const lang = getOwnerLanguage();

  // Skip if daily limit reached (except critical)
  if (alert.severity !== 'critical' && isDailyLimitReached(config.dailyAlertLimit)) {
    return;
  }

  // Skip if muted (except critical)
  if (alert.severity !== 'critical' && isMuted()) {
    return;
  }

  // Skip if on cooldown
  if (isAlertOnCooldown(alert.code, config.alertCooldownMinutes)) {
    // Still track consecutive readings
    incrementConsecutiveCount(alert.code);
    return;
  }

  // Track consecutive readings
  incrementConsecutiveCount(alert.code);

  // Require consecutive confirmation (except critical)
  if (alert.severity !== 'critical' && getConsecutiveCount(alert.code) < REQUIRED_CONSECUTIVE_READINGS) {
    return;
  }

  // Send the alert
  try {
    // Try template first for proactive alerts (if templates haven't permanently failed)
    if (!templatePermanentlyFailed) {
      try {
        const templateName = alert.severity === 'critical'
          ? config.criticalTemplateName
          : config.alertTemplateName;

        await sendTemplateMessage(
          config,
          config.ownerNumber,
          templateName,
          config.templateLanguage,
          buildAlertTemplateParams(alert, state)
        );

        alert.sent = true;
        recordAlertSent(alert);
        templateFailureCount = 0;
        logServerEvent('alert-engine', `Template alert sent: ${alert.code} (${alert.severity})`);
        return;
      } catch (templateErr) {
        templateFailureCount++;
        const errMsg = templateErr instanceof Error ? templateErr.message : String(templateErr);
        logServerError('alert-engine:template', templateErr);

        // Check for permanent template errors (unapproved, not found)
        if (errMsg.includes('template') || errMsg.includes('131047') || errMsg.includes('131048')) {
          if (templateFailureCount >= MAX_TEMPLATE_FAILURES) {
            templatePermanentlyFailed = true;
            logServerEvent('alert-engine', 'Template sending permanently disabled — falling back to text messages');
          }
        }
      }
    }

    // Fallback: send as plain text message
    const text = formatAlertMessage(alert, state, lang);
    await sendTextMessage(config, config.ownerNumber, text);
    alert.sent = true;
    recordAlertSent(alert);
    logServerEvent('alert-engine', `Text alert sent: ${alert.code} (${alert.severity})`);
  } catch (err) {
    alert.sendError = err instanceof Error ? err.message : String(err);
    logServerError('alert-engine:send', err);
  }
}

// ─── Recovery Detection ─────────────────────────────────────────────────────

async function checkRecoveries(
  config: WhatsAppConfig,
  state: PlantChatState,
  currentAlerts: AlertRecord[]
): Promise<void> {
  const currentCodes = new Set(currentAlerts.map((a) => a.code));
  const lang = getOwnerLanguage();

  // Check which active problems have resolved
  const recoverableCodes: AlertCode[] = [
    'SOIL_TOO_DRY',
    'SOIL_TOO_WET',
    'TEMPERATURE_TOO_HIGH',
    'TEMPERATURE_TOO_LOW',
    'HUMIDITY_TOO_LOW',
    'HUMIDITY_TOO_HIGH',
    'CO2_TOO_HIGH',
  ];

  for (const code of recoverableCodes) {
    if (isActiveProblem(code) && !currentCodes.has(code) && !isRecoverySent(code)) {
      try {
        const text = formatRecoveryMessage(code, state, lang);
        await sendTextMessage(config, config.ownerNumber, text);
        markRecoverySent(code);
        logServerEvent('alert-engine', `Recovery sent for: ${code}`);
      } catch (err) {
        logServerError('alert-engine:recovery', err);
      }

      // Clear the cooldown so future alerts can fire
      clearCooldown(code);
    }
  }
}
