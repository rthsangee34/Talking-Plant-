/**
 * WhatsApp Cloud API client.
 * Direct HTTPS to Meta Graph API — no SDK dependencies.
 */

import { logServerEvent, logServerError } from '../../src/lib/api/response-logging';
import type { WhatsAppConfig, WhatsAppSendResponse, WhatsAppApiError, ApiErrorDetails } from './types';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

// Track timestamps for status endpoint
let lastOutboundAt: string | null = null;
let lastOutboundMessageId: string | null = null;
let lastOutboundState: 'sending' | 'accepted_by_meta' | 'failed' | null = null;
let lastApiError: ApiErrorDetails | null = null;

export function getLastOutboundAt(): string | null {
  return lastOutboundAt;
}

export function getLastOutboundMessageId(): string | null {
  return lastOutboundMessageId;
}

export function getLastOutboundState() {
  return lastOutboundState;
}

// Webhook inbound status tracking removed.

export function getLastApiError(): ApiErrorDetails | null {
  return lastApiError;
}

/**
 * Build the base Graph API URL for sending messages.
 */
function getMessagesUrl(config: WhatsAppConfig): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
}

/**
 * Build authorization headers. Never log the full token.
 */
function getHeaders(config: WhatsAppConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Determine if an HTTP status code is retryable (rate limit or server error).
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function parseSanitizedError(status: number, body: unknown, recipient: string): ApiErrorDetails {
  let wamid: string | undefined = undefined;
  
  if (body && typeof body === 'object') {
    if ('messages' in body && Array.isArray((body as any).messages)) {
      wamid = (body as any).messages[0]?.id;
    }
    
    if ('error' in body) {
      const apiErr = body as WhatsAppApiError;
      const e = apiErr.error;
      let msg = e.message;
      let details = e.error_data?.details || '';
      
      // Map common errors for easier debugging
      if (e.code === 190) details = `Invalid or expired access token. ${details}`;
      if (e.code === 100) details = `Invalid phone number or parameter. ${details}`;
      if (e.code === 131047 || e.code === 131048) details = `Message failed - likely outside 24h window or missing template. ${details}`;
      if (e.code === 131030) details = `Recipient must be added as a verified test recipient in Meta API Setup. ${details}`;

      return {
        code: e.code,
        message: msg,
        details: details.trim() || undefined,
        recipient,
        wamid
      };
    }
  }
  return {
    message: `Meta API HTTP ${status}`,
    recipient,
    wamid
  };
}

/**
 * Core fetch with timeout, retry, and error handling.
 */
async function whatsAppFetch(
  url: string,
  config: WhatsAppConfig,
  body: Record<string, unknown>,
  recipient: string
): Promise<WhatsAppSendResponse> {
  // Pre-send config check
  if (!config.accessToken) {
    const err: ApiErrorDetails = { message: 'Missing WhatsApp Access Token', recipient };
    lastApiError = err; lastOutboundState = 'failed'; throw new Error(err.message);
  }
  if (!config.phoneNumberId) {
    const err: ApiErrorDetails = { message: 'Missing WhatsApp Phone Number ID', recipient };
    lastApiError = err; lastOutboundState = 'failed'; throw new Error(err.message);
  }
  if (!recipient) {
    const err: ApiErrorDetails = { message: 'Missing recipient number', recipient };
    lastApiError = err; lastOutboundState = 'failed'; throw new Error(err.message);
  }

  // Validate Sri Lanka format
  if (!/^947\d{8}$/.test(recipient)) {
    const err: ApiErrorDetails = { message: 'Invalid recipient format. Must be a Sri Lanka mobile number starting with 947 (e.g., 94712345678).', recipient };
    lastApiError = err; lastOutboundState = 'failed'; throw new Error(err.message);
  }

  let lastError: Error | null = null;
  lastOutboundState = 'sending';

  logServerEvent('whatsapp-client', `WhatsApp API Request: POST ${url}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(config),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.json().catch(() => ({}));
      
      // Log sanitized meta response to console (token is not in the response body)
      console.log(`[WHATSAPP] Meta API Response: HTTP ${response.status} | Body:`, JSON.stringify(responseBody, null, 2));

      if (response.ok && !responseBody.error && responseBody.messages?.[0]?.id) {
        lastOutboundAt = new Date().toISOString();
        lastOutboundMessageId = responseBody.messages[0].id;
        lastOutboundState = 'accepted_by_meta';
        lastApiError = null;
        logServerEvent('whatsapp-client', `Returned message ID: ${lastOutboundMessageId}`);
        return responseBody as WhatsAppSendResponse;
      }

      const errDetails = parseSanitizedError(response.status, responseBody, recipient);
      lastApiError = errDetails;
      lastOutboundState = 'failed';
      // Record WAMID if it exists despite failure
      if (errDetails.wamid) {
        lastOutboundMessageId = errDetails.wamid;
      }

      // Don't retry permanent errors
      if (!isRetryableStatus(response.status)) {
        throw new Error(errDetails.message);
      }

      lastError = new Error(errDetails.message);
      logServerEvent('whatsapp-client', `Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}): ${errDetails.message}`);
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('WhatsApp API request timed out');
        lastApiError = { message: 'Request timed out', recipient };
        lastOutboundState = 'failed';
        logServerEvent('whatsapp-client', `Timeout (attempt ${attempt + 1}/${MAX_RETRIES})`);
      } else if (err instanceof Error && !isRetryableError(err)) {
        lastOutboundState = 'failed';
        throw err;
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
        lastApiError = { message: lastError.message, recipient };
        lastOutboundState = 'failed';
      }
    }

    // Exponential backoff before retry
    if (attempt < MAX_RETRIES) {
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('WhatsApp API request failed after retries');
}

function isRetryableError(err: Error): boolean {
  // AbortError (timeout) and network errors are retryable
  return (
    err.name === 'AbortError' ||
    err.message.includes('fetch failed') ||
    err.message.includes('ECONNRESET') ||
    err.message.includes('Meta API HTTP 5') ||
    err.message.includes('Meta API HTTP 429')
  );
}

/**
 * Send a plain text message to a WhatsApp number.
 */
export async function sendTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string
): Promise<WhatsAppSendResponse> {
  logServerEvent('whatsapp-client', `Sending text message to ***${to.slice(-4)}`);

  return whatsAppFetch(getMessagesUrl(config), config, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  }, to);
}

/**
 * Send a template-based message (for proactive alerts).
 */
export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  languageCode: string,
  parameters: string[]
): Promise<WhatsAppSendResponse> {
  logServerEvent('whatsapp-client', `Sending template "${templateName}" to ***${to.slice(-4)}`);

  return whatsAppFetch(getMessagesUrl(config), config, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: parameters.map((p) => ({
            type: 'text',
            text: p,
          })),
        },
      ],
    },
  }, to);
}

/**
 * Mark a received message as read.
 */
export async function markMessageAsRead(
  config: WhatsAppConfig,
  messageId: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    await fetch(getMessagesUrl(config), {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Non-critical — log and move on
    logServerError('whatsapp-client:read-receipt', err);
  }
}

/**
 * Send an interactive message with buttons.
 */
export async function sendInteractiveMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<WhatsAppSendResponse> {
  logServerEvent('whatsapp-client', `Sending interactive message to ***${to.slice(-4)}`);

  return whatsAppFetch(getMessagesUrl(config), config, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  }, to);
}
