import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { setupLiveWebSocketServer } from './realtime';
import { getWhatsAppConfig } from './env';
import {
  initializeWhatsApp,
  shutdownWhatsApp,
} from './whatsapp/routes';
import {
  startHeartbeatMonitor,
  stopHeartbeatMonitor,
} from './telemetry-store';
import { createApp } from './app';

async function startServer() {
  const app = createApp();
  const PORT = 3000;
  const waConfig = getWhatsAppConfig();

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
