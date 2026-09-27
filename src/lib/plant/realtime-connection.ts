import { executePlantToolCall } from './realtime-tools';
import { PLANT_LIVE_TOOLS } from './realtime-config';
import { PLANT_LIVE_SYSTEM_INSTRUCTION } from './prompts';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';
import { LiveSessionStatus } from '../../types';

export interface LiveConnectionCallbacks {
  onStatusChange?: (
    status: LiveSessionStatus,
    errorMsg?: string
  ) => void;
  onTranscript?: (text: string, sender: 'user' | 'plant', language?: 'en' | 'ta' | 'mixed') => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
}

/**
 * Intelligent language detection supporting Tamil script, Tanglish keywords, mixed, and English.
 */
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
 * GeminiLiveConnection
 *
 * Implements true bidirectional real-time audio communication with Gemini Live.
 * - Captures 16kHz PCM audio from browser microphone.
 * - Streams audio directly to Gemini Live session.
 * - Receives and plays 24kHz PCM audio chunks via HTML5 Web Audio API.
 * - Understands Tamil, English, and Tanglish natively with female Aoede voice.
 * - Supports instant barge-in interruption and tool execution.
 * - Connects via local server proxy (/api/live) or direct Google AI Studio WebSocket.
 */
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
  private isConnecting: boolean = false;
  private isDirectGoogleMode: boolean = false;
  private callbacks: LiveConnectionCallbacks = {};

  constructor(callbacks: LiveConnectionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    if (this.isRunning || this.isConnecting) return;
    this.isConnecting = true;

    console.log('[PlantTalk Live] Initializing');
    this.callbacks.onStatusChange?.('connecting');

    // 1. Request microphone permission
    console.log('[PlantTalk Live] Requesting microphone');
    try {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      console.log('[PlantTalk Live] Microphone granted');
    } catch (micErr: any) {
      console.warn('[PlantTalk Live] Microphone access denied or unavailable:', micErr);
      this.isConnecting = false;
      this.callbacks.onStatusChange?.('error', 'Microphone permission is required for Live Speaking.');
      this.cleanup();
      return;
    }

    // 2. Initialize Web Audio Contexts
    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      this.nextStartTime = this.outputAudioCtx.currentTime;
    } catch (audioInitErr) {
      console.warn('[PlantTalk Live] AudioContext initialization failed:', audioInitErr);
      this.isConnecting = false;
      this.callbacks.onStatusChange?.('error', 'Unable to initialize audio. Please try again.');
      this.cleanup();
      return;
    }

    // 3. Connect WebSocket (Try server proxy /api/live first, fallback to direct Google Gemini Live)
    const { apiKey, preferredLanguage } = useSettingsStore.getState();
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const activeApiKey = apiKey || envKey;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const serverProxyUrl = `${protocol}//${window.location.host}/api/live${
      activeApiKey ? `?key=${encodeURIComponent(activeApiKey)}&lang=${preferredLanguage || 'mixed'}` : ''
    }`;

    console.log('[PlantTalk Live] Connecting to Gemini');

    try {
      await this.connectWithFallback(serverProxyUrl, activeApiKey);
    } catch (connErr: any) {
      console.error('[PlantTalk Live] Connection error:', connErr);
      this.isConnecting = false;
      this.callbacks.onStatusChange?.('error', connErr?.message || 'Unable to connect to Gemini Live. Please try again.');
      this.cleanup();
    }
  }

  /**
   * Attempt connection to local server proxy, falling back to direct Google Live API
   */
  private connectWithFallback(proxyUrl: string, apiKey: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      // Timeout for proxy attempt before falling back to direct Google Live API
      const proxyTimeout = setTimeout(() => {
        if (!resolved && !this.isRunning) {
          console.warn('[PlantTalk Live] Proxy timeout. Switching to Direct Google Live WebSocket.');
          tryConnectDirect();
        }
      }, 1500);

      const tryConnectDirect = () => {
        clearTimeout(proxyTimeout);
        if (this.ws) {
          try {
            this.ws.onopen = null;
            this.ws.onerror = null;
            this.ws.onclose = null;
            this.ws.close();
          } catch {}
          this.ws = null;
        }

        if (!apiKey) {
          if (!resolved) {
            resolved = true;
            reject(new Error('Please configure your Gemini API Key in Settings to start Live Speaking.'));
          }
          return;
        }

        this.isDirectGoogleMode = true;
        const googleUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        try {
          this.ws = new WebSocket(googleUrl);
          this.setupDirectSocketHandlers(resolve, reject);
        } catch (err) {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        }
      };

      try {
        this.ws = new WebSocket(proxyUrl);
        this.isDirectGoogleMode = false;

        this.ws.onopen = () => {
          clearTimeout(proxyTimeout);
          if (resolved) return;
          resolved = true;
          this.isRunning = true;
          this.isConnecting = false;
          console.log('[PlantTalk Live] Connected via server proxy');
          this.callbacks.onStatusChange?.('listening');
          useApiUsageStore.getState().recordApiCall('live', '/api/live', 'success');
          this.startAudioProcessing();
          this.startPassiveSpeechObserver();
          resolve();
        };

        this.ws.onmessage = async (event) => {
          this.handleServerProxyMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.warn('[PlantTalk Live] Proxy error, switching to direct mode:', err);
          tryConnectDirect();
        };

        this.ws.onclose = () => {
          if (!resolved) {
            tryConnectDirect();
          } else if (this.isRunning) {
            console.log('[PlantTalk Live] Proxy disconnected');
            this.callbacks.onStatusChange?.('disconnected');
            this.cleanup();
          }
        };
      } catch (err) {
        tryConnectDirect();
      }
    });
  }

  /**
   * Set up message & lifecycle handlers for Direct Google Gemini Live WebSocket
   */
  private setupDirectSocketHandlers(resolve: () => void, reject: (err: any) => void): void {
    if (!this.ws) return;

    let hasHandshaked = false;

    this.ws.onopen = () => {
      console.log('[PlantTalk Live] Direct WebSocket open. Sending setup handshake...');

      const sensors = useSensorsStore.getState().readings;
      const sensorContext = `\nREAL-TIME SENSORS RIGHT NOW: Soil Moisture: ${Math.round(
        sensors.moisture || 58
      )}%, Light: ${Math.round(sensors.light || 65)}%, Temp: ${Math.round(
        sensors.temperature || 26
      )}°C, Humidity: ${Math.round(sensors.humidity || 62)}%`;
      const liveSystemPrompt = `${PLANT_LIVE_SYSTEM_INSTRUCTION}${sensorContext}`;

      // Gemini Multimodal Live Setup Handshake
      const setupMsg = {
        setup: {
          model: 'models/gemini-3.8-live',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede',
                },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: liveSystemPrompt }],
          },
          tools: [
            {
              functionDeclarations: PLANT_LIVE_TOOLS,
            },
          ],
        },
      };

      this.ws?.send(JSON.stringify(setupMsg));
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Handshake complete
        if (msg.setupComplete) {
          console.log('[PlantTalk Live] Setup complete from Gemini Live');
          if (!hasHandshaked) {
            hasHandshaked = true;
            this.isRunning = true;
            this.isConnecting = false;
            this.callbacks.onStatusChange?.('listening');
            this.startAudioProcessing();
            this.startPassiveSpeechObserver();
            resolve();
          }
          return;
        }

        // Real-time server content from Gemini
        if (msg.serverContent) {
          if (msg.serverContent.interrupted) {
            console.log('[PlantTalk Live] Gemini signaled speech interruption');
            this.stopPlayback();
            this.callbacks.onStatusChange?.('listening');
          }

          const parts = msg.serverContent.modelTurn?.parts || [];
          for (const p of parts) {
            if (p.inlineData?.data) {
              this.callbacks.onStatusChange?.('speaking');
              this.playAudioChunk(p.inlineData.data);
            }
            if (p.text) {
              const lang = detectSpokenLanguage(p.text);
              this.callbacks.onTranscript?.(p.text, 'plant', lang);
            }
          }

          if (msg.serverContent.turnComplete) {
            // When all scheduled audio chunks finish playing, state resets to listening
            if (this.activeSources.length === 0) {
              this.callbacks.onStatusChange?.('listening');
            }
          }
        }

        // Function call / Botanical Tool execution
        if (msg.toolCall) {
          const calls = msg.toolCall.functionCalls || [];
          const responses = [];
          for (const call of calls) {
            const result = await executePlantToolCall(call.name, call.args || {});
            responses.push({
              name: call.name,
              response: { output: result },
              id: call.id,
            });
            this.callbacks.onToolCall?.(call.name, call.args || {}, result);
          }
          if (this.ws && this.ws.readyState === WebSocket.OPEN && responses.length > 0) {
            this.ws.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: responses,
                },
              })
            );
          }
        }

        if (msg.error) {
          console.warn('[PlantTalk Live] Gemini Live API error message:', msg.error);
          this.callbacks.onStatusChange?.('error', msg.error.message || 'Gemini Live encountered an error.');
        }
      } catch (e) {
        console.error('[PlantTalk Live] Error processing incoming Live message:', e);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[PlantTalk Live] Direct WebSocket error:', err);
      if (!hasHandshaked) {
        reject(new Error('Unable to connect to Gemini Live. Please check your network and API key.'));
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[PlantTalk Live] Direct WebSocket closed (code: ${event.code})`);
      if (this.isRunning) {
        this.callbacks.onStatusChange?.('disconnected');
        this.cleanup();
      }
    };
  }

  /**
   * Handle incoming messages when routed through the server proxy
   */
  private async handleServerProxyMessage(rawData: string): Promise<void> {
    try {
      const msg = JSON.parse(rawData);

      if (msg.userTranscript) {
        const lang = detectSpokenLanguage(msg.userTranscript);
        this.callbacks.onTranscript?.(msg.userTranscript, 'user', lang);
      }

      if (msg.plantTranscript) {
        const lang = detectSpokenLanguage(msg.plantTranscript);
        this.callbacks.onTranscript?.(msg.plantTranscript, 'plant', lang);
      }

      if (msg.plantTranscriptPartial) {
        const lang = detectSpokenLanguage(msg.plantTranscriptPartial);
        this.callbacks.onTranscript?.(msg.plantTranscriptPartial, 'plant', lang);
      }

      if (msg.audio) {
        this.callbacks.onStatusChange?.('speaking');
        this.playAudioChunk(msg.audio);
      }

      if (msg.interrupted) {
        console.log('[PlantTalk Live] Interruption received from server');
        this.stopPlayback();
        this.callbacks.onStatusChange?.('listening');
      }

      if (msg.status === 'listening' && this.activeSources.length === 0) {
        this.callbacks.onStatusChange?.('listening');
      }

      if (msg.toolCall) {
        const { id, name, args } = msg.toolCall;
        const result = await executePlantToolCall(name, args || {});
        this.callbacks.onToolCall?.(name, args || {}, result);

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
      console.error('[PlantTalk Live] Error processing proxy message:', e);
    }
  }

  /**
   * Start microphone audio processing pipeline (16kHz linear PCM streaming)
   */
  private startAudioProcessing(): void {
    if (!this.mediaStream || !this.inputAudioCtx) return;

    try {
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      // Connect to silence gain to prevent mic feedback through speakers
      const silenceGain = this.inputAudioCtx.createGain();
      silenceGain.gain.value = 0;

      this.sourceNode.connect(this.processor);
      this.processor.connect(silenceGain);
      silenceGain.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRunning || this.isMuted) return;

        const float32Data = e.inputBuffer.getChannelData(0);

        // Barge-in energy detection: if user speaks into mic while plant audio is playing
        if (this.activeSources.length > 0) {
          let sumSquares = 0;
          for (let i = 0; i < float32Data.length; i++) {
            sumSquares += float32Data[i] * float32Data[i];
          }
          const rms = Math.sqrt(sumSquares / float32Data.length);
          if (rms > 0.055) {
            console.log('[PlantTalk Live] ⚡ User barge-in detected via microphone energy level:', rms.toFixed(4));
            this.interrupt();
          }
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const pcm16Data = this.convertFloat32ToPCM16(float32Data);
        const base64Audio = this.arrayBufferToBase64(pcm16Data);

        if (this.isDirectGoogleMode) {
          // Direct Google Multimodal Live protocol
          this.ws.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Audio,
                  },
                ],
              },
            })
          );
        } else {
          // Server proxy protocol
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Audio,
            })
          );
        }
      };

      console.log('[PlantTalk Live] Audio input started (16kHz PCM)');
    } catch (err) {
      console.warn('[PlantTalk Live] AudioContext input setup failed:', err);
    }
  }

  /**
   * Passive SpeechRecognition observer (purely for displaying user speech bubbles in transcript log)
   * Does NOT trigger text API calls or browser TTS.
   */
  private startPassiveSpeechObserver(): void {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {}
        this.recognition = null;
      }

      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      const prefLang = useSettingsStore.getState().preferredLanguage;
      this.recognition.lang = prefLang === 'en' ? 'en-US' : 'ta-IN';

      this.recognition.onresult = (event: any) => {
        if (!this.isRunning || this.isMuted) return;

        // Barge-in: if speech detected while plant is speaking, interrupt plant audio
        if (this.activeSources.length > 0) {
          console.log('[PlantTalk Live] ⚡ User interrupted plant speaking via recognized voice!');
          this.interrupt();
        }

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }

        const candidateText = transcript.trim();
        if (candidateText) {
          const lang = detectSpokenLanguage(candidateText);
          this.callbacks.onTranscript?.(candidateText, 'user', lang);
        }
      };

      this.recognition.onerror = () => {};
      this.recognition.onend = () => {
        if (this.isRunning && !this.isMuted) {
          setTimeout(() => {
            if (this.isRunning && !this.isMuted) {
              try {
                this.recognition?.start();
              } catch {}
            }
          }, 200);
        }
      };

      this.recognition.start();
    } catch {
      // Non-blocking
    }
  }

  /**
   * Real-time audio playback chunk player (24kHz linear PCM)
   */
  private playAudioChunk(base64Audio: string): void {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume().catch(() => {});
    }

    try {
      const binary = atob(base64Audio);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const numSamples = Math.floor(bytes.byteLength / 2);
      const float32Data = new Float32Array(numSamples);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true); // little-endian
        float32Data[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, numSamples, 24000);
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
        if (this.activeSources.length === 0 && this.isRunning) {
          this.callbacks.onStatusChange?.('listening');
        }
      };
    } catch (err) {
      console.warn('[PlantTalk Live] Error decoding or playing audio chunk:', err);
      if (this.activeSources.length === 0 && this.isRunning) {
        this.callbacks.onStatusChange?.('listening');
      }
    }
  }

  /**
   * Barge-in interruption: immediately halts playback and clears queue
   */
  public interrupt(): void {
    if (this.activeSources.length === 0) return;
    console.log('[PlantTalk Live] ⚡ Interrupted speaking (barge-in)!');
    this.stopPlayback();
    this.callbacks.onStatusChange?.('listening');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.isDirectGoogleMode) {
        // Send empty turn to cancel active model generation
        try {
          this.ws.send(JSON.stringify({ clientContent: { turns: [], turnComplete: true } }));
        } catch {}
      } else {
        try {
          this.ws.send(JSON.stringify({ type: 'interrupt' }));
        } catch {}
      }
    }
  }

  /**
   * Stop all active audio playback sources immediately
   */
  private stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
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
  }

  public disconnect(): void {
    console.log('[PlantTalk Live] Disconnecting Live session');
    this.callbacks.onStatusChange?.('disconnecting');
    this.cleanup();
    this.callbacks.onStatusChange?.('disconnected');
    console.log('[PlantTalk Live] Session closed');
  }

  private cleanup(): void {
    this.isRunning = false;
    this.isConnecting = false;
    this.isDirectGoogleMode = false;
    this.stopPlayback();

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close().catch(() => {});
      } catch {}
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close().catch(() => {});
      } catch {}
      this.outputAudioCtx = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
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
}
