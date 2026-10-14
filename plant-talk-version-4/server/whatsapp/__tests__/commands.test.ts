/**
 * Command handler tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommand, handleCommand } from '../command-handler';
import { sendTextMessage } from '../client';
import type { WhatsAppConfig } from '../types';

// Mock all external dependencies
vi.mock('../client', () => ({
  sendTextMessage: vi.fn(() =>
    Promise.resolve({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'msg-1' }] })
  ),
}));

vi.mock('../../plant-state', () => ({
  getPlantState: vi.fn(() => ({
    plantName: 'Jasmine',
    species: 'Jasminum sambac',
    sensors: { soilMoisture: 45, temperature: 28, humidity: 65, light: 40, co2: 400 },
    hardware: { espConnected: true, cameraConnected: true },
    observation: {
      overallCondition: 'Good',
      sensoryNote: 'I feel great today!',
      flowersDetected: true,
      flowerConfidence: 0.85,
      pestsDetected: false,
    },
    updatedAt: new Date().toISOString(),
  })),
  formatSriLankanTime: vi.fn(() => '03:45 PM'),
}));

vi.mock('../../gemini', () => ({
  getGemini: vi.fn(),
  isApiKeyConfigured: vi.fn(() => false),
  GEMINI_VISION_MODEL: 'gemini-3.6-flash',
}));

vi.mock('../formatter', () => ({
  formatStatusMessage: vi.fn(() => 'Status message'),
  formatSensorsMessage: vi.fn(() => 'Sensors message'),
  formatFlowerMessage: vi.fn(() => 'Flower message'),
  formatPestsMessage: vi.fn(() => 'Pests message'),
  formatHelpMessage: vi.fn(() => 'Help message'),
  formatUnsupportedMediaMessage: vi.fn(() => 'Unsupported message'),
}));

vi.mock('../alert-store', () => ({
  setMuted: vi.fn(),
  isMuted: vi.fn(() => false),
  getOwnerLanguage: vi.fn(() => 'en'),
  setOwnerLanguage: vi.fn(),
}));

vi.mock('../../../src/lib/api/response-logging', () => ({
  logServerEvent: vi.fn(),
  logServerError: vi.fn(),
}));

const mockConfig: WhatsAppConfig = {
  accessToken: 'test-token',
  phoneNumberId: '123456',
  businessAccountId: 'biz-123',
  verifyToken: 'my-verify-token',
  appSecret: 'my-app-secret',
  graphApiVersion: 'v21.0',
  ownerNumber: '94771234567',
  alertsEnabled: true,
  alertCooldownMinutes: 30,
  dailyAlertLimit: 20,
  alertTemplateName: 'plant_health_alert',
  criticalTemplateName: 'plant_critical_alert',
  templateLanguage: 'en',
  automatedAlertsEnabled: true,
};

describe('parseCommand', () => {
  it('parses STATUS command', () => {
    expect(parseCommand('STATUS')).toBe('STATUS');
    expect(parseCommand('status')).toBe('STATUS');
    expect(parseCommand('  Status  ')).toBe('STATUS');
  });

  it('parses HEALTH command', () => {
    expect(parseCommand('HEALTH')).toBe('HEALTH');
    expect(parseCommand('health')).toBe('HEALTH');
  });

  it('parses SENSORS command', () => {
    expect(parseCommand('SENSORS')).toBe('SENSORS');
  });

  it('parses PHOTO command', () => {
    expect(parseCommand('PHOTO')).toBe('PHOTO');
  });

  it('parses FLOWER variants', () => {
    expect(parseCommand('FLOWER')).toBe('FLOWER');
    expect(parseCommand('FLOWERS')).toBe('FLOWER');
    expect(parseCommand('flowers')).toBe('FLOWER');
  });

  it('parses PESTS variants', () => {
    expect(parseCommand('PESTS')).toBe('PESTS');
    expect(parseCommand('PEST')).toBe('PESTS');
    expect(parseCommand('BUGS')).toBe('PESTS');
  });

  it('parses HELP and ? shortcut', () => {
    expect(parseCommand('HELP')).toBe('HELP');
    expect(parseCommand('?')).toBe('HELP');
  });

  it('parses MUTE/UNMUTE', () => {
    expect(parseCommand('MUTE')).toBe('MUTE');
    expect(parseCommand('UNMUTE')).toBe('UNMUTE');
  });

  it('parses language switching', () => {
    expect(parseCommand('LANG EN')).toBe('LANG_EN');
    expect(parseCommand('LANG ENGLISH')).toBe('LANG_EN');
    expect(parseCommand('ENGLISH')).toBe('LANG_EN');
    expect(parseCommand('LANG TA')).toBe('LANG_TA');
    expect(parseCommand('LANG TAMIL')).toBe('LANG_TA');
    expect(parseCommand('TAMIL')).toBe('LANG_TA');
  });

  it('returns UNKNOWN for unrecognized input', () => {
    expect(parseCommand('hello')).toBe('UNKNOWN');
    expect(parseCommand('what is the weather?')).toBe('UNKNOWN');
    expect(parseCommand('')).toBe('UNKNOWN');
  });
});

describe('handleCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends status message for STATUS command', async () => {
    await handleCommand(mockConfig, '94771234567', 'STATUS', 'msg-123');
    expect(sendTextMessage).toHaveBeenCalledWith(mockConfig, '94771234567', 'Status message');
  });

  it('sends sensors message for SENSORS command', async () => {
    await handleCommand(mockConfig, '94771234567', 'SENSORS', 'msg-456');
    expect(sendTextMessage).toHaveBeenCalledWith(mockConfig, '94771234567', 'Sensors message');
  });

  it('sends help message for HELP command', async () => {
    await handleCommand(mockConfig, '94771234567', 'HELP', 'msg-789');
    expect(sendTextMessage).toHaveBeenCalledWith(mockConfig, '94771234567', 'Help message');
  });

  it('sends error response on failure', async () => {
    vi.mocked(sendTextMessage).mockRejectedValueOnce(new Error('API Error'));
    // Should not throw
    await handleCommand(mockConfig, '94771234567', 'STATUS', 'msg-err');
    // The second call should be the error message
    expect(sendTextMessage).toHaveBeenCalledTimes(2);
  });
});
