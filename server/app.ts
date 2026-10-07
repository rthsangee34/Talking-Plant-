import express, { Express } from 'express';
import { handleAnalyzeRequest } from './analyze';
import { handleChatRequest } from './chat';
import { handleObserveRequest } from './observe';
import {
  handleProtectionAlertRequest,
  handlePlantVariationRequest,
  handleHealthExplanationRequest,
} from './protection';
import { handleLiveTokenRequest } from './realtime';
import {
  isApiKeyConfigured,
  getGemini,
  GEMINI_VISION_MODEL,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_VOICE,
  GEMINI_TTS_MODEL,
} from './gemini';
import { Modality } from '@google/genai';
import { getWhatsAppConfig, getAdminSecret } from './env';
import {
  createAdminRouter,
  createUnconfiguredRouter,
} from './whatsapp/routes';
import {
  processTelemetryPacket,
  addSseClient,
  getDeviceStatus,
  getLatestTelemetry,
  getHistoryRecords,
} from './telemetry-store';
import {
  getActiveAlerts,
  getTimelineEvents,
  addTimelineEvent,
} from './health-engine';
import { logServerEvent, logServerError } from '../src/lib/api/response-logging';

/**
 * Creates and configures the Express application with all API endpoints.
 * Shared between the local development server and Firebase Cloud Functions.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // ─── WhatsApp admin & status routes ──────────────────────────────────────
  const waConfig = getWhatsAppConfig();
  if (waConfig) {
    const adminSecret = getAdminSecret();
    app.use(createAdminRouter(waConfig, adminSecret));
    logServerEvent('server', 'WhatsApp admin routes mounted');
  } else {
    app.use(createUnconfiguredRouter());
    logServerEvent('server', 'WhatsApp not configured — status endpoint returns unconfigured');
  }

  // ─── API Routes ──────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    const reqApiKey = (req.headers['x-gemini-api-key'] as string | undefined) || (req.query.key as string | undefined);
    res.json({
      status: 'ok',
      apiKeyConfigured: isApiKeyConfigured(reqApiKey),
      whatsappConfigured: !!waConfig,
      visionModel: GEMINI_VISION_MODEL,
      liveModel: GEMINI_LIVE_MODEL,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Gemini API Key Validation Endpoint ──────────────────────────────────
  app.post('/api/validate-key', async (req, res) => {
    const reqApiKey = ((req.headers['x-gemini-api-key'] as string | undefined) || req.body?.apiKey || '').trim();

    if (!reqApiKey) {
      return res.status(400).json({
        valid: false,
        error: 'EMPTY_KEY',
        message: 'API key cannot be empty. Please enter your Gemini API key.',
      });
    }

    try {
      const ai = getGemini(reqApiKey);
      const candidateModels = [GEMINI_VISION_MODEL, 'gemini-3.7-flash', 'gemini-3.8-flash'];
      let lastTestErr: any = null;
      let activeModel = GEMINI_VISION_MODEL;
      let pingSuccess = false;

      for (const m of candidateModels) {
        try {
          await ai.models.generateContent({
            model: m,
            contents: 'ping',
          });
          activeModel = m;
          pingSuccess = true;
          break;
        } catch (mErr: any) {
          lastTestErr = mErr;
          const msg = mErr?.message || String(mErr);
          if (
            msg.includes('API_KEY_INVALID') ||
            msg.includes('API key not valid') ||
            msg.includes('400') ||
            msg.includes('401') ||
            msg.includes('403')
          ) {
            throw mErr;
          }
        }
      }

      if (!pingSuccess) {
        throw lastTestErr;
      }

      return res.json({
        valid: true,
        message: 'Gemini AI connected successfully.',
        model: activeModel,
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logServerError('validate-key', err);

      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('400') ||
        errMsg.includes('401') ||
        errMsg.includes('403')
      ) {
        return res.status(401).json({
          valid: false,
          error: 'INVALID_KEY',
          message: 'API key is invalid. Please check your Gemini API key from Google AI Studio.',
        });
      }

      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota')) {
        return res.status(429).json({
          valid: false,
          error: 'RATE_LIMITED',
          message: 'Gemini request quota exceeded. Please check your billing or quota in Google AI Studio.',
        });
      }

      return res.status(503).json({
        valid: false,
        error: 'NETWORK_ERROR',
        message: 'Gemini AI could not be reached. Check your internet connection.',
      });
    }
  });

  // Gemini Endpoints
  app.post('/api/analyze', handleAnalyzeRequest);
  app.post('/api/chat', handleChatRequest);
  app.post('/api/observe', handleObserveRequest);
  app.post('/api/plant/protection-alert', handleProtectionAlertRequest);
  app.post('/api/plant/variation', handlePlantVariationRequest);
  app.post('/api/plant/health-explanation', handleHealthExplanationRequest);

  // Native Gemini TTS Endpoint (Female Voice Aoede)
  app.post('/api/tts', async (req, res) => {
    const text = req.body?.text?.trim();
    if (!text) {
      return res.status(400).json({ error: 'EMPTY_TEXT', message: 'Text is required for TTS.' });
    }
    const reqApiKey = (req.headers['x-gemini-api-key'] as string | undefined) || req.body?.apiKey;
    if (!isApiKeyConfigured(reqApiKey)) {
      return res.status(401).json({ error: 'API_KEY_REQUIRED', message: 'API key is required.' });
    }

    try {
      const ai = getGemini(reqApiKey);
      const voiceName = req.body?.voice || GEMINI_LIVE_VOICE;
      const ttsModels = [
        GEMINI_TTS_MODEL,
        'gemini-2.5-flash-preview-tts',
        'gemini-3.8-flash-tts',
        'gemini-3.8-flash-lite-tts',
        'gemini-3.1-flash-tts-preview',
      ];
      let audioBase64: string | null = null;

      for (const model of ttsModels) {
        try {
          const ttsRes = await ai.models.generateContent({
            model,
            contents: text,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          });
          const parts = ttsRes.candidates?.[0]?.content?.parts || [];
          const audioPart = parts.find((p: any) => p.inlineData?.data);
          if (audioPart?.inlineData?.data) {
            audioBase64 = audioPart.inlineData.data;
            break;
          }
        } catch {
          // try next model
        }
      }

      if (!audioBase64) {
        return res.status(500).json({ error: 'TTS_FAILED', message: 'Could not synthesize audio.' });
      }

      return res.json({ audio: audioBase64, sampleRate: 24000, voice: voiceName });
    } catch (err: any) {
      logServerError('tts', err);
      return res.status(500).json({ error: 'TTS_ERROR', message: err?.message || 'TTS generation failed.' });
    }
  });

  // Live session token endpoints
  app.post('/api/live-token', handleLiveTokenRequest);
  app.post('/api/realtime-token', handleLiveTokenRequest);

  // ─── 24/7 Real-Time Plant Monitoring Routes ──────────────────────────────
  app.post('/api/sensors/telemetry', (req, res) => {
    const result = processTelemetryPacket(req.body, req.ip);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data });
  });

  app.get('/api/sensors/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    addSseClient(res);
  });

  app.get('/api/sensors/status', (_req, res) => {
    res.json({
      device: getDeviceStatus(),
      latest: getLatestTelemetry(),
      activeAlerts: getActiveAlerts(),
      timeline: getTimelineEvents().slice(0, 20),
    });
  });

  app.get('/api/sensors/history', (req, res) => {
    const range = (req.query.range as '1h' | '6h' | '24h' | '7d') || '1h';
    const records = getHistoryRecords(range);
    res.json({
      range,
      count: records.length,
      records,
    });
  });

  app.post('/api/sensors/timeline', (req, res) => {
    const { title, description, status, type } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const event = {
      id: `event-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: status || 'HEALTHY',
      title,
      description: description || '',
      type: type || 'watering',
    };
    addTimelineEvent(event);
    res.json({ success: true, event });
  });

  return app;
}
