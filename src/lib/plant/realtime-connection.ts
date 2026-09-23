import { executePlantToolCall } from './realtime-tools';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';

export interface LiveConnectionCallbacks {
  onStatusChange?: (
    status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error',
    errorMsg?: string
  ) => void;
  onTranscript?: (text: string, sender: 'user' | 'plant', language?: 'en' | 'ta' | 'mixed') => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
}

export class GeminiLiveConnection {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recognition: any = null;
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

      // 1. Request microphone permission first (Section 8.5)
      try {
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

      // 2. Establish WebSocket to backend Live proxy
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
        this.startSpeechRecognition();
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.audio) {
            this.callbacks.onStatusChange?.('speaking');
            this.playAudioChunk(msg.audio);
          }

          if (msg.interrupted) {
            this.stopPlayback();
            this.callbacks.onStatusChange?.('listening');
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

            // Send tool response back
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
          console.error('Error processing Live message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Gemini Live WebSocket error:', err);
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
      this.inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.sourceNode.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const float32Data = e.inputBuffer.getChannelData(0);
        const pcm16Data = this.convertFloat32ToPCM16(float32Data);
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

  private startSpeechRecognition(): void {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      console.log('[GeminiLive] Native SpeechRecognition not available in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      // Select language based on user preference (Section 8.8)
      const prefLang = useSettingsStore.getState().preferredLanguage;
      this.recognition.lang = prefLang === 'en' ? 'en-US' : 'ta-IN';

      this.recognition.onresult = (event: any) => {
        if (!this.isRunning || this.isMuted) return;
        const results = event.results;
        if (!results || results.length === 0) return;

        const lastResult = results[results.length - 1];
        const transcript = lastResult?.[0]?.transcript?.trim();

        if (transcript && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[GeminiLive] Live voice detected:', transcript);
          this.ws.send(
            JSON.stringify({
              type: 'userSpeech',
              text: transcript,
            })
          );
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[GeminiLive] Speech recognition warning:', e.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart recognition if still running and not speaking
        if (this.isRunning && !this.isMuted && this.activeSources.length === 0) {
          try {
            this.recognition?.start();
          } catch {
            // Ignore if already started
          }
        }
      };

      this.recognition.start();
    } catch (e) {
      console.warn('[GeminiLive] Failed to start continuous SpeechRecognition:', e);
    }
  }

  private playAudioChunk(base64Audio: string): void {
    if (!this.outputAudioCtx) {
      this.outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume();
    }

    // Temporarily pause speech recognition while Gemini is speaking to prevent echo
    try {
      this.recognition?.stop();
    } catch {}

    const pcmData = this.base64ToPCM16(base64Audio);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768;
    }

    const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioCtx.destination);

    const startTime = Math.max(this.outputAudioCtx.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      if (this.activeSources.length === 0) {
        this.callbacks.onStatusChange?.('listening');
        // Resume listening after speech finishes
        if (this.isRunning && !this.isMuted) {
          try {
            this.recognition?.start();
          } catch {}
        }
      }
    };
  }

  private stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore stopped sources
      }
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted) {
      try {
        this.recognition?.stop();
      } catch {}
    } else if (this.isRunning && this.activeSources.length === 0) {
      try {
        this.recognition?.start();
      } catch {}
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.callbacks.onStatusChange?.('disconnected');
  }

  private cleanup(): void {
    this.isRunning = false;
    this.stopPlayback();

    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition.onend = null;
      } catch {}
      this.recognition = null;
    }

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
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}
