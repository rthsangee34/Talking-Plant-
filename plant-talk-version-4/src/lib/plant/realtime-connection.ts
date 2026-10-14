import { executePlantToolCall } from './realtime-tools';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';

export interface LiveConnectionCallbacks {
  onStatusChange?: (
    status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error',
    errorMsg?: string
  ) => void;
  onTranscript?: (text: string, sender: 'user' | 'plant', language?: 'en' | 'ta' | 'mixed') => void;
  onTurnComplete?: () => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
  onAudioLevel?: (level: number) => void;
}

export class GeminiLiveConnection {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;
  private isMuted: boolean = false;
  private isRunning: boolean = false;
  private callbacks: LiveConnectionCallbacks = {};

  constructor(callbacks: LiveConnectionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.callbacks.onStatusChange?.('connecting');

      // 1. Pre-warm & unlock Web Audio output context directly during user click gesture
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.outputAudioCtx) {
            this.outputAudioCtx = new AudioCtx();
          }
          if (this.outputAudioCtx.state === 'suspended') {
            await this.outputAudioCtx.resume().catch(() => {});
          }
          this.nextStartTime = this.outputAudioCtx.currentTime;
        }
      }

      // 2. Request microphone permission
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone permission is required for Live Speaking.');
        }
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micErr: any) {
        console.warn('[GeminiLive] Microphone access denied or unavailable:', micErr);
        this.callbacks.onStatusChange?.('error', 'Microphone permission is required for Live Speaking.');
        this.cleanup();
        return;
      }

      // 3. Establish WebSocket to backend Live proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/api/live`;
      const { apiKey } = useSettingsStore.getState();
      if (apiKey) {
        wsUrl += `?key=${encodeURIComponent(apiKey)}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.callbacks.onStatusChange?.('listening');
        useApiUsageStore.getState().recordApiCall('live', '/api/live', 'success');
        this.startAudioProcessing();
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.audio) {
            this.callbacks.onStatusChange?.('speaking');
            this.playAudioChunk(msg.audio);
          }

          if (msg.interrupted) {
            console.log('[GeminiLive] Received interruption event from server.');
            this.stopPlayback();
            this.callbacks.onTurnComplete?.();
            this.callbacks.onStatusChange?.('listening');
          }

          if (msg.turnComplete) {
            this.callbacks.onTurnComplete?.();
          }

          if (msg.userTranscript) {
            this.callbacks.onTranscript?.(msg.userTranscript, 'user');
          }

          if (msg.plantTranscript) {
            this.callbacks.onTranscript?.(msg.plantTranscript, 'plant');
          }

          if (msg.toolCall) {
            const { id, name, args } = msg.toolCall;
            const result = await executePlantToolCall(name, args || {});
            this.callbacks.onToolCall?.(name, args || {}, result);

            // Send tool response back to Gemini Live
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: 'toolResponse',
                  id,
                  name,
                  result,
                })
              );
            }
          }

          if (msg.error) {
            this.callbacks.onStatusChange?.('error', msg.error);
          }
        } catch (e) {
          console.error('[GeminiLive] Error processing Live message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[GeminiLive] WebSocket error:', err);
        this.callbacks.onStatusChange?.('error', 'WebSocket connection failed.');
      };

      this.ws.onclose = () => {
        if (this.isRunning) {
          this.callbacks.onStatusChange?.('disconnected');
          this.cleanup();
        }
      };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Gemini Live.';
      this.callbacks.onStatusChange?.('error', msg);
      this.cleanup();
    }
  }

  private startAudioProcessing(): void {
    if (!this.mediaStream) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx();
      const currentSampleRate = this.inputAudioCtx.sampleRate || 16000;
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.sourceNode.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const float32Data = e.inputBuffer.getChannelData(0);

        // Calculate energy / RMS for barge-in detection & audio metering
        let sumSquares = 0;
        for (let i = 0; i < float32Data.length; i++) {
          sumSquares += float32Data[i] * float32Data[i];
        }
        const rms = Math.sqrt(sumSquares / float32Data.length);

        // Section 9: Interruption / Barge-in
        // If user starts speaking while Gemini is speaking, cancel playback immediately
        if (this.activeSources.length > 0) {
          if (rms > 0.04) {
            console.log('[GeminiLive] User barge-in speech detected — stopping plant audio.');
            this.stopPlayback();
            this.callbacks.onStatusChange?.('listening');
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'interrupt' }));
            }
          }
        } else {
          // Report mic input level when plant is not speaking
          this.callbacks.onAudioLevel?.(Math.min(1, rms * 5));
        }

        // Resample from hardware sample rate (e.g. 48000Hz or 44100Hz) down to 16000Hz for Gemini Live
        const resampled = this.resampleTo16k(float32Data, currentSampleRate);
        const pcm16Data = this.convertFloat32ToPCM16(resampled);
        const base64Audio = this.arrayBufferToBase64(pcm16Data);

        this.ws.send(
          JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          })
        );
      };
    } catch (err) {
      console.warn('[GeminiLive] AudioContext input setup failed:', err);
    }
  }

  private resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
    if (fromRate === 16000 || !fromRate) return input;
    const ratio = fromRate / 16000;
    const targetLength = Math.round(input.length / ratio);
    const result = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const origIndex = i * ratio;
      const index = Math.floor(origIndex);
      const frac = origIndex - index;
      const s0 = input[index] || 0;
      const s1 = input[index + 1] !== undefined ? input[index + 1] : s0;
      result[i] = s0 + frac * (s1 - s0);
    }
    return result;
  }

  private playAudioChunk(base64Audio: string): void {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.outputAudioCtx) {
      this.outputAudioCtx = new AudioCtx();
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume().catch(() => {});
    }

    const pcmData = this.base64ToPCM16(base64Audio);
    if (!pcmData || pcmData.length === 0) return;

    const float32Data = new Float32Array(pcmData.length);
    let chunkSum = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const val = pcmData[i] / 32768;
      float32Data[i] = val;
      chunkSum += val * val;
    }

    // Report audio level for live visualizer
    const chunkRms = Math.sqrt(chunkSum / float32Data.length);
    this.callbacks.onAudioLevel?.(Math.min(1, chunkRms * 4));

    // Web Audio natively resamples 24000Hz buffer to hardware audio device rate
    const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioCtx.destination);

    const now = this.outputAudioCtx.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      if (this.activeSources.length === 0) {
        setTimeout(() => {
          if (this.activeSources.length === 0 && this.isRunning) {
            this.callbacks.onStatusChange?.('listening');
            this.callbacks.onAudioLevel?.(0);
          }
        }, 150);
      }
    };
  }

  public stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.callbacks.onAudioLevel?.(0);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted) {
      this.callbacks.onAudioLevel?.(0);
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.callbacks.onStatusChange?.('disconnected');
  }

  private cleanup(): void {
    this.isRunning = false;
    this.stopPlayback();

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.onAudioLevel?.(0);
  }

  private convertFloat32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToPCM16(base64: string): Int16Array {
    try {
      const binary = atob(base64);
      const len = binary.length;
      const sampleCount = Math.floor(len / 2);
      const int16Array = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const byte0 = binary.charCodeAt(i * 2);
        const byte1 = binary.charCodeAt(i * 2 + 1);
        int16Array[i] = (byte0 | (byte1 << 8)) << 16 >> 16;
      }
      return int16Array;
    } catch (e) {
      console.warn('[GeminiLive] base64ToPCM16 decoding error:', e);
      return new Int16Array(0);
    }
  }
}
