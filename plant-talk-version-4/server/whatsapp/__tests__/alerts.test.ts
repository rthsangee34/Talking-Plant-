/**
 * Alert engine tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectAlerts } from '../alert-engine';
import { DEFAULT_THRESHOLDS } from '../types';
import { getDataAgeMinutes, type PlantChatState } from '../../plant-state';
import type { WhatsAppConfig } from '../types';

const mockConfig: WhatsAppConfig = {
  accessToken: 'test-token',
  phoneNumberId: '123',
  businessAccountId: '456',
  verifyToken: 'verify-token',
  appSecret: 'secret',
  graphApiVersion: 'v20.0',
  ownerNumber: '1234567890',
  alertsEnabled: true,
  alertCooldownMinutes: 60,
  dailyAlertLimit: 10,
  alertTemplateName: 'alert_template',
  criticalTemplateName: 'critical_template',
  templateLanguage: 'en',
  automatedAlertsEnabled: false,
};

// Mock dependencies
vi.mock('../../plant-state', () => ({
  getPlantState: vi.fn(),
  getDataAgeMinutes: vi.fn(() => 5),
  formatSriLankanTime: vi.fn(() => '03:45 PM'),
}));

vi.mock('../client', () => ({
  sendTextMessage: vi.fn(() => Promise.resolve()),
  sendTemplateMessage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../formatter', () => ({
  formatAlertMessage: vi.fn(() => 'Alert'),
  formatRecoveryMessage: vi.fn(() => 'Recovery'),
  buildAlertTemplateParams: vi.fn(() => ['param1']),
}));

vi.mock('../alert-store', () => ({
  isAlertOnCooldown: vi.fn(() => false),
  recordAlertSent: vi.fn(),
  isDailyLimitReached: vi.fn(() => false),
  isMuted: vi.fn(() => false),
  isActiveProblem: vi.fn(() => false),
  isRecoverySent: vi.fn(() => false),
  markRecoverySent: vi.fn(),
  clearCooldown: vi.fn(),
  incrementConsecutiveCount: vi.fn(),
  getConsecutiveCount: vi.fn(() => 3),
  getOwnerLanguage: vi.fn(() => 'en'),
}));

vi.mock('../../../src/lib/api/response-logging', () => ({
  logServerEvent: vi.fn(),
  logServerError: vi.fn(),
}));

function createTestState(overrides: Partial<PlantChatState> = {}): PlantChatState {
  return {
    sensors: {
      soilMoisture: 50,
      temperature: 25,
      humidity: 60,
      light: 50,
      co2: 400,
    },
    hardware: {
      espConnected: true,
      cameraConnected: true,
    },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('detectAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDataAgeMinutes).mockReturnValue(5);
  });

  it('returns empty array when all readings are normal', () => {
    const state = createTestState();
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    expect(alerts).toHaveLength(0);
  });

  it('detects dry soil', () => {
    const state = createTestState({
      sensors: { soilMoisture: 8, temperature: 25, humidity: 60, light: 50, co2: 400 },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const dryAlert = alerts.find((a) => a.code === 'SOIL_TOO_DRY');
    expect(dryAlert).toBeDefined();
    expect(dryAlert!.severity).toBe('critical');
  });

  it('detects wet soil', () => {
    const state = createTestState({
      sensors: { soilMoisture: 95, temperature: 25, humidity: 60, light: 50, co2: 400 },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const wetAlert = alerts.find((a) => a.code === 'SOIL_TOO_WET');
    expect(wetAlert).toBeDefined();
  });

  it('detects high temperature', () => {
    const state = createTestState({
      sensors: { soilMoisture: 50, temperature: 45, humidity: 60, light: 50, co2: 400 },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const tempAlert = alerts.find((a) => a.code === 'TEMPERATURE_TOO_HIGH');
    expect(tempAlert).toBeDefined();
    expect(tempAlert!.severity).toBe('critical');
  });

  it('detects low temperature', () => {
    const state = createTestState({
      sensors: { soilMoisture: 50, temperature: 3, humidity: 60, light: 50, co2: 400 },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const tempAlert = alerts.find((a) => a.code === 'TEMPERATURE_TOO_LOW');
    expect(tempAlert).toBeDefined();
    expect(tempAlert!.severity).toBe('critical');
  });

  it('detects high CO2', () => {
    const state = createTestState({
      sensors: { soilMoisture: 50, temperature: 25, humidity: 60, light: 50, co2: 2600 },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const co2Alert = alerts.find((a) => a.code === 'CO2_TOO_HIGH');
    expect(co2Alert).toBeDefined();
    expect(co2Alert!.severity).toBe('critical');
  });

  it('detects ESP32 offline', () => {
    const state = createTestState({
      hardware: { espConnected: false, cameraConnected: true },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const espAlert = alerts.find((a) => a.code === 'ESP32_OFFLINE');
    expect(espAlert).toBeDefined();
    expect(espAlert!.severity).toBe('warning');
  });

  it('detects pest evidence from observation', () => {
    const state = createTestState({
      observation: {
        pestsDetected: true,
        pestDescription: 'Aphids on stems',
      },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const pestAlert = alerts.find((a) => a.code === 'PEST_EVIDENCE');
    expect(pestAlert).toBeDefined();
  });

  it('detects wilting from observation', () => {
    const state = createTestState({
      observation: {
        overallCondition: 'Wilting - needs water',
      },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const wiltAlert = alerts.find((a) => a.code === 'WILTING_DETECTED');
    expect(wiltAlert).toBeDefined();
  });

  it('detects stale data', () => {
    vi.mocked(getDataAgeMinutes).mockReturnValue(20);

    const state = createTestState();
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    const staleAlert = alerts.find((a) => a.code === 'SENSOR_DATA_STALE');
    expect(staleAlert).toBeDefined();
    expect(staleAlert!.severity).toBe('info');
  });

  it('skips null sensor values without erroring', () => {
    const state = createTestState({
      sensors: {
        soilMoisture: null,
        temperature: null,
        humidity: null,
        light: null,
        co2: null,
      },
    });
    const alerts = detectAlerts(state, DEFAULT_THRESHOLDS, mockConfig);
    // Should not produce any sensor-related alerts
    const sensorCodes = ['SOIL_TOO_DRY', 'SOIL_TOO_WET', 'TEMPERATURE_TOO_HIGH', 'CO2_TOO_HIGH'];
    for (const code of sensorCodes) {
      expect(alerts.find((a) => a.code === code)).toBeUndefined();
    }
  });
});
