import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createApp } from './app';
import { handleAnalyzeRequest } from './analyze';
import { handleChatRequest } from './chat';
import { handleObserveRequest } from './observe';
import {
  handleProtectionAlertRequest,
  handlePlantVariationRequest,
  handleHealthExplanationRequest,
} from './protection';

// ─── Firebase Secret Manager Definition ──────────────────────────────────────
// Defines GEMINI_API_KEY as a managed secret in Firebase Secret Manager (Cloud Secret Manager)
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

const app = createApp();

/**
 * Main Firebase Cloud Function v2 for TalkingPlant.
 * Securely binds GEMINI_API_KEY from Firebase Secret Manager.
 * Handles all /api/** routes when rewritten from Firebase Hosting or called directly.
 */
export const api = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
    maxInstances: 10,
  },
  app
);

/**
 * Dedicated Cloud Function v2 for Botanical Plant Analysis.
 */
export const analyzePlant = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handleAnalyzeRequest(req as any, res as any)
);

/**
 * Dedicated Cloud Function v2 for Plant Conversational Chat & TTS.
 */
export const chatPlant = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handleChatRequest(req as any, res as any)
);

/**
 * Dedicated Cloud Function v2 for Plant Vision Observations.
 */
export const observePlant = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handleObserveRequest(req as any, res as any)
);

/**
 * Dedicated Cloud Function v2 for Plant Protection Alerts.
 */
export const protectionAlert = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handleProtectionAlertRequest(req as any, res as any)
);

/**
 * Dedicated Cloud Function v2 for Plant Phrase Variations.
 */
export const plantVariation = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handlePlantVariationRequest(req as any, res as any)
);

/**
 * Dedicated Cloud Function v2 for Deterministic Plant Health Explanations.
 */
export const healthExplanation = onRequest(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
  },
  (req, res) => handleHealthExplanationRequest(req as any, res as any)
);

