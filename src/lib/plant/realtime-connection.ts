import { executePlantToolCall } from './realtime-tools';
import { PLANT_LIVE_TOOLS, DEFAULT_GEMINI_FEMALE_VOICE, resolveLiveModel } from './realtime-config';
import { PLANT_LIVE_SYSTEM_INSTRUCTION } from './prompts';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';
import { LiveSessionStatus } from '../../types';

export interface LiveConnectionCallbacks {
  onStatusChange?: (status: LiveSessionStatus, errorMsg?: string) => void;
  onTranscript?: (text: string, sender: 'user' | 'plant', language?: 'en' | 'ta' | 'mixed') => void;
  onStreamingTranscript?: (text: string, sender: 'user' | 'plant', isFinal: boolean, language?: 'en' | 'ta' | 'mixed') => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
}

export function detectSpokenLanguage(text: string): 'ta' | 'en' | 'mixed' {
  if (!text) return 'en';
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const tanglishRegex =
    /\b(inniku|iniku|innaiku|eppadi|epdi|irukku|irukanga|irukka|enna|panra|pandringa|thanni|thannir|tannir|kuduthacha|venuma|indha|inda|vanakkam|chedi|ilai|ilaigal|romba|konjam|adade|apdiya|solla|sollunga|teriyuma|theriyuma|pandra|vanga|ponga|tamil|tamil-la|tamil-le|tamilil|nandri|enakku|ungalukku|nalla|pesu|pesunga|kudu|oothe)\b/i;
  const hasTanglish = tanglishRegex.test(text);

  if (hasTamil && /[a-zA-Z]/.test(text)) return 'mixed';
  if (hasTamil || hasTanglish) return 'ta';
  return 'en';
}

/** Streams microphone PCM to Gemini and plays its native audio replies. */
export class GeminiLiveConnection {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private silenceGain: GainNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private isMuted = false;
  private isRunning = false;
  private isConnecting = false;
  private isDirectGoogleMode = false;
  private generation = 0;
  private cancelPending: (() => void) | null = null;
  private userTranscript = '';
  private plantTranscript = '';

  constructor(private callbacks: LiveConnectionCallbacks = {}) {}

  public async connect(): Promise<void> {
    if (this.isRunning || this.isConnecting) return;
    const generation = ++this.generation;
    this.isConnecting = true;
    this.callbacks.onStatusChange?.('connecting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access requires HTTPS and a supported browser.');
      }
      // Resume during the button gesture, before waiting for permission/network.
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      const audioReady = Promise.all([this.inputAudioCtx.resume(), this.outputAudioCtx.resume()]);
      // Observe errors immediately even if the permission dialog stays open.
      void audioReady.catch(() => {});
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        }});
      } catch {
        throw new Error('Microphone permission is required for Live Speaking.');
      }
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.mediaStream = stream;
      stream.getAudioTracks().forEach(track => { track.enabled = !this.isMuted; });
      await audioReady;
      if (generation !== this.generation) return;

      const { apiKey, preferredLanguage } = useSettingsStore.getState();
      // Firebase Hosting has no WebSocket backend. The existing setup screen
      // supplies the user's own key, so connect straight to Google in that case.
      this.isDirectGoogleMode = !!apiKey?.trim();
      const url = this.isDirectGoogleMode
        ? 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(apiKey.trim())
        : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/api/live?lang=' + preferredLanguage;
      await this.openSocket(url);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error instanceof Error ? error.message : 'Unable to start Live Speaking.');
    }
  }

  private directSetup() {
    const { geminiLiveModel, preferredLanguage } = useSettingsStore.getState();
    const s = useSensorsStore.getState().readings;
    const sensorContext = '\nCurrent readings: ' + JSON.stringify(s);
    return { setup: {
      model: 'models/' + resolveLiveModel(import.meta.env.VITE_GEMINI_LIVE_MODEL || geminiLiveModel),
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: DEFAULT_GEMINI_FEMALE_VOICE } } },
      },
      systemInstruction: { parts: [{ text: PLANT_LIVE_SYSTEM_INSTRUCTION + sensorContext +
        '\nPreferred language: ' + preferredLanguage + '. Wait for the caregiver to speak; then reply naturally in their language.' }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: PLANT_LIVE_TOOLS }],
    }};
  }

  private openSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      let ready = false;
      let settled = false;
      const timer = setTimeout(() => end(new Error('Gemini Live did not become ready. Check your connection and API key, then try again.')), 15000);
      const end = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelPending = null;
        if (error) reject(error); else resolve();
      };
      this.cancelPending = () => end(new Error('Connection cancelled.'));
      const socketError = (message: string) => {
        if (ready) this.fail(message); else end(new Error(message));
      };
      ws.onopen = () => {
        if (this.ws === ws && this.isDirectGoogleMode) ws.send(JSON.stringify(this.directSetup()));
      };
      // Binary WebSocket frames are ArrayBuffers (or Blobs in some browsers).
      // Decode and process in order so slow Blob reads cannot reorder turns.
      let messages = Promise.resolve();
      ws.onmessage = event => {
        messages = messages.then(async () => {
          if (this.ws !== ws || (settled && !ready)) return;
          const raw = typeof event.data === 'string' ? event.data
            : event.data instanceof Blob ? await event.data.text()
            : new TextDecoder().decode(event.data);
          if (this.ws !== ws) return;
          const msg = JSON.parse(raw);
          if (msg.error) {
            socketError(typeof msg.error === 'string' ? msg.error : msg.error.message || 'Gemini Live rejected the connection.');
            return;
          }
          const handshake = this.isDirectGoogleMode ? msg.setupComplete : msg.status === 'listening';
          if (!ready && handshake) {
            this.startAudioProcessing();
            ready = true;
            this.isRunning = true;
            this.isConnecting = false;
            this.callbacks.onStatusChange?.('listening');
            useApiUsageStore.getState().recordApiCall('live', this.isDirectGoogleMode ? 'Gemini Live' : '/api/live', 'success');
            end();
          }
          if (ready) await this.handleMessage(msg, ws);
        }).catch(() => {
          if (this.ws === ws) socketError('Unable to process Gemini Live audio. Please try again.');
        });
      };
      ws.onerror = () => socketError(this.isDirectGoogleMode
        ? 'Unable to connect to Gemini Live. Check your network and Gemini API key.'
        : 'Live server unavailable. Connect your Gemini API key on the setup screen and try again.');
      ws.onclose = event => {
        if (this.ws !== ws) return;
        if (!ready || event.code !== 1000) {
          socketError(event.reason || 'Gemini Live disconnected. Check your API key, model access and quota, then try again.');
        } else {
          this.flushTranscripts();
          this.cleanup();
          this.callbacks.onStatusChange?.('disconnected');
        }
      };
    });
  }

  private async handleMessage(msg: any, ws: WebSocket): Promise<void> {
    const content = msg.serverContent;
    if (content?.interrupted || msg.interrupted) {
      this.stopPlayback();
      this.flushTranscripts();
      this.callbacks.onStatusChange?.('listening');
    }
    this.userTranscript += content?.inputTranscription?.text || msg.userTranscript || '';
    if (this.userTranscript) {
      this.callbacks.onStreamingTranscript?.(
        this.userTranscript,
        'user',
        !!content?.inputTranscription?.finished,
        detectSpokenLanguage(this.userTranscript)
      );
    }
    this.plantTranscript += content?.outputTranscription?.text || msg.plantTranscriptPartial || '';
    if (this.plantTranscript) {
      this.callbacks.onStreamingTranscript?.(
        this.plantTranscript,
        'plant',
        false,
        detectSpokenLanguage(this.plantTranscript)
      );
    }
    if (content?.inputTranscription?.finished) this.flushTranscript('user');
    for (const part of content?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
        this.flushTranscript('user');
        this.playAudioChunk(part.inlineData.data);
      }
    }
    if (msg.audio) {
      this.flushTranscript('user');
      this.playAudioChunk(msg.audio);
    }
    if (content?.turnComplete || msg.turnComplete) {
      this.flushTranscripts();
      if (!this.activeSources.length) this.callbacks.onStatusChange?.('listening');
    }
    const calls = msg.toolCall?.functionCalls || (msg.toolCall?.id ? [msg.toolCall] : []);
    for (const call of calls) {
      const result = await executePlantToolCall(call.name, call.args || {});
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
      this.callbacks.onToolCall?.(call.name, call.args || {}, result);
      ws.send(JSON.stringify(this.isDirectGoogleMode
        ? { toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { output: result } }] } }
        : { type: 'toolResponse', id: call.id, name: call.name, result }));
    }
  }

  private flushTranscript(sender: 'user' | 'plant'): void {
    const text = (sender === 'user' ? this.userTranscript : this.plantTranscript).trim();
    if (sender === 'user') this.userTranscript = ''; else this.plantTranscript = '';
    if (text) {
      const lang = detectSpokenLanguage(text);
      this.callbacks.onStreamingTranscript?.(text, sender, true, lang);
      this.callbacks.onTranscript?.(text, sender, lang);
    }
  }

  private flushTranscripts(): void {
    this.flushTranscript('user');
    this.flushTranscript('plant');
  }

  private startAudioProcessing(): void {
    if (!this.mediaStream || !this.inputAudioCtx) throw new Error('Microphone unavailable.');
    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
    this.silenceGain = this.inputAudioCtx.createGain();
    this.silenceGain.gain.value = 0;
    this.sourceNode.connect(this.processor);
    this.processor.connect(this.silenceGain);
    this.silenceGain.connect(this.inputAudioCtx.destination);
    this.processor.onaudioprocess = event => {
      if (!this.isRunning || this.isMuted || this.ws?.readyState !== WebSocket.OPEN) return;
      const data = this.arrayBufferToBase64(this.convertFloat32ToPCM16(event.inputBuffer.getChannelData(0)));
      // Declare the actual AudioContext rate, including browsers using a
      // hardware rate other than the requested 16 kHz. Gemini resamples it.
      const mimeType = 'audio/pcm;rate=' + this.inputAudioCtx!.sampleRate;
      this.ws.send(JSON.stringify(this.isDirectGoogleMode
        ? { realtimeInput: { audio: { data, mimeType } } }
        : { type: 'audio', audio: data, mimeType }));
    };
    // Gemini's native VAD handles barge-in. A second browser recognizer or
    // local loudness threshold mistakes speaker echo for user interruptions.
  }

  private playAudioChunk(base64: string): void {
    const context = this.outputAudioCtx;
    if (!context || !this.isRunning) return;
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, Math.floor(bytes.length / 2), 24000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.activeSources.push(source);
    source.onended = () => {
      source.disconnect();
      this.activeSources = this.activeSources.filter(item => item !== source);
      if (!this.activeSources.length && this.isRunning) this.callbacks.onStatusChange?.('listening');
    };
    const start = Math.max(context.currentTime, this.nextStartTime);
    source.start(start);
    this.nextStartTime = start + buffer.duration;
    this.callbacks.onStatusChange?.('speaking');
  }

  public interrupt(): void {
    this.stopPlayback();
    if (this.isRunning) this.callbacks.onStatusChange?.('listening');
  }

  private stopPlayback(): void {
    for (const source of this.activeSources) {
      source.onended = null;
      try { source.stop(); source.disconnect(); } catch {}
    }
    this.activeSources = [];
    this.nextStartTime = this.outputAudioCtx?.currentTime || 0;
  }

  public setMuted(muted: boolean): void {
    if (muted && !this.isMuted && this.isRunning && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(this.isDirectGoogleMode
        ? { realtimeInput: { audioStreamEnd: true } } : { type: 'audioStreamEnd' }));
    }
    this.isMuted = muted;
    this.mediaStream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
  }

  public disconnect(): void {
    this.flushTranscripts();
    this.cleanup();
    this.callbacks.onStatusChange?.('disconnected');
  }

  private fail(message: string): void {
    this.cleanup();
    this.callbacks.onStatusChange?.('error', message);
  }

  private cleanup(): void {
    ++this.generation;
    this.isRunning = false;
    this.isConnecting = false;
    this.cancelPending?.();
    this.cancelPending = null;
    this.stopPlayback();
    if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); }
    this.processor = null;
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.silenceGain?.disconnect();
    this.silenceGain = null;
    void this.inputAudioCtx?.close().catch(() => {});
    void this.outputAudioCtx?.close().catch(() => {});
    this.inputAudioCtx = null;
    this.outputAudioCtx = null;
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.userTranscript = this.plantTranscript = '';
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
}
