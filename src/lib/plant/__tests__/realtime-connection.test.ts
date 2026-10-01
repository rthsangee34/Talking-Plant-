import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiLiveConnection } from '../realtime-connection';
import { liveVoiceManager } from '../live-voice-manager';
import { useSettingsStore } from '../../../stores/plant/settings-store';
import { useConversationStore } from '../../../stores/plant/conversation-store';
import { executePlantToolCall } from '../realtime-tools';

vi.mock('../realtime-tools', () => ({ executePlantToolCall: vi.fn().mockResolvedValue({ moisture: 42 }) }));

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  binaryType = '';
  onopen: any;
  onmessage: any;
  onclose: any;
  onerror: any;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; });
  constructor(public url: string) { FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.({}); }
  message(message: unknown) { this.onmessage?.({ data: typeof message === 'string' || message instanceof Blob || message instanceof ArrayBuffer ? message : JSON.stringify(message) }); }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate: number;
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  input = { connect: vi.fn(), disconnect: vi.fn() };
  processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as any };
  gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  sources: any[] = [];
  constructor(options: { sampleRate: number }) { this.sampleRate = options.sampleRate; FakeAudioContext.instances.push(this); }
  createMediaStreamSource() { return this.input; }
  createScriptProcessor() { return this.processor; }
  createGain() { return this.gain; }
  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => data };
  }
  createBufferSource() {
    const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null, buffer: null };
    this.sources.push(source);
    return source;
  }
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let connection: GeminiLiveConnection;
let status: ReturnType<typeof vi.fn>;
let transcript: ReturnType<typeof vi.fn>;
let track: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
let stream: any;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  FakeAudioContext.instances = [];
  track = { stop: vi.fn(), enabled: true };
  stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('window', { AudioContext: FakeAudioContext, location: { protocol: 'https:', host: 'talkingplant.web.app' } });
  vi.stubGlobal('WebSocket', FakeSocket);
  useSettingsStore.setState({ apiKey: 'test-user-key', geminiLiveModel: 'gemini-3.6-flash', preferredLanguage: 'en' });
  useConversationStore.setState({ isMuted: false, liveStatus: 'disconnected' });
  status = vi.fn(); transcript = vi.fn();
  connection = new GeminiLiveConnection({ onStatusChange: status, onTranscript: transcript });
});

afterEach(() => {
  connection.disconnect();
  liveVoiceManager.stopLiveSpeaking();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function start(ready = true) {
  const pending = connection.connect();
  await flush();
  const ws = FakeSocket.instances.at(-1)!;
  ws.open();
  if (ready) {
    ws.message({ setupComplete: {} });
    await pending;
  }
  return { ws, pending };
}

describe('real-time voice transport', () => {
  it('connects Hosting directly and waits for a binary setup acknowledgement', async () => {
    const { ws, pending } = await start(false);
    expect(ws.url).toContain('generativelanguage.googleapis.com');
    expect(status).toHaveBeenLastCalledWith('connecting');
    expect(FakeAudioContext.instances[0].processor.onaudioprocess).toBeNull();
    const setup = JSON.parse(ws.send.mock.calls[0][0]).setup;
    expect(setup.model).toBe('models/gemini-3.8-live');
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    ws.message(new TextEncoder().encode('{"setupComplete":{}}').buffer);
    await pending;
    expect(status).toHaveBeenLastCalledWith('listening');
    expect(FakeAudioContext.instances[1].resume).toHaveBeenCalled();
  });

  it('streams little-endian microphone PCM at the actual context rate', async () => {
    const { ws } = await start();
    const input = FakeAudioContext.instances[0];
    input.sampleRate = 48000;
    input.processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([-1, 0, 1]) } });
    const audio = JSON.parse(ws.send.mock.calls.at(-1)![0]).realtimeInput.audio;
    expect(audio.mimeType).toBe('audio/pcm;rate=48000');
    expect([...Buffer.from(audio.data, 'base64')]).toEqual([0, 128, 0, 0, 255, 127]);
  });

  it('plays binary audio replies and joins native transcript fragments into turns', async () => {
    const { ws } = await start();
    ws.message(new Blob([JSON.stringify({ serverContent: { inputTranscription: { text: 'Hi' } } })]));
    ws.message(new TextEncoder().encode(JSON.stringify({ serverContent: {
      outputTranscription: { text: 'Hello ' },
      modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==', mimeType: 'audio/pcm;rate=24000' } }] },
    } })).buffer);
    ws.message({ serverContent: { outputTranscription: { text: 'friend!' }, turnComplete: true } });
    await flush();
    expect(transcript).toHaveBeenCalledWith('Hi', 'user', 'en');
    expect(transcript).toHaveBeenCalledWith('Hello friend!', 'plant', 'en');
    expect(transcript).toHaveBeenCalledTimes(2);
    expect(FakeAudioContext.instances[1].sources[0].start).toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith('speaking');
    FakeAudioContext.instances[1].sources[0].onended();
    expect(status).toHaveBeenLastCalledWith('listening');
  });

  it('uses Gemini interruption signals to clear queued playback', async () => {
    const { ws } = await start();
    ws.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==', mimeType: 'audio/pcm;rate=24000' } }] } } });
    await flush();
    ws.message({ serverContent: { interrupted: true } });
    await flush();
    expect(FakeAudioContext.instances[1].sources[0].stop).toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith('listening');
    expect(ws.send).toHaveBeenCalledTimes(1); // No empty user turn or echo-triggered cancellation.
  });

  it('flushes and stops input on mute, then resumes streaming on unmute', async () => {
    const { ws } = await start();
    connection.setMuted(true);
    expect(track.enabled).toBe(false);
    expect(JSON.parse(ws.send.mock.calls.at(-1)![0])).toEqual({ realtimeInput: { audioStreamEnd: true } });
    const count = ws.send.mock.calls.length;
    const event = { inputBuffer: { getChannelData: () => new Float32Array([0]) } };
    FakeAudioContext.instances[0].processor.onaudioprocess(event);
    expect(ws.send).toHaveBeenCalledTimes(count);
    connection.setMuted(false);
    FakeAudioContext.instances[0].processor.onaudioprocess(event);
    expect(track.enabled).toBe(true);
    expect(ws.send).toHaveBeenCalledTimes(count + 1);
  });

  it('reports a rejected handshake and releases the microphone', async () => {
    const { ws, pending } = await start(false);
    ws.onclose({ code: 1008, reason: 'Model unavailable for this key' });
    await pending;
    expect(status).toHaveBeenLastCalledWith('error', 'Model unavailable for this key');
    expect(track.stop).toHaveBeenCalled();
  });

  it('times out a silent handshake instead of staying Connecting forever', async () => {
    const { pending } = await start(false);
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    expect(status).toHaveBeenLastCalledWith('error', expect.stringContaining('did not become ready'));
    expect(track.stop).toHaveBeenCalled();
  });

  it('stopping while permission is pending never reopens the microphone or socket', async () => {
    let grant: (value: any) => void;
    getUserMedia.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    const pending = connection.connect();
    connection.disconnect();
    grant!(stream);
    await pending;
    expect(track.stop).toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(status).toHaveBeenLastCalledWith('disconnected');
  });

  it('stopping during the handshake cancels pending timers and late messages', async () => {
    const { ws, pending } = await start(false);
    const lateMessage = ws.onmessage;
    connection.disconnect();
    lateMessage({ data: '{"setupComplete":{}}' });
    await vi.advanceTimersByTimeAsync(20000);
    await pending;
    expect(status).toHaveBeenLastCalledWith('disconnected');
    expect(ws.close).toHaveBeenCalled();
  });

  it('waits for Gemini readiness through the proxy and preserves tool IDs', async () => {
    useSettingsStore.setState({ apiKey: '' });
    const { ws, pending } = await start(false);
    expect(ws.url).toContain('/api/live?lang=en');
    ws.message({ status: 'connected' });
    await flush();
    expect(status).toHaveBeenLastCalledWith('connecting');
    ws.message({ status: 'listening' });
    await pending;
    ws.message({ toolCall: { functionCalls: [{ id: 'tool-1', name: 'get_sensor_readings', args: {} }] } });
    await flush();
    expect(executePlantToolCall).toHaveBeenCalledWith('get_sensor_readings', {});
    expect(JSON.parse(ws.send.mock.calls.at(-1)![0])).toEqual({ type: 'toolResponse', id: 'tool-1', name: 'get_sensor_readings', result: { moisture: 42 } });
  });

  it('allows Start Speak to retry immediately after microphone denial', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    await liveVoiceManager.startLiveSpeaking();
    expect(useConversationStore.getState().liveStatus).toBe('error');
    const pending = liveVoiceManager.startLiveSpeaking();
    await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    const ws = FakeSocket.instances[0];
    ws.open(); ws.message({ setupComplete: {} });
    await pending;
    expect(useConversationStore.getState().liveStatus).toBe('listening');
  });
});
