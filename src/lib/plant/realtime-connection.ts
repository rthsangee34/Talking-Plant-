import { executePlantToolCall } from './realtime-tools';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';
import { getFemaleVoice, getAllVoices, playGeminiAudio } from './warning-voice-system';

export interface LiveConnectionCallbacks {
  onStatusChange?: (
    status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error',
    errorMsg?: string
  ) => void;
  onTranscript?: (text: string, sender: 'user' | 'plant', language?: 'en' | 'ta' | 'mixed') => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
}

export function detectSpokenLanguage(text: string): 'ta' | 'en' {
  if (!text) return 'en';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';

  const tanglishKeywords = /\b(inniku|iniku|eppadi|epdi|irukku|irukanga|irukka|enna|panra|pandringa|thanni|thannir|tannir|kuduthacha|venuma|indha|inda|vanakkam|chedi|ilai|ilaigal|romba|konjam|adade|apdiya|solla|sollunga|teriyuma|theriyuma|pandra|vanga|ponga|tamil|tamil-la|tamil-le|tamilil)\b/i;
  if (tanglishKeywords.test(text)) return 'ta';

  return 'en';
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
  private isDirectClientMode: boolean = false;
  private isProcessingSpeech: boolean = false;
  private callbacks: LiveConnectionCallbacks = {};

  constructor(callbacks: LiveConnectionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.callbacks.onStatusChange?.('connecting');

      // 1. Request microphone permission first (relax constraints to avoid OverconstrainedError)
      try {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (micErr: any) {
        console.warn('[GeminiLive] Microphone access denied or unavailable:', micErr);
        this.callbacks.onStatusChange?.('error', 'Microphone permission is required for Live Speaking.');
        this.cleanup();
        return;
      }

      // 2. Establish WebSocket to backend Live proxy (with graceful Direct Client fallback)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/api/live`;
      const { apiKey } = useSettingsStore.getState();
      if (apiKey) {
        wsUrl += `?key=${encodeURIComponent(apiKey)}`;
      }

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isDirectClientMode = false;
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
              const lang = detectSpokenLanguage(msg.userTranscript);
              this.callbacks.onTranscript?.(msg.userTranscript, 'user', lang);
            }

            if (msg.plantTranscript) {
              const lang = detectSpokenLanguage(msg.plantTranscript);
              this.callbacks.onTranscript?.(msg.plantTranscript, 'plant', lang);
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
          console.warn('[GeminiLive] Live WebSocket proxy unavailable. Activating Direct Client Speech Mode:', err);
          this.activateDirectClientMode();
        };

        this.ws.onclose = () => {
          if (this.isRunning && !this.isDirectClientMode) {
            console.warn('[GeminiLive] WebSocket closed. Switching to Direct Client Speech Mode.');
            this.activateDirectClientMode();
          }
        };
      } catch (wsErr) {
        console.warn('[GeminiLive] WebSocket initialization failed. Activating Direct Client Speech Mode:', wsErr);
        this.activateDirectClientMode();
      }
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

      // Create a gain node with 0 volume to prevent mic feedback through user's speakers
      const silenceGain = this.inputAudioCtx.createGain();
      silenceGain.gain.value = 0;

      this.sourceNode.connect(this.processor);
      this.processor.connect(silenceGain);
      silenceGain.connect(this.inputAudioCtx.destination);

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
        if (!this.isRunning || this.isMuted || this.isProcessingSpeech) return;
        const results = event.results;
        if (!results || results.length === 0) return;

        const lastResult = results[results.length - 1];
        const transcript = lastResult?.[0]?.transcript?.trim();

        if (transcript) {
          const lang = detectSpokenLanguage(transcript);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[GeminiLive] Live voice detected (WS):', transcript, 'lang:', lang);
            this.ws.send(
              JSON.stringify({
                type: 'userSpeech',
                text: transcript,
              })
            );
          } else if (this.isDirectClientMode) {
            console.log('[GeminiLive] Live voice detected (Direct Speech):', transcript, 'lang:', lang);
            this.handleDirectSpeech(transcript);
          }
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[GeminiLive] Speech recognition warning:', e.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart recognition if still running and not speaking or processing
        if (
          this.isRunning &&
          !this.isMuted &&
          !this.isProcessingSpeech &&
          this.activeSources.length === 0
        ) {
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

  private activateDirectClientMode(): void {
    if (!this.isRunning) return;
    this.isDirectClientMode = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    console.log('[GeminiLive] 🌿 Direct Client Speech Mode active. Listening for plant talk...');
    this.callbacks.onStatusChange?.('listening');
    this.startSpeechRecognition();
  }

  /**
   * Call Gemini TTS directly from the browser to generate native audio.
   * Supports Tamil and English with the Aoede female voice.
   * Returns base64 PCM16 24kHz audio data, or null on failure.
   */
  private async generateGeminiTTS(text: string, apiKey: string): Promise<string | null> {
    if (!text || !apiKey) return null;

    const ttsModels = [
      'gemini-3.8-flash-tts',
      'gemini-3.1-flash-tts-preview',
      'gemini-2.5-flash-preview-tts',
    ];

    for (const model of ttsModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
            },
          }),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const audioPart = data.candidates?.[0]?.content?.parts?.find(
          (p: any) => p.inlineData?.mimeType?.startsWith('audio/')
        );
        if (audioPart?.inlineData?.data) {
          console.log(`[GeminiLive] 🎤 TTS generated via ${model} (${text.length} chars)`);
          return audioPart.inlineData.data;
        }
      } catch {
        // Try next model
      }
    }
    return null;
  }

  private async handleDirectSpeech(userTranscript: string): Promise<void> {
    if (!this.isRunning || this.isMuted || this.isProcessingSpeech) return;

    this.isProcessingSpeech = true;
    try {
      this.recognition?.stop();
    } catch {}

    const userLang = detectSpokenLanguage(userTranscript);
    const isTamilInput = userLang === 'ta';
    this.callbacks.onTranscript?.(userTranscript, 'user', userLang);
    this.callbacks.onStatusChange?.('speaking');

    const resumeListening = () => {
      this.isProcessingSpeech = false;
      if (this.isRunning && !this.isMuted) {
        this.callbacks.onStatusChange?.('listening');
        try {
          this.recognition?.start();
        } catch {}
      }
    };

    try {
      const { apiKey } = useSettingsStore.getState();
      const sensors = useSensorsStore.getState().readings;
      const moisture = Math.round(sensors.moisture || 58);
      const light = Math.round(sensors.light || 65);
      const temp = Math.round(sensors.temperature || 26);
      const humidity = Math.round(sensors.humidity || 62);

      const sensorContext = {
        soilMoisture: moisture,
        lightIntensity: light,
        temperature: temp,
        humidity: humidity,
      };

      // Call chat() with the correct positional signature: (message, apiKey, context, history)
      let replyText: string;
      try {
        const response = await defaultAIProvider.chat(userTranscript, apiKey, sensorContext, []);
        replyText = response.reply || '';
      } catch {
        replyText = '';
      }

      // Fallback if chat returned empty
      if (!replyText) {
        replyText = isTamilInput
          ? 'வணக்கம்! நான் உங்கள் செடி. என் இலைகள் நன்றாக இருக்கின்றன, நல்ல வெளிச்சம் கிடைக்குது! 🌱'
          : "I'm doing great! My leaves are soaking up the light! 🌱";
      }

      const replyLang = detectSpokenLanguage(replyText);
      const isTamilReply = replyLang === 'ta';
      this.callbacks.onTranscript?.(replyText, 'plant', replyLang);

      // Strategy 1: Use Gemini TTS for native Tamil+English audio (best quality)
      const keyForTTS = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
      if (keyForTTS) {
        const audioBase64 = await this.generateGeminiTTS(replyText, keyForTTS);
        if (audioBase64) {
          const played = await playGeminiAudio(audioBase64);
          if (played) {
            // Estimate audio duration from PCM16 data: bytes / 2 samples / 24000 Hz * 1000 ms
            const binaryLen = Math.ceil(audioBase64.length * 3 / 4);
            const durationMs = Math.max(2000, (binaryLen / 2 / 24000) * 1000);
            setTimeout(resumeListening, durationMs);
            return;
          }
        }
      }

      // Strategy 2: Fallback to browser SpeechSynthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.lang = isTamilReply ? 'ta-IN' : 'en-US';
        utterance.pitch = 1.2;
        utterance.rate = 1.0;

        const voices = getAllVoices();
        const femaleVoice = getFemaleVoice(voices, isTamilReply ? 'ta' : 'en');
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        utterance.onend = resumeListening;
        utterance.onerror = resumeListening;
        window.speechSynthesis.speak(utterance);
      } else {
        resumeListening();
      }
    } catch (err) {
      console.warn('[GeminiLive] Direct speech AI processing error:', err);
      resumeListening();
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.callbacks.onStatusChange?.('disconnected');
  }

  private cleanup(): void {
    this.isRunning = false;
    this.isDirectClientMode = false;
    this.isProcessingSpeech = false;
    this.stopPlayback();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

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
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
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
