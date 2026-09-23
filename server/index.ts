import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleAnalyzeRequest } from './analyze';
import { handleChatRequest } from './chat';
import { handleObserveRequest } from './observe';
import { handleProtectionAlertRequest, handlePlantVariationRequest } from './protection';
import { handleLiveTokenRequest, setupLiveWebSocketServer } from './realtime';
import { isApiKeyConfigured, getGemini, GEMINI_VISION_MODEL, GEMINI_LIVE_MODEL, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL } from './gemini';
import { Modality } from '@google/genai';
import { getWhatsAppConfig, getAdminSecret } from './env';
import {
  createAdminRouter,
  createUnconfiguredRouter,
  initializeWhatsApp,
  shutdownWhatsApp,
} from './whatsapp/routes';
import {
  processTelemetryPacket,
  addSseClient,
  getDeviceStatus,
  getLatestTelemetry,
  getHistoryRecords,
  startHeartbeatMonitor,
  stopHeartbeatMonitor,
} from './telemetry-store';
import {
  getActiveAlerts,
  getTimelineEvents,
  addTimelineEvent,
} from './health-engine';
import { logServerEvent, logServerError } from '../src/lib/api/response-logging';

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // API Routes
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
      // Lightweight test generation to probe the key with minimal token usage
      await ai.models.generateContent({
        model: GEMINI_VISION_MODEL,
        contents: 'ping',
      });

      return res.json({
        valid: true,
        message: 'Gemini AI connected successfully.',
        model: GEMINI_VISION_MODEL,
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

  app.post('/api/analyze', handleAnalyzeRequest);
  app.post('/api/chat', handleChatRequest);
  app.post('/api/observe', handleObserveRequest);
  app.post('/api/plant/protection-alert', handleProtectionAlertRequest);
  app.post('/api/plant/variation', handlePlantVariationRequest);

  // Native Gemini TTS Endpoint (Section 8.7: Female Voice Aoede)
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
      const ttsModels = [GEMINI_TTS_MODEL, 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
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
          const audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audio) {
            audioBase64 = audio;
            break;
          }
        } catch (e) {
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
  app.post('/api/realtime-token', handleLiveTokenRequest); // Alias

  // ─── 24/7 Real-Time Plant Monitoring Routes ──────────────────────────────

  // Ingestion endpoint for physical ESP32 or simulated sensor readings
  app.post('/api/sensors/telemetry', (req, res) => {
    const result = processTelemetryPacket(req.body, req.ip);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data });
  });

  // Server-Sent Events (SSE) stream for zero-reload live dashboard updates
  app.get('/api/sensors/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    addSseClient(res);
  });

  // Device connectivity, health score, and active alerts status
  app.get('/api/sensors/status', (_req, res) => {
    res.json({
      device: getDeviceStatus(),
      latest: getLatestTelemetry(),
      activeAlerts: getActiveAlerts(),
      timeline: getTimelineEvents().slice(0, 20),
    });
  });

  // Historical sensor data for charts (1h, 6h, 24h, 7d)
  app.get('/api/sensors/history', (req, res) => {
    const range = (req.query.range as '1h' | '6h' | '24h' | '7d') || '1h';
    const records = getHistoryRecords(range);
    res.json({
      range,
      count: records.length,
      records,
    });
  });

  // Timeline event recording (user watering, touch detection, checks)
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

  // Start background device heartbeat checker
  startHeartbeatMonitor();

  // Express HTTP Server
  const server = http.createServer(app);

  // Mount Gemini Live WebSocket proxy server
  setupLiveWebSocketServer(server);

  // ─── Initialize WhatsApp (alert store + alert engine) ────────────────────
  if (waConfig) {
    initializeWhatsApp(waConfig);
  }

  // Vite Middleware for development / Static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  const shutdown = () => {
    stopHeartbeatMonitor();
    if (waConfig) shutdownWhatsApp();
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [PlantTalk Server Error] Port ${err.port || PORT} is already in use.`);
      console.error('💡 Please close the stale development process (e.g., another Node.js or Vite process) before starting the server.\n');
      process.exit(1);
    }
    console.error('[PlantTalk Server Fatal Start Error]', err);
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PlantTalk Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err: any) => {
  if (err.code === 'EADDRINUSE' || (err.message && err.message.includes('already in use'))) {
    console.error(`\n❌ [PlantTalk Vite Error] A required port (like Vite HMR 24678) is already in use.`);
    console.error('💡 Please close the stale development process before starting the server.\n');
  } else {
    console.error('[PlantTalk Server Fatal Start Error]', err);
  }
  process.exit(1);
});
