import { executePlantToolCall } from './realtime-tools';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';
import { getFemaleVoice, getAllVoices, playGeminiAudio } from './warning-voice-system';
import { cleanTextForSpeech } from './text-speech-cleaner';

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
      const { apiKey, preferredLanguage } = useSettingsStore.getState();
      const params = new URLSearchParams();
      if (apiKey) params.set('key', apiKey);
      if (preferredLanguage) params.set('lang', preferredLanguage);
      const qs = params.toString();
      if (qs) wsUrl += `?${qs}`;

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

            if (msg.userTranscript) {
              const lang = detectSpokenLanguage(msg.userTranscript);
              this.callbacks.onTranscript?.(msg.userTranscript, 'user', lang);
            }

            if (msg.plantTranscript) {
              const lang = detectSpokenLanguage(msg.plantTranscript);
              this.callbacks.onTranscript?.(msg.plantTranscript, 'plant', lang);
            }

            if (msg.audio) {
              this.callbacks.onStatusChange?.('speaking');
              this.playAudioChunk(msg.audio);
            } else if (msg.audioFailed) {
              if (msg.plantTranscript) {
                this.fallbackSpeakText(msg.plantTranscript);
              } else {
                this.isProcessingSpeech = false;
                this.callbacks.onStatusChange?.('listening');
                this.resumeSpeechRecognition();
              }
            }

            if (msg.interrupted) {
              this.stopPlayback();
              this.isProcessingSpeech = false;
              this.callbacks.onStatusChange?.('listening');
              this.resumeSpeechRecognition();
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

  private async startAudioProcessing(): Promise<void> {
    if (!this.mediaStream) return;

    try {
      this.inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      // Create a gain node with 0 volume to prevent mic feedback through user's speakers
      const silenceGain = this.inputAudioCtx.createGain();
      silenceGain.gain.value = 0;

      this.sourceNode.connect(this.processor);
      this.processor.connect(silenceGain);
      silenceGain.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted) return;

        const float32Data = e.inputBuffer.getChannelData(0);

        // Continuous barge-in energy detection: if user speaks into microphone while plant is speaking
        if (this.activeSources.length > 0) {
          let sumSquares = 0;
          for (let i = 0; i < float32Data.length; i++) {
            sumSquares += float32Data[i] * float32Data[i];
          }
          const rms = Math.sqrt(sumSquares / float32Data.length);
          if (rms > 0.055) {
            console.log('[GeminiLive] ⚡ User barge-in detected via microphone energy level:', rms.toFixed(4));
            this.interrupt();
          }
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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

  private pauseSpeechRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  private resumeSpeechRecognition(): void {
    if (this.isRunning && !this.isMuted && this.activeSources.length === 0) {
      setTimeout(() => {
        if (this.isRunning && !this.isMuted && this.activeSources.length === 0) {
          try {
            this.recognition?.start();
          } catch {}
        }
      }, 150);
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
      if (this.recognition) {
        try {
          this.recognition.onend = null;
          this.recognition.onerror = null;
          this.recognition.onresult = null;
          this.recognition.stop();
        } catch {}
        this.recognition = null;
      }

      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      // Select language based on user preference
      const prefLang = useSettingsStore.getState().preferredLanguage;
      this.recognition.lang = prefLang === 'en' ? 'en-US' : 'ta-IN';

      let speechDebounceTimer: any = null;
      let lastFinalTranscript = '';

      this.recognition.onresult = (event: any) => {
        if (!this.isRunning || this.isMuted) return;
        const results = event.results;
        if (!results || results.length === 0) return;

        // Barge-in: If user speaks while plant is speaking, interrupt plant audio immediately!
        if (this.activeSources.length > 0) {
          console.log('[GeminiLive] ⚡ User interrupted plant speaking via recognized speech!');
          this.interrupt();
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < results.length; ++i) {
          const item = results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const candidateText = (finalTranscript || interimTranscript).trim();
        if (!candidateText || candidateText === lastFinalTranscript) return;

        // Debounce to allow continuous sentence formulation
        if (speechDebounceTimer) {
          clearTimeout(speechDebounceTimer);
        }

        const delayMs = finalTranscript ? 350 : 1100;

        speechDebounceTimer = setTimeout(() => {
          if (!this.isRunning || this.isMuted || this.isProcessingSpeech) return;
          const textToSend = candidateText;
          lastFinalTranscript = textToSend;
          this.isProcessingSpeech = true;

          const lang = detectSpokenLanguage(textToSend);
          console.log('[GeminiLive] 🎙️ Spoken words detected:', textToSend, 'lang:', lang);

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: 'userSpeech',
                text: textToSend,
                language: prefLang,
              })
            );
          } else if (this.isDirectClientMode) {
            this.handleDirectSpeech(textToSend);
          }
        }, delayMs);
      };

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[GeminiLive] Speech recognition status:', e.error);
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
          setTimeout(() => {
            if (this.isRunning && !this.isMuted && !this.isProcessingSpeech && this.activeSources.length === 0) {
              try {
                this.recognition?.start();
              } catch {}
            }
          }, 150);
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

    // Keep speech recognition running for interruption detection; browser echo cancellation handles speaker output

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
        if (this.activeSources.length === 0) {
          this.isProcessingSpeech = false;
          this.callbacks.onStatusChange?.('listening');
          this.resumeSpeechRecognition();
        }
      };
    } catch (err) {
      console.warn('[GeminiLive] Error decoding or playing audio chunk:', err);
      this.isProcessingSpeech = false;
      this.callbacks.onStatusChange?.('listening');
      this.resumeSpeechRecognition();
    }
  }

  private fallbackSpeakText(text: string): void {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) {
      this.isProcessingSpeech = false;
      this.callbacks.onStatusChange?.('listening');
      this.resumeSpeechRecognition();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.pitch = 1.15;
      utterance.rate = 1.05;

      const hasTamilChars = /[\u0B80-\u0BFF]/.test(cleaned);
      const voices = getAllVoices();
      const tamilVoice = getFemaleVoice(voices, 'ta');
      const enVoice = getFemaleVoice(voices, 'en');

      if (hasTamilChars && tamilVoice) {
        utterance.voice = tamilVoice;
        utterance.lang = 'ta-IN';
      } else if (enVoice) {
        utterance.voice = enVoice;
        utterance.lang = enVoice.lang || 'en-US';
      }

      const onDone = () => {
        this.isProcessingSpeech = false;
        this.callbacks.onStatusChange?.('listening');
        this.resumeSpeechRecognition();
      };

      utterance.onend = onDone;
      utterance.onerror = onDone;
      window.speechSynthesis.speak(utterance);
    } else {
      this.isProcessingSpeech = false;
      this.callbacks.onStatusChange?.('listening');
      this.resumeSpeechRecognition();
    }
  }

  public interrupt(): void {
    if (this.activeSources.length === 0 && !this.isProcessingSpeech) return;
    console.log('[GeminiLive] ⚡ Interrupted speaking (barge-in)!');
    this.stopPlayback();
    this.isProcessingSpeech = false;
    this.callbacks.onStatusChange?.('listening');
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
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
      this.pauseSpeechRecognition();
    } else if (this.isRunning && this.activeSources.length === 0) {
      this.resumeSpeechRecognition();
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
   * Call Gemini TTS to generate native 24kHz audio.
   * Prioritizes the backend server /api/tts endpoint (powered by @google/genai),
   * with fallback to client-side REST call.
   * Returns base64 PCM16 24kHz audio data, or null on failure.
   */
  private async generateGeminiTTS(text: string, apiKey: string): Promise<string | null> {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return null;

    // 1. Try backend server /api/tts endpoint first
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          text: cleaned,
          apiKey,
          voice: 'Aoede',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          console.log(`[GeminiLive] 🎤 TTS generated via server /api/tts (${cleaned.length} chars)`);
          return data.audio;
        }
      }
    } catch {
      // Backend /api/tts unavailable, proceed to client fallback
    }

    // 2. Direct client fallback using official preview TTS models
    const ttsModels = [
      'gemini-2.5-flash-preview-tts',
      'gemini-3.8-flash-tts',
      'gemini-3.1-flash-tts-preview',
    ];

    for (const model of ttsModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: cleaned }] }],
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
          console.log(`[GeminiLive] 🎤 TTS generated via direct client ${model} (${cleaned.length} chars)`);
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

    const prefLang = useSettingsStore.getState().preferredLanguage || 'mixed';
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

      // Call chat() with context & history
      let replyText: string;
      let directAudio: string | undefined;
      try {
        const response = await defaultAIProvider.chat(userTranscript, apiKey, sensorContext, []);
        replyText = response.reply || '';
        directAudio = response.audioBase64;
      } catch {
        replyText = '';
      }

      // Fallback if chat returned empty
      if (!replyText) {
        if (prefLang === 'mixed' || (isTamilInput && /[a-zA-Z]/.test(userTranscript))) {
          replyText = 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்! Hey there, loving this sunshine today!';
        } else if (prefLang === 'ta' || isTamilInput) {
          replyText = 'வணக்கம்! நல்ல வெயில் அடிக்குது, என் இலைகளெல்லாம் செம ஃப்ரெஷ்ஷா இருக்குப்பா!';
        } else {
          replyText = "I'm doing great! My leaves are soaking up the light and my roots feel good!";
        }
      }

      const cleanedReply = cleanTextForSpeech(replyText);
      const replyLang = detectSpokenLanguage(cleanedReply);
      this.callbacks.onTranscript?.(cleanedReply, 'plant', replyLang);

      // Strategy 1: Use Gemini TTS for native 24kHz female voice audio (best quality, speaks Tamil & English flawlessly)
      const keyForTTS = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
      const audioBase64 = directAudio || (await this.generateGeminiTTS(cleanedReply, keyForTTS));
      if (audioBase64) {
        const played = await playGeminiAudio(audioBase64);
        if (played) {
          const binaryLen = Math.ceil((audioBase64.length * 3) / 4);
          const durationMs = Math.max(2000, (binaryLen / 2 / 24000) * 1000);
          setTimeout(resumeListening, durationMs);
          return;
        }
      }

      // Strategy 2: Fallback to browser SpeechSynthesis if Gemini TTS was unreachable
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanedReply);
        utterance.pitch = 1.15;
        utterance.rate = 1.05;

        const hasTamilChars = /[\u0B80-\u0BFF]/.test(cleanedReply);
        const voices = getAllVoices();
        const tamilVoice = getFemaleVoice(voices, 'ta');
        const enVoice = getFemaleVoice(voices, 'en');

        if (hasTamilChars) {
          if (tamilVoice) {
            utterance.voice = tamilVoice;
            utterance.lang = 'ta-IN';
          } else {
            // Windows Chrome lacks native Tamil voices; speak the English portion if bilingual
            const englishPart = cleanedReply.replace(/[\u0B80-\u0BFF]+[^\w]*/g, '').trim();
            if (englishPart && enVoice) {
              utterance.text = englishPart;
              utterance.voice = enVoice;
              utterance.lang = enVoice.lang || 'en-US';
            } else if (enVoice) {
              utterance.voice = enVoice;
              utterance.lang = enVoice.lang || 'en-US';
            }
          }
        } else {
          utterance.lang = 'en-US';
          if (enVoice) {
            utterance.voice = enVoice;
          }
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
