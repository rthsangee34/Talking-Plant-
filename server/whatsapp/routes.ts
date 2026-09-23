/**
 * WhatsApp Express router factory.
 *
 * Mounts webhook routes and admin-protected management routes.
 * Gracefully no-ops when WhatsApp is not configured.
 */

import { Router, Request, Response, json, raw } from 'express';
// Webhook and command handler imports removed.
import { sendTextMessage, sendTemplateMessage } from './client';
import { getLastOutboundAt, getLastOutboundMessageId, getLastApiError, getLastOutboundState } from './client';
import {
  isMuted,
  setMuted,
  setOwnerLanguage,
  getLastAlertAt,
  isUnauthorizedRateLimited,
  getAutomatedAlertState,
  initAlertStore,
} from './alert-store';
import { startAlertEngine, stopAlertEngine, runAlertCheck } from './alert-engine';
import { formatStatusMessage } from './formatter';
import { getOwnerLanguage } from './alert-store';
import { getPlantState } from '../plant-state';
import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import type { WhatsAppConfig, WhatsAppStatus } from './types';

/**
 * Validate admin secret from request headers.
 */
function validateAdmin(req: Request, adminSecret: string): boolean {
  const provided = req.headers['x-admin-secret'] as string | undefined;
  if (!provided || !adminSecret) return false;
  return provided === adminSecret;
}

// Webhook router removed.
/**
 * Create the admin API router (mounted AFTER express.json() in index.ts).
 */
export function createAdminRouter(config: WhatsAppConfig, adminSecret: string): Router {
  const router = Router();

  // GET /api/whatsapp/status — Safe diagnostic info
  router.get('/api/whatsapp/status', (req: Request, res: Response) => {
    const status: WhatsAppStatus = {
      configured: true,
      alertsEnabled: config.alertsEnabled,
      muted: isMuted(),
      ownerConfigured: !!config.ownerNumber,
      lastOutboundMessageAt: getLastOutboundAt(),
      lastOutboundMessageId: getLastOutboundMessageId(),
      lastOutboundState: getLastOutboundState(),
      apiErrorDetails: getLastApiError(),
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    };
    res.json(status);
  });

  // POST /api/whatsapp/test-message — Send test template to owner
  router.post('/api/whatsapp/test-message', async (req: Request, res: Response) => {
    if (!validateAdmin(req, adminSecret)) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    try {
      // First test using Meta’s approved hello_world template
      const result = await sendTemplateMessage(
        config,
        config.ownerNumber,
        'hello_world',
        'en_US',
        []
      );

      res.json({
        success: true,
        messageId: result.messages?.[0]?.id || null,
        status: 'accepted',
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      logServerError('admin:test-message', err);
      res.status(500).json({
        success: false,
        error: msg,
        metaCode: getLastApiError() || 'unknown',
        details: 'Check Meta developers console or ensure test numbers are verified.'
      });
    }
  });

  // POST /api/whatsapp/test-alert — Trigger a test alert check
  router.post('/api/whatsapp/test-alert', async (req: Request, res: Response) => {
    if (!validateAdmin(req, adminSecret)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    try {
      await runAlertCheck(config);
      res.json({ success: true, message: 'Alert check completed' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Alert check failed';
      logServerError('admin:test-alert', err);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/whatsapp/protection-alert — Send the protection alert
  router.post('/api/whatsapp/protection-alert', async (req: Request, res: Response) => {
    // Note: To allow the frontend to call this, we don't strictly enforce adminSecret
    // but in a production app, we should use a session token.
    try {
      if (!config.ownerNumber) {
        throw new Error('Owner number not configured');
      }
      const localTime = new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date());
      let result;
      if (process.env.NODE_ENV === 'production') {
        result = await sendTemplateMessage(config, config.ownerNumber, config.criticalTemplateName || 'hello_world', config.templateLanguage || 'en_US', []);
      } else {
        const text = `🪴 PlantTalk பாதுகாப்பு எச்சரிக்கை!\nதயவுசெய்து என்னைக் காப்பாற்றுங்கள். யாரோ என்னை மீண்டும் மீண்டும் கையாள முயற்சிக்கிறார்கள்.\nநேரம்: ${localTime}\nஇடம்: PlantTalk plant`;
        result = await sendTextMessage(config, config.ownerNumber, text);
      }
      res.json({ success: true, messageId: result.messages?.[0]?.id || null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Alert send failed';
      logServerError('admin:protection-alert', err);
      res.status(500).json({ error: msg });
    }
  });

  // GET /api/whatsapp/automated-alerts/state — Expose automated alerts state
  router.get('/api/whatsapp/automated-alerts/state', (req: Request, res: Response) => {
    if (!validateAdmin(req, adminSecret)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json(getAutomatedAlertState());
  });

  // POST /api/whatsapp/mute — Mute non-critical alerts
  router.post('/api/whatsapp/mute', (req: Request, res: Response) => {
    if (!validateAdmin(req, adminSecret)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    setMuted(true);
    res.json({ muted: true });
  });

  // POST /api/whatsapp/unmute — Resume alerts
  router.post('/api/whatsapp/unmute', (req: Request, res: Response) => {
    if (!validateAdmin(req, adminSecret)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    setMuted(false);
    res.json({ muted: false });
  });

  return router;
}

/**
 * Initialize WhatsApp integration.
 * Call from server/index.ts after route mounting.
 */
export function initializeWhatsApp(config: WhatsAppConfig): void {
  initAlertStore();
  if (config.alertsEnabled) {
    startAlertEngine(config, 60_000); // Check every minute
  }
  logServerEvent('whatsapp', 'WhatsApp integration initialized');
}

/**
 * Graceful shutdown.
 */
export function shutdownWhatsApp(): void {
  stopAlertEngine();
  logServerEvent('whatsapp', 'WhatsApp integration shut down');
}

/**
 * Create a no-op status router for when WhatsApp is not configured.
 */
export function createUnconfiguredRouter(): Router {
  const router = Router();

  router.get('/api/whatsapp/status', (_req: Request, res: Response) => {
    const status: WhatsAppStatus = {
      configured: false,
      alertsEnabled: false,
      muted: false,
      ownerConfigured: false,
      lastOutboundMessageAt: null,
      lastOutboundMessageId: null,
      lastOutboundState: null,
      apiErrorDetails: null,
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    };
    res.json(status);
  });

  // All other WhatsApp routes return not-configured
  const notConfigured = (_req: Request, res: Response) => {
    res.status(501).json({ error: 'WhatsApp integration is not configured.' });
  };

  // Webhook routes removed
  router.post('/api/whatsapp/test-message', notConfigured);
  router.post('/api/whatsapp/test-alert', notConfigured);
  router.post('/api/whatsapp/protection-alert', notConfigured);
  router.post('/api/whatsapp/mute', notConfigured);
  router.post('/api/whatsapp/unmute', notConfigured);

  return router;
}
