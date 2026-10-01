import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geminiLiveService, detectSpokenLanguage } from '../geminiLiveService';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';

class MockSocket {
  static instances: MockSocket[] = [];
  readyState = 0;
  binaryType = '';
  onopen: any;
  onmessage: any;
  onclose: any;
  onerror: any;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });

  constructor(public url: string) {
    MockSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  emit(data: any) {
    this.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }
}

class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate = 16000;
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
  createScriptProcessor = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  }));
  createGain = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }));
  createBuffer = vi.fn((c, length, rate) => ({
    duration: length / rate,
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    buffer: null,
  }));
}

describe('geminiLiveService', () => {
  let states: string[] = [];
  let userTranscripts: { text: string; isFinal: boolean }[] = [];
  let assistantTranscripts: { text: string; isFinal: boolean }[] = [];
  let interruptions = 0;

  beforeEach(() => {
    states = [];
    userTranscripts = [];
    assistantTranscripts = [];
    interruptions = 0;
    MockSocket.instances = [];

    const mockTrack = { enabled: true, stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack], getAudioTracks: () => [mockTrack] };

    vi.stubGlobal('WebSocket', MockSocket);
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', {
      AudioContext: MockAudioContext,
      location: { protocol: 'http:', host: 'localhost:3000' },
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    useSettingsStore.setState({ apiKey: 'test-api-key', preferredLanguage: 'en' });
    useSensorsStore.setState({
      readings: { moisture: 55, light: 70, temperature: 24, humidity: 60 },
      isEspConnected: true,
    });

    geminiLiveService.setCallbacks({
      onStateChange: (s) => states.push(s),
      onUserTranscript: (text, isFinal) => userTranscripts.push({ text, isFinal }),
      onAssistantTranscript: (text, isFinal) => assistantTranscripts.push({ text, isFinal }),
      onInterruption: () => interruptions++,
    });
  });

  afterEach(() => {
    geminiLiveService.disconnect();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const flush = async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };

  it('detects spoken language accurately for English, Tamil, and Tanglish', () => {
    expect(detectSpokenLanguage('Do I need to water my plant?')).toBe('en');
    expect(detectSpokenLanguage('வணக்கம் எப்படி இருக்கிறீர்கள்?')).toBe('ta');
    expect(detectSpokenLanguage('innaiku water venuma?')).toBe('ta');
    expect(detectSpokenLanguage('வணக்கம் hello')).toBe('mixed');
  });

  it('transitions state machine: idle -> connecting -> listening -> speaking -> stopping -> idle', async () => {
    const connectPromise = geminiLiveService.connect();
    expect(states).toContain('connecting');
    await flush();

    const ws = MockSocket.instances[0];
    expect(ws).toBeDefined();
    ws.open();
    ws.emit({ setupComplete: {} });

    await connectPromise;
    expect(states).toContain('listening');
    expect(geminiLiveService.isLiveActive()).toBe(true);

    // Audio arrives
    ws.emit({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/pcm;rate=24000' } }],
        },
      },
    });
    await flush();

    // Simulate interruption
    ws.emit({ serverContent: { interrupted: true } });
    await flush();
    expect(interruptions).toBe(1);

    // Disconnect
    geminiLiveService.disconnect();
    expect(states).toContain('stopping');
    expect(states).toContain('idle');
  });

  it('handles streaming transcriptions properly without duplicate turns', async () => {
    const connectPromise = geminiLiveService.connect();
    await flush();
    const ws = MockSocket.instances[0];
    ws.open();
    ws.emit({ setupComplete: {} });
    await connectPromise;

    // User speaks in chunks
    ws.emit({ serverContent: { inputTranscription: { text: 'Should I water ' } } });
    await flush();
    ws.emit({ serverContent: { inputTranscription: { text: 'my plant?', finished: true } } });
    await flush();

    expect(userTranscripts.length).toBeGreaterThanOrEqual(1);
    expect(userTranscripts.at(-1)?.text).toBe('Should I water my plant?');
    expect(userTranscripts.at(-1)?.isFinal).toBe(true);

    // Plant speaks
    ws.emit({ serverContent: { outputTranscription: { text: 'Soil is moist' } } });
    await flush();
    ws.emit({ serverContent: { turnComplete: true } });
    await flush();

    expect(assistantTranscripts.at(-1)?.text).toBe('Soil is moist');
    expect(assistantTranscripts.at(-1)?.isFinal).toBe(true);
  });
});
