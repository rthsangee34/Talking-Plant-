import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setupLiveWebSocketServer } from '../realtime';
import { getGemini } from '../gemini';

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  return { WebSocketServer: class extends EventEmitter {}, WebSocket: { OPEN: 1 } };
});
vi.mock('../gemini', () => ({
  getGemini: vi.fn(), isApiKeyConfigured: () => true,
  GEMINI_LIVE_MODEL: 'gemini-3.8-live', GEMINI_LIVE_VOICE: 'Aoede',
}));
vi.mock('../plant-state', () => ({ getPlantState: () => ({ sensors: { soilMoisture: 42 } }) }));

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let client: any;
let session: any;
let config: any;
let resolveSession: (value: any) => void;

beforeEach(() => {
  vi.useFakeTimers();
  session = { close: vi.fn(), sendRealtimeInput: vi.fn(), sendToolResponse: vi.fn() };
  vi.mocked(getGemini).mockReturnValue({ live: { connect: vi.fn(options => {
    config = options;
    return new Promise(resolve => { resolveSession = resolve; });
  }) } } as any);
  client = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn(), close: vi.fn() });
  const wss = setupLiveWebSocketServer(new EventEmitter() as any);
  wss.emit('connection', client, { url: '/api/live?lang=en' });
});
afterEach(() => { client.emit('close'); vi.useRealTimers(); vi.clearAllMocks(); });

describe('Gemini Live server relay', () => {
  it('waits for setupComplete even after the SDK socket opens', async () => {
    resolveSession(session);
    await flush();
    expect(client.send).not.toHaveBeenCalled();
    client.emit('message', Buffer.from('{"type":"audio","audio":"AAAA"}'));
    expect(session.sendRealtimeInput).not.toHaveBeenCalled();
    config.callbacks.onmessage({ setupComplete: {} });
    expect(JSON.parse(client.send.mock.calls[0][0])).toEqual({ status: 'listening' });
  });

  it('also handles setupComplete arriving before connect resolves', async () => {
    config.callbacks.onmessage({ setupComplete: {} });
    expect(client.send).not.toHaveBeenCalled();
    resolveSession(session);
    await flush();
    expect(JSON.parse(client.send.mock.calls[0][0])).toEqual({ status: 'listening' });
    client.emit('message', Buffer.from('{"type":"audio","audio":"AAAA","mimeType":"audio/pcm;rate=48000"}'));
    expect(session.sendRealtimeInput).toHaveBeenCalledWith({ audio: { data: 'AAAA', mimeType: 'audio/pcm;rate=48000' } });
    client.emit('message', Buffer.from('{"type":"audioStreamEnd"}'));
    expect(session.sendRealtimeInput).toHaveBeenLastCalledWith({ audioStreamEnd: true });
  });

  it('forwards transcriptions and tool identifiers without running tools twice', async () => {
    resolveSession(session); await flush();
    config.callbacks.onmessage({ setupComplete: {} });
    const message = { serverContent: { inputTranscription: { text: 'Hi' } }, toolCall: { functionCalls: [{ id: '1', name: 'get_sensor_readings' }] } };
    config.callbacks.onmessage(message);
    expect(JSON.parse(client.send.mock.calls.at(-1)[0])).toEqual(message);
    expect(config.config.inputAudioTranscription).toEqual({});
    expect(config.config.outputAudioTranscription).toEqual({});
    client.emit('message', Buffer.from('{"type":"toolResponse","id":"1","name":"get_sensor_readings","result":{"moisture":42}}'));
    expect(session.sendToolResponse).toHaveBeenCalledWith({ functionResponses: [{ id: '1', name: 'get_sensor_readings', response: { output: { moisture: 42 } } }] });
  });

  it('closes a late upstream session when the browser has already stopped', async () => {
    client.emit('close');
    resolveSession(session); await flush();
    expect(session.close).toHaveBeenCalled();
    config.callbacks.onmessage({ setupComplete: {} });
    expect(client.send).not.toHaveBeenCalled();
  });

  it('reports connection failures to the browser and closes both ends', async () => {
    resolveSession(session); await flush();
    config.callbacks.onerror(new Error('quota'));
    expect(JSON.parse(client.send.mock.calls[0][0]).error).toContain('Check your key and quota');
    expect(client.close).toHaveBeenCalledWith(1011, 'Live session unavailable');
    expect(session.close).toHaveBeenCalled();
  });
});
