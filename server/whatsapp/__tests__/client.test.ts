/**
 * WhatsApp Cloud API client tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendTextMessage,
  sendTemplateMessage,
  markMessageAsRead,
  sendInteractiveMessage,
} from '../client';
import type { WhatsAppConfig } from '../types';

const mockConfig: WhatsAppConfig = {
  accessToken: 'test-access-token',
  phoneNumberId: '123456789',
  businessAccountId: 'biz-987',
  verifyToken: 'test-verify-token',
  appSecret: 'test-app-secret',
  graphApiVersion: 'v21.0',
  ownerNumber: '94771234567',
  alertsEnabled: true,
  alertCooldownMinutes: 30,
  dailyAlertLimit: 20,
  alertTemplateName: 'plant_health_alert',
  criticalTemplateName: 'plant_critical_alert',
  templateLanguage: 'en',
  automatedAlertsEnabled: true,
};

global.fetch = vi.fn();

describe('WhatsApp API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends text message with proper endpoint and headers', async () => {
    const mockResponse = {
      messaging_product: 'whatsapp',
      contacts: [{ input: '94771234567', wa_id: '94771234567' }],
      messages: [{ id: 'wamid.HBgL' }],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const res = await sendTextMessage(mockConfig, '94771234567', 'Hello Plant!');

    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/123456789/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '94771234567',
          type: 'text',
          text: { preview_url: false, body: 'Hello Plant!' },
        }),
      })
    );
  });

  it('sends template message with structured parameters', async () => {
    const mockResponse = {
      messaging_product: 'whatsapp',
      contacts: [{ input: '94771234567', wa_id: '94771234567' }],
      messages: [{ id: 'wamid.HBgL2' }],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const res = await sendTemplateMessage(
      mockConfig,
      '94771234567',
      'plant_health_alert',
      'en',
      ['Jasmine', 'Soil too dry', '10%', 'Water immediately', '04:00 PM']
    );

    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/123456789/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '94771234567',
          type: 'template',
          template: {
            name: 'plant_health_alert',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Jasmine' },
                  { type: 'text', text: 'Soil too dry' },
                  { type: 'text', text: '10%' },
                  { type: 'text', text: 'Water immediately' },
                  { type: 'text', text: '04:00 PM' },
                ],
              },
            ],
          },
        }),
      })
    );
  });

  it('marks message as read', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    await markMessageAsRead(mockConfig, 'msg-12345');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/123456789/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'msg-12345',
        }),
      })
    );
  });

  it('sends interactive button message', async () => {
    const mockResponse = {
      messaging_product: 'whatsapp',
      contacts: [{ input: '94771234567', wa_id: '94771234567' }],
      messages: [{ id: 'wamid.HBgL3' }],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const res = await sendInteractiveMessage(mockConfig, '94771234567', 'Select an option:', [
      { id: 'btn_status', title: 'Check Status' },
      { id: 'btn_help', title: 'Help' },
    ]);

    expect(res).toEqual(mockResponse);
  });

  it('handles non-ok HTTP responses and throws sanitized error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          message: 'Invalid OAuth access token',
          type: 'OAuthException',
          code: 190,
        },
      }),
    } as Response);

    await expect(sendTextMessage(mockConfig, '94771234567', 'Test')).rejects.toThrow(
      'Invalid OAuth access token'
    );
  });
});
