/**
 * Alert state persistence and deduplication.
 *
 * Manages: per-alert cooldowns, daily limits, duplicate message IDs,
 * mute state, active problems, and recovery tracking.
 * Persists to data/alert-state.json so restarts don't re-fire old alerts.
 */

import fs from 'fs';
import path from 'path';
import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import type {
  AlertCode,
  AlertStoreState,
  AlertCooldownEntry,
  OwnerLanguage,
  OwnerPreferences,
  AlertState,
  AlertRecord,
} from './types';

// ─── File paths ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const ALERT_STATE_FILE = path.join(DATA_DIR, 'alert-state.json');
const OWNER_PREFS_FILE = path.join(DATA_DIR, 'owner-prefs.json');

// Max processed message IDs to keep (prevents unbounded growth)
const MAX_PROCESSED_IDS = 5000;

// ─── State ──────────────────────────────────────────────────────────────────

let alertState: AlertStoreState = createDefaultAlertState();
let ownerPrefs: OwnerPreferences = { language: 'ta-LK', updatedAt: new Date().toISOString() };

function createDefaultAlertState(): AlertStoreState {
  return {
    cooldowns: {},
    dailyAlertCount: 0,
    dailyCountResetDate: new Date().toISOString().split('T')[0],
    processedMessageIds: [],
    muted: false,
    activeProblems: {},
    lastAlertAt: null,
    automatedAlertState: createDefaultAutomatedAlertState(),
  };
}

export function createDefaultAutomatedAlertState(): AlertState {
  return {
    lowLightActive: false,
    highLightActive: false,
    highTemperatureActive: false,
    criticalDryActive: false,
    lowLightReadingCount: 0,
    highLightReadingCount: 0,
    highTemperatureReadingCount: 0,
    dryConditionStartedAt: null,
    dryAlertSent: false,
    lastAlertSentAt: null,
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    logServerError('alert-store:mkdir', err);
  }
}

export function loadAlertState(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(ALERT_STATE_FILE)) {
      const raw = fs.readFileSync(ALERT_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      alertState = { ...createDefaultAlertState(), ...parsed };
      logServerEvent('alert-store', 'Alert state loaded from disk');
    }
  } catch (err) {
    logServerError('alert-store:load', err);
    alertState = createDefaultAlertState();
  }
}

function saveAlertState(): void {
  ensureDataDir();
  try {
    // Trim processed IDs to prevent file growth
    if (alertState.processedMessageIds.length > MAX_PROCESSED_IDS) {
      alertState.processedMessageIds = alertState.processedMessageIds.slice(-MAX_PROCESSED_IDS);
    }
    fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(alertState, null, 2), 'utf-8');
  } catch (err) {
    logServerError('alert-store:save', err);
  }
}

export function loadOwnerPrefs(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(OWNER_PREFS_FILE)) {
      const raw = fs.readFileSync(OWNER_PREFS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.language === 'en' || parsed.language === 'ta' || parsed.language === 'ta-LK') {
        ownerPrefs = { ...parsed, language: parsed.language === 'ta' ? 'ta-LK' : parsed.language };
      }
    }
  } catch (err) {
    logServerError('alert-store:load-prefs', err);
  }
}

function saveOwnerPrefs(): void {
  ensureDataDir();
  try {
    fs.writeFileSync(OWNER_PREFS_FILE, JSON.stringify(ownerPrefs, null, 2), 'utf-8');
  } catch (err) {
    logServerError('alert-store:save-prefs', err);
  }
}

// ─── Duplicate Message Detection ────────────────────────────────────────────

export function isMessageProcessed(messageId: string): boolean {
  return alertState.processedMessageIds.includes(messageId);
}

export function markMessageProcessed(messageId: string): void {
  if (!alertState.processedMessageIds.includes(messageId)) {
    alertState.processedMessageIds.push(messageId);
    saveAlertState();
  }
}

// ─── Mute Control ───────────────────────────────────────────────────────────

export function isMuted(): boolean {
  return alertState.muted;
}

export function setMuted(muted: boolean): void {
  alertState.muted = muted;
  saveAlertState();
  logServerEvent('alert-store', `Alerts ${muted ? 'muted' : 'unmuted'}`);
}

// ─── Language Preference ────────────────────────────────────────────────────

export function getOwnerLanguage(): OwnerLanguage {
  return ownerPrefs.language;
}

export function setOwnerLanguage(lang: OwnerLanguage): void {
  ownerPrefs = { language: lang, updatedAt: new Date().toISOString() };
  saveOwnerPrefs();
  logServerEvent('alert-store', `Owner language set to: ${lang}`);
}

// ─── Cooldown Management ────────────────────────────────────────────────────

export function isAlertOnCooldown(code: AlertCode, cooldownMinutes: number): boolean {
  const entry = alertState.cooldowns[code];
  if (!entry) return false;

  const lastSent = new Date(entry.lastSentAt).getTime();
  const elapsed = (Date.now() - lastSent) / 60000;
  return elapsed < cooldownMinutes;
}

export function recordAlertSent(alert: AlertRecord): void {
  const existing = alertState.cooldowns[alert.code];

  alertState.cooldowns[alert.code] = {
    code: alert.code,
    lastSentAt: new Date().toISOString(),
    consecutiveCount: (existing?.consecutiveCount || 0) + 1,
    recoverySent: false,
  };

  alertState.activeProblems[alert.code] = alert;
  alertState.lastAlertAt = new Date().toISOString();
  alertState.dailyAlertCount++;
  saveAlertState();
}

export function incrementConsecutiveCount(code: AlertCode): void {
  const entry = alertState.cooldowns[code];
  if (entry) {
    entry.consecutiveCount++;
    saveAlertState();
  } else {
    alertState.cooldowns[code] = {
      code,
      lastSentAt: '',
      consecutiveCount: 1,
      recoverySent: false,
    };
    saveAlertState();
  }
}

export function getConsecutiveCount(code: AlertCode): number {
  return alertState.cooldowns[code]?.consecutiveCount || 0;
}

// ─── Recovery Tracking ──────────────────────────────────────────────────────

export function isRecoverySent(code: AlertCode): boolean {
  return alertState.cooldowns[code]?.recoverySent === true;
}

export function markRecoverySent(code: AlertCode): void {
  if (alertState.cooldowns[code]) {
    alertState.cooldowns[code].recoverySent = true;
  }
  delete alertState.activeProblems[code];
  saveAlertState();
}

export function clearCooldown(code: AlertCode): void {
  delete alertState.cooldowns[code];
  delete alertState.activeProblems[code];
  saveAlertState();
}

// ─── Daily Limit ────────────────────────────────────────────────────────────

export function isDailyLimitReached(limit: number): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (alertState.dailyCountResetDate !== today) {
    alertState.dailyAlertCount = 0;
    alertState.dailyCountResetDate = today;
    saveAlertState();
  }
  return alertState.dailyAlertCount >= limit;
}

// ─── Active Problems ────────────────────────────────────────────────────────

export function getActiveProblems(): Record<string, AlertRecord> {
  return { ...alertState.activeProblems };
}

export function isActiveProblem(code: AlertCode): boolean {
  return code in alertState.activeProblems;
}

// ─── Status Getters ─────────────────────────────────────────────────────────

export function getLastAlertAt(): string | null {
  return alertState.lastAlertAt;
}

export function getAlertStoreSnapshot(): AlertStoreState {
  return { ...alertState };
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initAlertStore(): void {
  loadAlertState();
  loadOwnerPrefs();
}

// ─── Automated Alerts State ──────────────────────────────────────────────────

export function getAutomatedAlertState(): AlertState {
  if (!alertState.automatedAlertState) {
    alertState.automatedAlertState = createDefaultAutomatedAlertState();
  }
  return { ...alertState.automatedAlertState };
}

export function updateAutomatedAlertState(partial: Partial<AlertState>): void {
  if (!alertState.automatedAlertState) {
    alertState.automatedAlertState = createDefaultAutomatedAlertState();
  }
  alertState.automatedAlertState = {
    ...alertState.automatedAlertState,
    ...partial,
  };
  saveAlertState();
}

// ─── Rate limiting for unauthorized numbers ─────────────────────────────────

const unauthorizedAttempts = new Map<string, { count: number; firstAt: number }>();
const UNAUTHORIZED_WINDOW_MS = 60_000; // 1 minute
const UNAUTHORIZED_LIMIT = 5;

export function isUnauthorizedRateLimited(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = unauthorizedAttempts.get(phoneNumber);

  if (!entry || now - entry.firstAt > UNAUTHORIZED_WINDOW_MS) {
    unauthorizedAttempts.set(phoneNumber, { count: 1, firstAt: now });
    return false;
  }

  entry.count++;
  return entry.count > UNAUTHORIZED_LIMIT;
}
