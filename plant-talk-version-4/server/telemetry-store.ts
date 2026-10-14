/**
 * Server-Side Autonomous 24/7 Telemetry Store & Real-Time Broadcaster
 *
 * Provides:
 * 1. Zod-based validation & sanitization of incoming ESP32 / sensor packets
 * 2. In-memory high-frequency ring buffer
 * 3. Autonomous historical persistence in data/sensor-history.json (downsampled)
 * 4. Server-Sent Events (SSE) broadcasting for zero-reload dashboard updates
 * 5. Device connection heartbeat tracking (ONLINE / OFFLINE / STALE)
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import type { Response } from 'express';
import { updateSensors, updateHardwareStatus, getPlantState } from './plant-state';
import { logServerEvent, logServerError } from '../src/lib/api/response-logging';

// ─── Zod Schema for Incoming Telemetry ──────────────────────────────────────

export const IngestionSchema = z.object({
  soilMoisture: z.number().min(0).max(100).nullable().optional(),
  moisture: z.number().min(0).max(100).nullable().optional(), // Alias support
  temperature: z.number().min(-40).max(85).nullable().optional(),
  humidity: z.number().min(0).max(100).nullable().optional(),
  light: z.number().min(0).max(100000).nullable().optional(),
  co2: z.number().min(0).max(10000).nullable().optional(),
  deviceId: z.string().optional().default('plant-talk-01'),
  timestamp: z.string().optional(),
  isMock: z.boolean().optional().default(false),
});

export type ValidatedTelemetry = {
  soilMoisture: number;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  co2: number | null;
  deviceId: string;
  timestamp: string;
  isMock: boolean;
};

export interface HistoryRecord {
  timestamp: string;
  soilMoisture: number;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  co2: number | null;
  healthScore: number;
  status: string;
}

// ─── File Paths & Configuration ─────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'sensor-history.json');
const MAX_RING_BUFFER_SIZE = 250;
const MAX_HISTORY_RECORDS = 5000;
const HISTORY_SAVE_INTERVAL_MS = 60_000; // 1 minute downsampling
const DEVICE_OFFLINE_THRESHOLD_MS = 30_000; // 30 seconds without packet = OFFLINE

// ─── State Singletons ───────────────────────────────────────────────────────

const ringBuffer: ValidatedTelemetry[] = [];
let historicalData: HistoryRecord[] = [];
let lastHistorySaveTime = 0;
let lastPacketTimestamp = 0;
let activeDeviceId = 'plant-talk-01';
let isDeviceOnline = false;
let isCurrentMock = false;
let totalPacketCount = 0;

// SSE connected clients set
const sseClients = new Set<Response>();

// ─── Load Existing History on Startup ───────────────────────────────────────

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(HISTORY_FILE)) {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      historicalData = parsed.slice(-MAX_HISTORY_RECORDS);
      logServerEvent('telemetry-store', `Loaded ${historicalData.length} historical sensor records.`);
    }
  }
} catch (err) {
  logServerError('telemetry-store:load-history', err);
  historicalData = [];
}

// ─── SSE Broadcast Helpers ──────────────────────────────────────────────────

export function addSseClient(res: Response): void {
  sseClients.add(res);

  // Send initial snapshot on connect
  const latest = getLatestTelemetry();
  const payload = {
    type: 'init',
    data: {
      latest,
      deviceStatus: getDeviceStatus(),
      history: getHistoryRecords('1h'),
    },
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);

  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastSse(eventType: string, data: any): void {
  const message = `data: ${JSON.stringify({ type: eventType, data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─── Telemetry Ingestion ────────────────────────────────────────────────────

export function processTelemetryPacket(raw: any, ipAddress?: string): { success: boolean; data?: ValidatedTelemetry; error?: string } {
  const result = IngestionSchema.safeParse(raw);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    logServerError('telemetry-store:validation', new Error(`Invalid sensor data rejected: ${errorMsg}`));
    return { success: false, error: errorMsg };
  }

  const input = result.data;

  // Resolve soil moisture from either field
  let soilMoisture = input.soilMoisture;
  if (soilMoisture === undefined || soilMoisture === null) {
    soilMoisture = input.moisture ?? 50;
  }
  soilMoisture = Math.max(0, Math.min(100, Math.round(soilMoisture)));

  // Normalize light to 0-100% scale if given in raw lux
  let light = input.light;
  if (light !== null && light !== undefined) {
    if (light > 100) {
      // Scale lux (0-10000 lx) to percentage (0-100%)
      light = Math.min(100, Math.round((light / 10000) * 100));
    } else {
      light = Math.round(light);
    }
  }

  const telemetry: ValidatedTelemetry = {
    soilMoisture,
    temperature: input.temperature !== null && input.temperature !== undefined ? Math.round(input.temperature * 10) / 10 : null,
    humidity: input.humidity !== null && input.humidity !== undefined ? Math.round(input.humidity) : null,
    light: light ?? null,
    co2: input.co2 !== null && input.co2 !== undefined ? Math.round(input.co2) : null,
    deviceId: input.deviceId || 'plant-talk-01',
    timestamp: input.timestamp || new Date().toISOString(),
    isMock: input.isMock ?? false,
  };

  // Update tracking state
  totalPacketCount++;
  lastPacketTimestamp = Date.now();
  activeDeviceId = telemetry.deviceId;
  isCurrentMock = telemetry.isMock;
  isDeviceOnline = true;

  // Append to ring buffer
  ringBuffer.push(telemetry);
  if (ringBuffer.length > MAX_RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }

  // Update existing server-side plantState
  updateSensors({
    soilMoisture: telemetry.soilMoisture,
    temperature: telemetry.temperature,
    humidity: telemetry.humidity,
    light: telemetry.light,
    co2: telemetry.co2,
  });

  updateHardwareStatus({
    espConnected: true,
  });

  // Broadcast to all active SSE dashboards
  broadcastSse('telemetry', telemetry);
  broadcastSse('device', getDeviceStatus());

  // Notify listeners (health engine, etc.)
  for (const listener of telemetryListeners) {
    try {
      listener(telemetry);
    } catch (err) {
      logServerError('telemetry-store:listener', err);
    }
  }

  // Check if historical record should be sampled
  const now = Date.now();
  if (now - lastHistorySaveTime >= HISTORY_SAVE_INTERVAL_MS) {
    saveHistoricalSample(telemetry);
    lastHistorySaveTime = now;
  }

  return { success: true, data: telemetry };
}

type TelemetryListener = (telemetry: ValidatedTelemetry) => void;
const telemetryListeners = new Set<TelemetryListener>();

export function onTelemetry(listener: TelemetryListener): () => void {
  telemetryListeners.add(listener);
  return () => telemetryListeners.delete(listener);
}

// ─── Historical Sample Persistence ──────────────────────────────────────────

export function saveHistoricalSample(telemetry: ValidatedTelemetry, healthScore = 85, status = 'HEALTHY'): void {
  const record: HistoryRecord = {
    timestamp: telemetry.timestamp,
    soilMoisture: telemetry.soilMoisture,
    temperature: telemetry.temperature,
    humidity: telemetry.humidity,
    light: telemetry.light,
    co2: telemetry.co2,
    healthScore,
    status,
  };

  historicalData.push(record);
  if (historicalData.length > MAX_HISTORY_RECORDS) {
    historicalData.shift();
  }

  // Asynchronously flush to disk
  try {
    fs.writeFile(HISTORY_FILE, JSON.stringify(historicalData, null, 2), (err) => {
      if (err) logServerError('telemetry-store:save-history', err);
    });
  } catch (err) {
    logServerError('telemetry-store:save-history', err);
  }

  broadcastSse('history_sample', record);
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

export function getLatestTelemetry(): ValidatedTelemetry | null {
  if (ringBuffer.length === 0) {
    // Return from plantState if ring buffer is empty
    const state = getPlantState();
    return {
      soilMoisture: state.sensors.soilMoisture ?? 50,
      temperature: state.sensors.temperature ?? null,
      humidity: state.sensors.humidity ?? null,
      light: state.sensors.light ?? null,
      co2: state.sensors.co2 ?? null,
      deviceId: activeDeviceId,
      timestamp: state.updatedAt,
      isMock: isCurrentMock,
    };
  }
  return ringBuffer[ringBuffer.length - 1];
}

export function getRecentReadings(count = 20): ValidatedTelemetry[] {
  return ringBuffer.slice(-count);
}

export function getDeviceStatus() {
  const now = Date.now();
  const timeSinceLastPacket = lastPacketTimestamp > 0 ? now - lastPacketTimestamp : Infinity;
  const isOnline = lastPacketTimestamp > 0 && timeSinceLastPacket <= DEVICE_OFFLINE_THRESHOLD_MS;

  return {
    deviceId: activeDeviceId,
    isOnline,
    lastSeen: lastPacketTimestamp > 0 ? new Date(lastPacketTimestamp).toISOString() : null,
    isStale: timeSinceLastPacket > 15_000,
    packetCount: totalPacketCount,
    isMock: isCurrentMock,
    secondsSinceLastPacket: Math.round(timeSinceLastPacket / 1000),
  };
}

export function getHistoryRecords(range: '1h' | '6h' | '24h' | '7d' = '1h'): HistoryRecord[] {
  const now = Date.now();
  let cutoffMs = 3600_000; // 1 hour

  if (range === '6h') cutoffMs = 6 * 3600_000;
  else if (range === '24h') cutoffMs = 24 * 3600_000;
  else if (range === '7d') cutoffMs = 7 * 24 * 3600_000;

  const cutoffTime = now - cutoffMs;

  return historicalData.filter((r) => {
    const t = new Date(r.timestamp).getTime();
    return t >= cutoffTime;
  });
}

// ─── Background Heartbeat Monitor ───────────────────────────────────────────

let heartbeatTimer: NodeJS.Timeout | null = null;

export function startHeartbeatMonitor(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(() => {
    const status = getDeviceStatus();
    if (!status.isOnline && isDeviceOnline) {
      isDeviceOnline = false;
      updateHardwareStatus({ espConnected: false });
      broadcastSse('device', status);
      logServerEvent('telemetry-store', `ESP32 device '${activeDeviceId}' went OFFLINE (no packet for >30s)`);
    }
  }, 5000);
}

export function stopHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
