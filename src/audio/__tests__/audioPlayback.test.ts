import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlayback } from '../audioPlayback';

class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate = 24000;
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createBuffer = vi.fn((channels, length, rate) => ({
    duration: length / rate,
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as any,
    buffer: null,
  }));
}

describe('AudioPlayback', () => {
  let playback: AudioPlayback;
  let stateChanges: boolean[] = [];

  beforeEach(() => {
    stateChanges = [];
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', { AudioContext: MockAudioContext });
    playback = new AudioPlayback((playing) => {
      stateChanges.push(playing);
    });
  });

  afterEach(() => {
    playback.close();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('schedules PCM audio chunks and triggers playback state change', async () => {
    const rawPcm = new Int16Array([1000, 2000, 3000, 4000]);
    await playback.playChunk(rawPcm.buffer);

    expect(stateChanges).toEqual([true]);
    expect(playback.getIsPlaying()).toBe(true);
  });

  it('stops and disconnects active sources immediately on interruption', async () => {
    const rawPcm = new Int16Array([1000, 2000]);
    await playback.playChunk(rawPcm.buffer);

    expect(playback.getIsPlaying()).toBe(true);
    playback.stop();

    expect(playback.getIsPlaying()).toBe(false);
    expect(stateChanges).toContain(false);
  });

  it('plays base64 encoded audio strings seamlessly', async () => {
    // 2 samples of PCM16
    const pcm16 = new Int16Array([0, 16384]);
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);

    await playback.playChunk(b64);
    expect(playback.getIsPlaying()).toBe(true);
  });
});
