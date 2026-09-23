import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  INITIAL_ENGLISH_WARNINGS,
  INITIAL_TAMIL_WARNINGS,
  getRandomWarningPhrase,
  getWarningPhrasesPool,
  addWarningPhrase,
  pickVoiceForLanguage,
  speakTouchWarning,
} from '../warning-voice-system';

describe('Spoken Warnings & Voice Personality System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('contains at least 15 pre-cached phrases for both English and Tamil', () => {
    expect(INITIAL_ENGLISH_WARNINGS.length).toBeGreaterThanOrEqual(15);
    expect(INITIAL_TAMIL_WARNINGS.length).toBeGreaterThanOrEqual(15);

    expect(getWarningPhrasesPool('en').length).toBeGreaterThanOrEqual(15);
    expect(getWarningPhrasesPool('ta').length).toBeGreaterThanOrEqual(15);
  });

  it('returns valid random phrases from respective language pools', () => {
    const enPhrase = getRandomWarningPhrase('en');
    expect(typeof enPhrase).toBe('string');
    expect(enPhrase.length).toBeGreaterThan(5);
    expect(getWarningPhrasesPool('en')).toContain(enPhrase);

    const taPhrase = getRandomWarningPhrase('ta');
    expect(typeof taPhrase).toBe('string');
    expect(taPhrase.length).toBeGreaterThan(5);
    expect(getWarningPhrasesPool('ta')).toContain(taPhrase);
  });

  it('adds newly generated phrases to the dynamic phrase pool', () => {
    const newEn = "Hey human, keep those digits away from my chloroplasts!";
    addWarningPhrase(newEn, 'en');
    expect(getWarningPhrasesPool('en')).toContain(newEn);

    const newTa = "என் பச்சையத்தை தொடாதீங்க!";
    addWarningPhrase(newTa, 'ta');
    expect(getWarningPhrasesPool('ta')).toContain(newTa);
  });

  it('selects appropriate voice based on target language', () => {
    const mockVoices = [
      { name: 'Microsoft David', lang: 'en-US' } as SpeechSynthesisVoice,
      { name: 'Google UK English Female', lang: 'en-GB' } as SpeechSynthesisVoice,
      { name: 'Google தமிழ்', lang: 'ta-IN' } as SpeechSynthesisVoice,
    ];

    const chosenTa = pickVoiceForLanguage(mockVoices, 'ta');
    expect(chosenTa?.name).toBe('Google தமிழ்');

    const chosenEn = pickVoiceForLanguage(mockVoices, 'en');
    expect(chosenEn?.name).toBe('Google UK English Female');
  });

  it('invokes window.speechSynthesis immediately with proper pitch shift and voice', () => {
    const cancelMock = vi.fn();
    const speakMock = vi.fn();

    // Mock window.speechSynthesis
    (global as unknown as { window: unknown }).window = {
      speechSynthesis: {
        cancel: cancelMock,
        speak: speakMock,
        getVoices: () => [
          { name: 'Google UK English Female', lang: 'en-GB' } as SpeechSynthesisVoice,
        ],
      },
    };

    class MockSpeechSynthesisUtterance {
      text: string;
      pitch = 1;
      rate = 1;
      lang = '';
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    (global as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    const spoken = speakTouchWarning("Hands off my leaves!", 'en');
    expect(spoken).toBe(true);
    expect(cancelMock).toHaveBeenCalledTimes(1); // Clears previous utterances for zero-latency
    expect(speakMock).toHaveBeenCalledTimes(1);

    const calledUtterance = speakMock.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(calledUtterance.text).toBe("Hands off my leaves!");
    expect(calledUtterance.pitch).toBeGreaterThan(1.1); // lively cute pitch
    expect(calledUtterance.lang).toBe('en-US');
  });

  it('provides client fallbacks across all progressive escalation levels', async () => {
    const { getClientFallbackAlert } = await import('../warning-voice-system');

    // Level 1: Surprised
    const l1 = getClientFallbackAlert(1, 'initial');
    expect(l1.escalationLevel).toBe(1);
    expect(l1.tone).toBe('surprised');
    expect(l1.tamilText).toContain('அட!');
    expect(l1.englishText).toContain('tickles');

    // Level 2: Gentle
    const l2 = getClientFallbackAlert(2, 'initial');
    expect(l2.escalationLevel).toBe(2);
    expect(l2.tone).toBe('gentle');
    expect(l2.tamilText).toContain('மென்மையானவை');

    // Level 3: Firm
    const l3 = getClientFallbackAlert(3, 'initial');
    expect(l3.escalationLevel).toBe(3);
    expect(l3.tone).toBe('firm');
    expect(l3.tamilText).toContain('தொடாதீர்கள்');

    // Level 4: Distressed
    const l4 = getClientFallbackAlert(4, 'initial');
    expect(l4.escalationLevel).toBe(4);
    expect(l4.tone).toBe('distressed');
    expect(l4.tamilText).toContain('நிறுத்துங்கள்');

    // Level 5: Alarmed emergency
    const l5 = getClientFallbackAlert(5, 'initial');
    expect(l5.escalationLevel).toBe(5);
    expect(l5.tone).toBe('alarmed');
    expect(l5.tamilText).toContain('அவசர எச்சரிக்கை');

    // Continuous 3s
    const c3 = getClientFallbackAlert(3, 'continuous-3s');
    expect(c3.escalationLevel).toBe(3);
    expect(c3.tone).toBe('distressed');
    expect(c3.tamilText).toContain('கையை விலக்குங்கள்');

    // Continuous 6s
    const c6 = getClientFallbackAlert(4, 'continuous-6s');
    expect(c6.escalationLevel).toBe(4);
    expect(c6.tone).toBe('alarmed');
    expect(c6.tamilText).toContain('நசுங்குகிறது');
  });

  it('fetches Gemini protection alert, enriches phrase pool, and tracks API usage', async () => {
    const { fetchGeminiProtectionAlert } = await import('../warning-voice-system');
    const { useApiUsageStore } = await import('../../../stores/plant/api-usage-store');

    const initialProtectionAlerts = useApiUsageStore.getState().protectionAlerts;

    // Mock fetch
    const mockGeminiResponse = {
      tamilText: 'அடடே! என் இலைகள் மிக மென்மையானவை, கையை எடுங்கள்!',
      englishText: 'Whoa! My foliage is very soft, please hands off!',
      escalationLevel: 2,
      tone: 'gentle',
      source: 'gemini',
      latencyMs: 320,
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });
    global.fetch = fetchSpy;

    const result = await fetchGeminiProtectionAlert({
      escalationLevel: 2,
      touchType: 'initial',
      touchCount: 2,
      language: 'ta',
      plantName: 'Monstera',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/plant/protection-alert',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(result.tamilText).toBe(mockGeminiResponse.tamilText);
    expect(result.englishText).toBe(mockGeminiResponse.englishText);
    expect(result.escalationLevel).toBe(2);
    expect(result.source).toBe('gemini');

    // Telemetry tracking incremented
    const updatedProtectionAlerts = useApiUsageStore.getState().protectionAlerts;
    expect(updatedProtectionAlerts).toBe(initialProtectionAlerts + 1);

    // Dynamic phrase pools enriched
    expect(getWarningPhrasesPool('ta')).toContain(mockGeminiResponse.tamilText);
    expect(getWarningPhrasesPool('en')).toContain(mockGeminiResponse.englishText);
  });

  it('gracefully falls back when Gemini protection API fails and logs error telemetry', async () => {
    const { fetchGeminiProtectionAlert } = await import('../warning-voice-system');
    const { useApiUsageStore } = await import('../../../stores/plant/api-usage-store');

    const initialProtectionAlerts = useApiUsageStore.getState().protectionAlerts;

    // Mock fetch error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await fetchGeminiProtectionAlert({
      escalationLevel: 5,
      touchType: 'initial',
      touchCount: 5,
      language: 'en',
    });

    expect(result.source).toBe('fallback');
    expect(result.escalationLevel).toBe(5);
    expect(result.tone).toBe('alarmed');
    expect(result.englishText).toContain('Emergency');

    // Telemetry logged
    const updatedProtectionAlerts = useApiUsageStore.getState().protectionAlerts;
    expect(updatedProtectionAlerts).toBe(initialProtectionAlerts + 1);
  });

  it('decodes and plays Gemini PCM audio using Web Audio API', async () => {
    const { playGeminiAudio } = await import('../warning-voice-system');

    const mockStart = vi.fn();
    const mockConnect = vi.fn();
    const mockCreateBuffer = vi.fn().mockReturnValue({
      copyToChannel: vi.fn(),
    });
    const mockCreateBufferSource = vi.fn().mockReturnValue({
      connect: mockConnect,
      start: mockStart,
    });

    (global as unknown as { window: unknown }).window = {
      atob: (b64: string) => Buffer.from(b64, 'base64').toString('binary'),
      AudioContext: vi.fn().mockImplementation(() => ({
        state: 'running',
        createBuffer: mockCreateBuffer,
        createBufferSource: mockCreateBufferSource,
        destination: {},
      })),
    };

    // 16-bit PCM little-endian (2 samples = 4 bytes)
    const testPcmBase64 = Buffer.from(new Int16Array([1000, -1000]).buffer).toString('base64');
    const played = await playGeminiAudio(testPcmBase64);
    expect(played).toBe(true);
    expect(mockCreateBuffer).toHaveBeenCalledWith(1, 2, 24000);
    expect(mockStart).toHaveBeenCalledWith(0);
  });
});

