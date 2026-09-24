import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleProtectionAlertRequest, handlePlantVariationRequest } from '../protection';

vi.mock('../gemini', () => ({
  getGemini: vi.fn(),
  ensureApiKey: vi.fn((_res, reqApiKey) => {
    return true;
  }),
  isApiKeyConfigured: vi.fn(() => true),
  GEMINI_VISION_MODEL: 'gemini-3.6-flash',
  GEMINI_LIVE_VOICE: 'Aoede',
}));

vi.mock('../../src/lib/api/response-logging', () => ({
  logServerEvent: vi.fn(),
  logServerError: vi.fn(),
}));

describe('Server Protection Alert Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handleProtectionAlertRequest generates structured response from Gemini', async () => {
    const { getGemini } = await import('../gemini');

    const mockAi = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            tamilText: 'அட! என் இலைகளில் படபடப்பு, கையை விலக்குங்கள்!',
            englishText: 'Hey! Flutter on my leaves, please step back!',
            escalationLevel: 1,
            tone: 'surprised',
          }),
        }),
      },
    };
    (getGemini as unknown as { mockReturnValue: (val: unknown) => void }).mockReturnValue(mockAi);

    const req = {
      headers: {},
      body: {
        escalationLevel: 1,
        touchType: 'initial',
        touchCount: 1,
        plantName: 'Fern',
      },
    } as any;

    let responseData: any = null;
    const res = {
      json: vi.fn((data) => {
        responseData = data;
      }),
      status: vi.fn().mockReturnThis(),
    } as any;

    await handleProtectionAlertRequest(req, res);

    expect(mockAi.models.generateContent).toHaveBeenCalledTimes(2);
    expect(responseData).not.toBeNull();
    expect(responseData.tamilText).toContain('அட!');
    expect(responseData.englishText).toContain('leaves');
    expect(responseData.escalationLevel).toBe(1);
    expect(responseData.source).toBe('gemini');
    expect(typeof responseData.latencyMs).toBe('number');
  });

  it('handleProtectionAlertRequest returns fallback when Gemini throws an error', async () => {
    const { getGemini } = await import('../gemini');

    const mockAi = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('Quota limit exceeded')),
      },
    };
    (getGemini as unknown as { mockReturnValue: (val: unknown) => void }).mockReturnValue(mockAi);

    const req = {
      headers: {},
      body: {
        escalationLevel: 5,
        touchType: 'initial',
        touchCount: 5,
      },
    } as any;

    let responseData: any = null;
    const res = {
      json: vi.fn((data) => {
        responseData = data;
      }),
      status: vi.fn().mockReturnThis(),
    } as any;

    await handleProtectionAlertRequest(req, res);

    expect(responseData).not.toBeNull();
    expect(responseData.source).toBe('fallback');
    expect(responseData.escalationLevel).toBe(5);
    expect(responseData.tone).toBe('alarmed');
    expect(responseData.englishText).toContain('Emergency');
    expect(responseData.tamilText).toContain('அவசர எச்சரிக்கை');
  });

  it('handlePlantVariationRequest returns generated phrases from Gemini', async () => {
    const { getGemini } = await import('../gemini');

    const mockAi = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            phrases: [
              'Phrase 1 in Tamil',
              'Phrase 2 in Tamil',
              'Phrase 3 in Tamil',
            ],
          }),
        }),
      },
    };
    (getGemini as unknown as { mockReturnValue: (val: unknown) => void }).mockReturnValue(mockAi);

    const req = {
      headers: {},
      body: {
        lang: 'ta',
      },
    } as any;

    let responseData: any = null;
    const res = {
      json: vi.fn((data) => {
        responseData = data;
      }),
      status: vi.fn().mockReturnThis(),
    } as any;

    await handlePlantVariationRequest(req, res);

    expect(responseData).not.toBeNull();
    expect(responseData.phrases).toHaveLength(3);
    expect(responseData.phrases[0]).toBe('Phrase 1 in Tamil');
  });
});
