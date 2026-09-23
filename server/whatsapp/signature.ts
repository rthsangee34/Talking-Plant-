/**
 * Webhook signature verification using HMAC-SHA256.
 * Validates X-Hub-Signature-256 from Meta.
 */

import crypto from 'crypto';

/**
 * Verify the webhook payload signature from Meta.
 *
 * @param rawBody - Raw request body (Buffer or string)
 * @param signatureHeader - Value of X-Hub-Signature-256 header (e.g. "sha256=abc123...")
 * @param appSecret - WHATSAPP_APP_SECRET from env
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  // Header format: "sha256=<hex_digest>"
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const receivedHex = parts[1];

  try {
    const expectedHex = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison for verify token validation.
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
