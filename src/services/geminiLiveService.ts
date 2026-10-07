import { MicrophoneProcessor } from '../audio/microphoneProcessor';
import { AudioPlayback } from '../audio/audioPlayback';
import {
  LiveVoiceState,
  LiveVoiceError,
  LivePlantContext,
  LiveSessionConfig,
  LiveServiceCallbacks,
} from '../types/liveVoice';
import { executePlantToolCall } from '../lib/plant/realtime-tools';
import {
  PLANT_LIVE_TOOLS,
  DEFAULT_GEMINI_FEMALE_VOICE,
  resolveLiveModel,
} from '../lib/plant/realtime-config';
import { PLANT_LIVE_SYSTEM_INSTRUCTION } from '../lib/plant/prompts';
import { useSettingsStore } from '../stores/plant/settings-store';
import { useSensorsStore } from '../stores/plant/sensors-store';
import { useObserverStore } from '../stores/plant/observer-store';
import { useCameraStore } from '../stores/plant/camera-store';
import { useApiUsageStore } from '../stores/plant/api-usage-store';
import { DEFAULT_PLANT_PROFILE } from '../lib/plant/plants';

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

/**
 * Get current real-time plant and sensor snapshot for Gemini context
 */
export function getCurrentPlantContext(): LivePlantContext {
  const sensors = useSensorsStore.getState().readings;
  const isEspConnected = useSensorsStore.getState().isEspConnected;
  const isCameraActive = useCameraStore.getState().isActive;
  const lastAnalysis = useObserverStore.getState().lastAnalysis;
  const mainPlant =
    lastAnalysis?.plants?.find((p) => p.role === 'main') || lastAnalysis?.plants?.[0];
  const observation = useObserverStore.getState().currentObservation;

  return {
    plantName: mainPlant?.displayName || mainPlant?.commonName || DEFAULT_PLANT_PROFILE.name,
    species: mainPlant?.scientificName || DEFAULT_PLANT_PROFILE.species,
    soilMoisture: sensors.moisture !== undefined ? Math.round(sensors.moisture) : undefined,
    lightIntensity: sensors.light !== undefined ? Math.round(sensors.light) : undefined,
    temperature: sensors.temperature !== undefined ? Math.round(sensors.temperature) : undefined,
    humidity: sensors.humidity !== undefined ? Math.round(sensors.humidity) : undefined,
    co2: sensors.co2 !== undefined ? Math.round(sensors.co2) : undefined,
    plantHealth: observation?.healthStatus || mainPlant?.visibleCondition || 'Good',
    cameraStatus: isCameraActive,
    arduinoStatus: isEspConnected,
    flowerStatus: mainPlant?.flowers?.status || 'not-visible',
  };
}

/**
 * GeminiLiveService
 * Manages full lifecycle of real-time Gemini Live voice session:
 * microphone capture, PCM streaming, WebSocket transport, scheduled audio playback,
 * input/output transcriptions, barge-in / interruption, plant telemetry integration.
 */
export class GeminiLiveService {
  private static instance: GeminiLiveService | null = null;

  private microphone: MicrophoneProcessor;
  private audioPlayback: AudioPlayback;

  private ws: WebSocket | null = null;
  private state: LiveVoiceState = 'idle';
  private generation = 0;
  private isDirectGoogleMode = false;
  private cancelPending: (() => void) | null = null;

  private userTranscript = '';
  private plantTranscript = '';

  private callbacks: LiveServiceCallbacks = {};

  private constructor() {
    this.microphone = new MicrophoneProcessor();
    this.audioPlayback = new AudioPlayback((isPlaying) => {
      if (this.state === 'listening' && isPlaying) {
        this.setState('speaking');
      } else if (this.state === 'speaking' && !isPlaying) {
        this.setState('listening');
      }
    });
  }

  public static getInstance(): GeminiLiveService {
    if (!GeminiLiveService.instance) {
      GeminiLiveService.instance = new GeminiLiveService();
    }
    return GeminiLiveService.instance;
  }

  public setCallbacks(callbacks: LiveServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getState(): LiveVoiceState {
    return this.state;
  }

  public isLiveActive(): boolean {
    return (
      this.state === 'connecting' ||
      this.state === 'listening' ||
      this.state === 'speaking'
    );
  }

  private setState(state: LiveVoiceState, errorMsg?: string): void {
    this.state = state;
    this.callbacks.onStateChange?.(state, errorMsg);
  }

  /**
   * Connect to Gemini Live session.
   * State Machine: IDLE -> CONNECTING -> LISTENING
   */
  public async connect(overrideConfig?: Partial<LiveSessionConfig>): Promise<void> {
    // Prevent duplicate sessions
    if (this.isLiveActive() || this.state === 'stopping') {
      return;
    }

    const currentGen = ++this.generation;
    this.setState('connecting');

    try {
      // 1. Resume AudioContext before waiting on async tasks
      await this.audioPlayback.ensureAudioContext();

      // 2. Request microphone and begin continuous capture
      await this.microphone.start((pcm16Chunk, mimeType) => {
        if (currentGen !== this.generation || this.state === 'stopping' || this.state === 'idle') {
          return;
        }

        // If audio is currently playing and user starts speaking, trigger client-side barge-in
        if (this.audioPlayback.getIsPlaying()) {
          this.audioPlayback.stop();
          this.setState('listening');
        }

        this.sendAudioChunk(pcm16Chunk, mimeType);
      });

      if (currentGen !== this.generation) {
        this.microphone.stop();
        return;
      }

      // 3. Resolve Authentication & Connection Route
      const { apiKey, preferredLanguage, geminiLiveModel } = useSettingsStore.getState();
      const userKey = (overrideConfig?.apiKey || apiKey || '').trim();

      let targetUrl = '';
      let ephemeralToken: string | null = null;

      if (userKey) {
        // Direct developer key mode
        this.isDirectGoogleMode = true;
        targetUrl =
          'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' +
          encodeURIComponent(userKey);
      } else {
        // Try obtaining short-lived ephemeral token from backend
        try {
          const resp = await fetch('/api/live-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.token) {
              ephemeralToken = data.token;
            }
          }
        } catch {
          // Backend token endpoint error; fallback to websocket proxy
        }

        if (ephemeralToken) {
          this.isDirectGoogleMode = true;
          targetUrl =
            'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=' +
            encodeURIComponent(ephemeralToken);
        } else {
          // Connect via backend WebSocket relay
          this.isDirectGoogleMode = false;
          const host = window.location.host;
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          targetUrl = `${protocol}//${host}/api/live?lang=${preferredLanguage || 'mixed'}`;
        }
      }

      // 4. Establish WebSocket session
      await this.openSocket(targetUrl, currentGen, geminiLiveModel, preferredLanguage);
    } catch (err: any) {
      if (currentGen !== this.generation) return;
      this.cleanup();
      const errorObj: LiveVoiceError = err?.code
        ? err
        : {
            code: 'NETWORK_ERROR',
            message: err?.message || 'Unable to connect to Plant Talk voice service.',
            originalError: err,
          };
      this.callbacks.onError?.(errorObj);
      this.setState('error', errorObj.message);
    }
  }

  /**
   * Build the Gemini Live Setup payload for direct Google connections
   */
  private buildDirectSetupPayload(geminiLiveModel?: string, preferredLang?: string) {
    const model =
      import.meta.env.VITE_GEMINI_LIVE_MODEL ||
      geminiLiveModel ||
      'gemini-2.0-flash-live-001';

    const plantContext = getCurrentPlantContext();
    const plantContextStr = `
Current plant information:
- Plant: ${plantContext.plantName}
- Species: ${plantContext.species}
- Soil moisture: ${plantContext.soilMoisture !== undefined ? plantContext.soilMoisture + '%' : 'Unavailable'}
- Light intensity: ${plantContext.lightIntensity !== undefined ? plantContext.lightIntensity + '%' : 'Unavailable'}
- Temperature: ${plantContext.temperature !== undefined ? plantContext.temperature + '°C' : 'Unavailable'}
- Humidity: ${plantContext.humidity !== undefined ? plantContext.humidity + '%' : 'Unavailable'}
- Overall Health: ${plantContext.plantHealth || 'Good'}
- Camera Status: ${plantContext.cameraStatus ? 'Active' : 'Offline'}
- Hardware/Arduino Status: ${plantContext.arduinoStatus ? 'Connected' : 'Simulated'}
`;

    const systemPrompt =
      PLANT_LIVE_SYSTEM_INSTRUCTION +
      '\n\n' +
      plantContextStr +
      '\nPreferred language: ' +
      (preferredLang || 'mixed') +
      '. Wait for the caregiver to speak, then reply naturally and briefly in their language.';

    return {
      setup: {
        model: 'models/' + resolveLiveModel(model),
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: DEFAULT_GEMINI_FEMALE_VOICE },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: PLANT_LIVE_TOOLS }],
      },
    };
  }

  /**
   * Open WebSocket and orchestrate real-time stream
   */
  private openSocket(
    url: string,
    generation: number,
    geminiLiveModel?: string,
    preferredLang?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      let ready = false;
      let settled = false;

      const timer = setTimeout(() => {
        end(new Error('Gemini Live did not become ready. Check your connection, then try again.'));
      }, 15000);

      const end = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelPending = null;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      this.cancelPending = () => end(new Error('Connection cancelled.'));

      ws.onopen = () => {
        if (this.ws === ws && this.isDirectGoogleMode) {
          const setupMsg = this.buildDirectSetupPayload(geminiLiveModel, preferredLang);
          ws.send(JSON.stringify(setupMsg));
        }
      };

      let messageQueue = Promise.resolve();

      ws.onmessage = (event) => {
        messageQueue = messageQueue
          .then(async () => {
            if (this.ws !== ws || (settled && !ready)) return;

            const raw =
              typeof event.data === 'string'
                ? event.data
                : event.data instanceof Blob
                ? await event.data.text()
                : new TextDecoder().decode(event.data);

            if (this.ws !== ws) return;

            const msg = JSON.parse(raw);

            if (msg.error) {
              const errMsg =
                typeof msg.error === 'string'
                  ? msg.error
                  : msg.error.message || 'Gemini Live rejected the connection.';
              if (ready) {
                this.handleError(errMsg);
              } else {
                end(new Error(errMsg));
              }
              return;
            }

            const handshake = this.isDirectGoogleMode
              ? msg.setupComplete
              : msg.status === 'listening';

            if (!ready && handshake) {
              ready = true;
              this.setState('listening');
              useApiUsageStore
                .getState()
                .recordApiCall(
                  'live',
                  this.isDirectGoogleMode ? 'Gemini Live' : '/api/live',
                  'success'
                );
              end();
            }

            if (ready) {
              await this.handleMessage(msg, ws);
            }
          })
          .catch(() => {
            if (this.ws === ws) {
              this.handleError('Unable to process Gemini Live audio. Please try again.');
            }
          });
      };

      ws.onerror = () => {
        const errorMsg = this.isDirectGoogleMode
          ? 'Unable to connect to Gemini Live. Check your network and Gemini API key.'
          : 'Live server unavailable. Tap Start Speak to reconnect.';
        if (ready) {
          this.handleError(errorMsg);
        } else {
          end(new Error(errorMsg));
        }
      };

      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        if (!ready || event.code !== 1000) {
          const reason =
            event.reason ||
            'Gemini Live disconnected. Check your API key, model access and quota.';
          if (ready) {
            this.handleError(reason);
          } else {
            end(new Error(reason));
          }
        } else {
          this.flushTranscripts();
          this.cleanup();
          this.setState('idle');
        }
      };
    });
  }

  /**
   * Handle incoming streaming messages from Gemini Live
   */
  private async handleMessage(msg: any, ws: WebSocket): Promise<void> {
    const content = msg.serverContent;

    // 1. Barge-in / Interruption handling
    if (content?.interrupted || msg.interrupted) {
      this.audioPlayback.stop();
      this.flushTranscripts();
      this.setState('listening');
      this.callbacks.onInterruption?.();
      return;
    }

    // 2. Input Transcription (User voice streaming)
    if (content?.inputTranscription?.text || msg.userTranscript) {
      const textChunk = content?.inputTranscription?.text || msg.userTranscript || '';
      this.userTranscript += textChunk;
      const isFinished = !!content?.inputTranscription?.finished;
      const lang = detectSpokenLanguage(this.userTranscript);
      this.callbacks.onUserTranscript?.(this.userTranscript, isFinished, lang);
      if (isFinished) {
        this.userTranscript = '';
      }
    }

    // 3. Output Transcription (Gemini response streaming)
    if (content?.outputTranscription?.text || msg.plantTranscriptPartial) {
      const plantChunk = content?.outputTranscription?.text || msg.plantTranscriptPartial || '';
      this.plantTranscript += plantChunk;
      const lang = detectSpokenLanguage(this.plantTranscript);
      this.callbacks.onAssistantTranscript?.(this.plantTranscript, false, lang);
    }

    // 4. Gemini Audio Playback
    for (const part of content?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
        this.flushTranscript('user');
        await this.audioPlayback.playChunk(part.inlineData.data);
      }
    }

    if (msg.audio) {
      this.flushTranscript('user');
      await this.audioPlayback.playChunk(msg.audio);
    }

    // 5. Turn Complete
    if (content?.turnComplete || msg.turnComplete) {
      this.flushTranscripts();
      if (!this.audioPlayback.getIsPlaying()) {
        this.setState('listening');
      }
    }

    // 6. Function / Tool Calls
    const calls = msg.toolCall?.functionCalls || (msg.toolCall?.id ? [msg.toolCall] : []);
    for (const call of calls) {
      const result = await executePlantToolCall(call.name, call.args || {});
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;

      this.callbacks.onToolCall?.(call.name, call.args || {}, result);

      const responsePayload = this.isDirectGoogleMode
        ? {
            toolResponse: {
              functionResponses: [
                {
                  id: call.id,
                  name: call.name,
                  response: { output: result },
                },
              ],
            },
          }
        : {
            type: 'toolResponse',
            id: call.id,
            name: call.name,
            result,
          };

      ws.send(JSON.stringify(responsePayload));
    }
  }

  /**
   * Send microphone PCM chunks to Gemini Live
   */
  private sendAudioChunk(pcmBuffer: ArrayBuffer, mimeType: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state === 'idle') {
      return;
    }

    const base64 = this.arrayBufferToBase64(pcmBuffer);

    if (this.isDirectGoogleMode) {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64,
              mimeType,
            },
          },
        })
      );
    } else {
      this.ws.send(
        JSON.stringify({
          type: 'audio',
          audio: base64,
          mimeType,
        })
      );
    }

    this.callbacks.onAudioChunk?.(pcmBuffer);
  }

  private flushTranscript(sender: 'user' | 'plant'): void {
    const text = (sender === 'user' ? this.userTranscript : this.plantTranscript).trim();
    if (sender === 'user') {
      this.userTranscript = '';
    } else {
      this.plantTranscript = '';
    }
    if (text) {
      const lang = detectSpokenLanguage(text);
      if (sender === 'user') {
        this.callbacks.onUserTranscript?.(text, true, lang);
      } else {
        this.callbacks.onAssistantTranscript?.(text, true, lang);
      }
    }
  }

  private flushTranscripts(): void {
    this.flushTranscript('user');
    this.flushTranscript('plant');
  }

  /**
   * Interrupt Gemini audio playback
   */
  public interrupt(): void {
    this.audioPlayback.stop();
    if (this.state === 'speaking') {
      this.setState('listening');
    }
    this.callbacks.onInterruption?.();
  }

  /**
   * Mute / unmute microphone
   */
  public setMuted(muted: boolean): void {
    this.microphone.setMuted(muted);
    if (muted && this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.isDirectGoogleMode) {
        this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } else {
        this.ws.send(JSON.stringify({ type: 'audioStreamEnd' }));
      }
    }
  }

  /**
   * Cleanly disconnect the voice session.
   * State Machine: LISTENING / SPEAKING -> STOPPING -> IDLE
   */
  public disconnect(): void {
    if (this.state === 'idle') return;

    this.setState('stopping');
    this.flushTranscripts();
    this.cleanup();
    this.setState('idle');
  }

  private handleError(message: string): void {
    this.cleanup();
    const errorObj: LiveVoiceError = {
      code: 'NETWORK_ERROR',
      message,
    };
    this.callbacks.onError?.(errorObj);
    this.setState('error', message);
  }

  private cleanup(): void {
    ++this.generation;
    this.cancelPending?.();
    this.cancelPending = null;

    this.microphone.stop();
    this.audioPlayback.stop();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.userTranscript = '';
    this.plantTranscript = '';
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

export const geminiLiveService = GeminiLiveService.getInstance();
