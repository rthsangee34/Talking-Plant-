import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MicrophoneProcessor } from '../microphoneProcessor';

describe('MicrophoneProcessor', () => {
  let processor: MicrophoneProcessor;
  let mockStream: any;
  let mockTrack: any;
  let getUserMedia: any;

  beforeEach(() => {
    mockTrack = {
      enabled: true,
      stop: vi.fn(),
    };
    mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    };
    getUserMedia = vi.fn().mockResolvedValue(mockStream);

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
      },
    });

    processor = new MicrophoneProcessor();
  });

  afterEach(() => {
    processor.stop();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('normalizes permission denied into user-friendly error', () => {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    const norm = processor.normalizeMicrophoneError(error);
    expect(norm.code).toBe('PERMISSION_DENIED');
    expect(norm.message).toContain('Microphone permission is required');
  });

  it('normalizes device not found error', () => {
    const error = new Error('No mic found');
    error.name = 'NotFoundError';
    const norm = processor.normalizeMicrophoneError(error);
    expect(norm.code).toBe('MICROPHONE_UNAVAILABLE');
    expect(norm.message).toContain('No input audio device');
  });

  it('normalizes mic in use error', () => {
    const error = new Error('In use');
    error.name = 'NotReadableError';
    const norm = processor.normalizeMicrophoneError(error);
    expect(norm.code).toBe('MICROPHONE_IN_USE');
    expect(norm.message).toContain('already in use');
  });

  it('converts Float32 audio samples to 16-bit PCM little-endian ArrayBuffer', () => {
    const input = new Float32Array([-1, 0, 1]);
    const buffer = processor.convertFloat32ToPCM16(input);
    const view = new DataView(buffer);
    expect(view.getInt16(0, true)).toBe(-32768);
    expect(view.getInt16(2, true)).toBe(0);
    expect(view.getInt16(4, true)).toBe(32767);
  });

  it('mutes and unmutes microphone audio tracks', () => {
    (processor as any).mediaStream = mockStream;
    processor.setMuted(true);
    expect(mockTrack.enabled).toBe(false);
    expect(processor.getIsMuted()).toBe(true);

    processor.setMuted(false);
    expect(mockTrack.enabled).toBe(true);
    expect(processor.getIsMuted()).toBe(false);
  });
});
