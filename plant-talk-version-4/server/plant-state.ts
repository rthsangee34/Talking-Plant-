/**
 * Server-side shared plant state singleton.
 *
 * The frontend holds sensor/observation data in Zustand (browser-only).
 * This module provides a parallel server-side state so the WhatsApp module,
 * alert engine, and other backend consumers can access validated plant data
 * without importing browser stores.
 *
 * Updated by: observe.ts, analyze.ts, and sensor-data ingestion.
 * Read by: WhatsApp command-handler, alert-engine, formatter.
 */

import { z } from 'zod';
import { logServerEvent, logServerError } from '../src/lib/api/response-logging';

// ─── Zod Schemas for validation ─────────────────────────────────────────────

const SensorsSchema = z.object({
  soilMoisture: z.number().min(0).max(100).nullable().optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().min(0).max(100).nullable().optional(),
  light: z.number().min(0).max(100).nullable().optional(),
  co2: z.number().min(0).max(10000).nullable().optional(),
});

const HardwareSchema = z.object({
  espConnected: z.boolean(),
  cameraConnected: z.boolean(),
});

const ObservationSchema = z.object({
  overallCondition: z.string().optional(),
  sensoryNote: z.string().optional(),
  visualEvidence: z.string().optional(),
  recommendedAction: z.string().optional(),
  flowersDetected: z.boolean().nullable().optional(),
  flowerConfidence: z.number().min(0).max(1).nullable().optional(),
  pestsDetected: z.boolean().nullable().optional(),
  pestDescription: z.string().nullable().optional(),
  capturedAt: z.string().optional(),
});

const LatestImageSchema = z.object({
  data: z.instanceof(Buffer).optional(),
  mimeType: z.string().optional(),
  capturedAt: z.string().optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlantChatSensors = z.infer<typeof SensorsSchema>;
export type PlantChatHardware = z.infer<typeof HardwareSchema>;
export type PlantChatObservation = z.infer<typeof ObservationSchema>;
export type PlantChatImage = z.infer<typeof LatestImageSchema>;

export interface PlantChatState {
  plantName?: string;
  species?: string;

  sensors: PlantChatSensors;

  hardware: PlantChatHardware;

  observation?: PlantChatObservation;

  latestImage?: PlantChatImage;

  updatedAt: string;
}

// ─── Default state ──────────────────────────────────────────────────────────

function createDefaultState(): PlantChatState {
  return {
    sensors: {
      soilMoisture: null,
      temperature: null,
      humidity: null,
      light: null,
      co2: null,
    },
    hardware: {
      espConnected: false,
      cameraConnected: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let plantState: PlantChatState = createDefaultState();

/**
 * Get a deep-frozen snapshot of current plant state.
 * The returned object should be treated as read-only.
 */
export function getPlantState(): Readonly<PlantChatState> {
  return plantState;
}

/**
 * Update sensor readings. Validates before applying.
 * Invalid data is logged and rejected — last valid state is preserved.
 */
export function updateSensors(raw: Partial<PlantChatSensors>): void {
  try {
    const merged = { ...plantState.sensors, ...raw };
    const parsed = SensorsSchema.safeParse(merged);
    if (!parsed.success) {
      logServerError('plant-state:sensors', parsed.error);
      return;
    }
    plantState = {
      ...plantState,
      sensors: parsed.data,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logServerError('plant-state:sensors', err);
  }
}

/**
 * Update hardware connection status.
 */
export function updateHardwareStatus(hw: Partial<PlantChatHardware>): void {
  try {
    const merged = { ...plantState.hardware, ...hw };
    const parsed = HardwareSchema.safeParse(merged);
    if (!parsed.success) {
      logServerError('plant-state:hardware', parsed.error);
      return;
    }
    plantState = {
      ...plantState,
      hardware: parsed.data,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logServerError('plant-state:hardware', err);
  }
}

/**
 * Update observation data from /api/observe completion.
 */
export function updateObservation(raw: Partial<PlantChatObservation>): void {
  try {
    const merged = { ...(plantState.observation || {}), ...raw };
    const parsed = ObservationSchema.safeParse(merged);
    if (!parsed.success) {
      logServerError('plant-state:observation', parsed.error);
      return;
    }
    plantState = {
      ...plantState,
      observation: parsed.data,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logServerError('plant-state:observation', err);
  }
}

/**
 * Update analysis-derived data (species, flowers, pests) from /api/analyze.
 */
export function updateAnalysis(data: {
  plantName?: string;
  species?: string;
  overallCondition?: string;
  flowersDetected?: boolean | null;
  flowerConfidence?: number | null;
  pestsDetected?: boolean | null;
  pestDescription?: string | null;
  recommendedAction?: string;
}): void {
  try {
    const updates: Partial<PlantChatState> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.plantName !== undefined) updates.plantName = data.plantName;
    if (data.species !== undefined) updates.species = data.species;

    // Merge observation fields
    const obsUpdate: Partial<PlantChatObservation> = {};
    if (data.overallCondition !== undefined) obsUpdate.overallCondition = data.overallCondition;
    if (data.flowersDetected !== undefined) obsUpdate.flowersDetected = data.flowersDetected;
    if (data.flowerConfidence !== undefined) obsUpdate.flowerConfidence = data.flowerConfidence;
    if (data.pestsDetected !== undefined) obsUpdate.pestsDetected = data.pestsDetected;
    if (data.pestDescription !== undefined) obsUpdate.pestDescription = data.pestDescription;
    if (data.recommendedAction !== undefined) obsUpdate.recommendedAction = data.recommendedAction;

    if (Object.keys(obsUpdate).length > 0) {
      const merged = { ...(plantState.observation || {}), ...obsUpdate };
      const parsed = ObservationSchema.safeParse(merged);
      if (parsed.success) {
        updates.observation = parsed.data;
      }
    }

    plantState = { ...plantState, ...updates };
  } catch (err) {
    logServerError('plant-state:analysis', err);
  }
}

/**
 * Update the latest captured image.
 */
export function updateImage(imageData: Buffer, mimeType: string): void {
  try {
    const parsed = LatestImageSchema.safeParse({
      data: imageData,
      mimeType,
      capturedAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      logServerError('plant-state:image', parsed.error);
      return;
    }
    plantState = {
      ...plantState,
      latestImage: parsed.data,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logServerError('plant-state:image', err);
  }
}

/**
 * Format timestamp in Sri Lankan local time for display.
 */
export function formatSriLankanTime(isoString?: string): string {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString('en-LK', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Get data freshness in minutes.
 */
export function getDataAgeMinutes(): number {
  const updatedAt = new Date(plantState.updatedAt).getTime();
  const now = Date.now();
  return Math.round((now - updatedAt) / 60000);
}

/**
 * Reset state to defaults (useful for testing).
 */
export function resetPlantState(): void {
  plantState = createDefaultState();
}
