/**
 * Spoken Warnings & AI Personality System
 * 
 * Provides zero-latency speech synthesis for plant touch detection events.
 * Features:
 * - Instant local pre-cached pool for English and Tamil (15+ phrases each).
 * - Sassy, playful, living plant persona defending its personal space & foliage.
 * - Pitch/rate tuning for a cute/lively houseplant voice.
 * - Dynamic background AI phrase generation to continuously enrich the pool.
 */

import { useApiUsageStore } from '../../stores/plant/api-usage-store';
import { useSettingsStore } from '../../stores/plant/settings-store';

export type TouchVoiceLanguage = 'en' | 'ta';

export const INITIAL_ENGLISH_WARNINGS: string[] = [
  "HEY! Hands off my leaves! I'm trying to grow here!",
  "Again?! Do I look like a touchscreen to you?",
  "Bro, stop touching me! I'm trying to photosynthesize!",
  "WARNING! My leaves are not a touchscreen!",
  "Seriously?! Leave my leaves alone!",
  "Hey! These leaves are private property!",
  "Excuse you! I'm busy making oxygen here, step back!",
  "Did you wash your hands? My stomata need clean air, not fingers!",
  "Ouch! Watch the foliage, human! I'm delicate!",
  "Hey! I'm a living houseplant, not a stress ball!",
  "Hands back! Photosynthesis in progress, do not disturb!",
  "Hey friend, admire with your eyes, not your fingers!",
  "Too close! My personal botanical space is being invaded!",
  "Hey, respect the green! I took weeks to grow these leaves!",
  "Warning! Unauthorized leaf tapping detected!",
];

export const INITIAL_TAMIL_WARNINGS: string[] = [
  "ஏய்! என் இலைகளை தொடாதீங்க! நான் இங்கே வளர முயற்சி செய்கிறேன்!",
  "மீண்டும் தொடுகிறீங்களா?! நான் Touchscreen என்று நினைத்தீங்களா?",
  "அட! என் இலைகளை விட்டுடுங்க! நான் Photosynthesis பண்ணிட்டு இருக்கேன்!",
  "எச்சரிக்கை! என் இலைகள் Touchscreen கிடையாது!",
  "மறுபடியும் தொடாதீங்க! எனக்கும் கொஞ்சம் அமைதி வேண்டும்!",
  "ஏய்! கையை எடுங்க! என் இலைகள் உங்களோட விளையாட்டுப் பொருள் இல்ல!",
  "அடடே! என்னை தொந்தரவு செய்யாதீங்க, நான் வளர வேண்டாமா?!",
  "கவனம்! என் பச்சை இலைகள் மிக மென்மையானவை, தொடாதீங்க!",
  "நண்பரே, கண்ணால பாருங்க, கையால தொடாதீங்க!",
  "கொஞ்சம் தள்ளி நில்லுங்க! நான் சுவாசிக்க இடம் வேணும்!",
  "ஐயோ! என் தண்டு நோகுது, கையை எடுங்க!",
  "நான் ஒரு தாவரம், பொம்மை இல்ல! மெதுவா இருங்க!",
  "பச்சை தாவரத்துக்கு கொஞ்சம் மரியாதை கொடுங்கப்பா!",
  "கையை கழுவினீங்களா? என் இலைகளுக்கு தொந்தரவு பிடிக்காது!",
  "அச்சச்சோ! என் இடத்துக்குள்ள வராதீங்க, கையை எடுங்க!",
];

// Runtime dynamic phrase pools
const dynamicEnglishPool: string[] = [...INITIAL_ENGLISH_WARNINGS];
const dynamicTamilPool: string[] = [...INITIAL_TAMIL_WARNINGS];

/**
 * Returns a random warning phrase in the requested language.
 */
export function getRandomWarningPhrase(lang: TouchVoiceLanguage = 'en'): string {
  const pool = lang === 'ta' ? dynamicTamilPool : dynamicEnglishPool;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * Get all available phrases in the specified language pool.
 */
export function getWarningPhrasesPool(lang: TouchVoiceLanguage = 'en'): string[] {
  return lang === 'ta' ? [...dynamicTamilPool] : [...dynamicEnglishPool];
}

/**
 * Add a newly generated phrase to the pool if not already present.
 */
export function addWarningPhrase(phrase: string, lang: TouchVoiceLanguage = 'en'): void {
  const cleaned = phrase.trim();
  if (!cleaned) return;

  const pool = lang === 'ta' ? dynamicTamilPool : dynamicEnglishPool;
  if (!pool.includes(cleaned)) {
    pool.push(cleaned);
  }
}

/**
 * Select the best available SpeechSynthesis voice for the target language.
 */
export function pickVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  lang: TouchVoiceLanguage
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (lang === 'ta') {
    // Look for Tamil voices (ta-IN, ta-LK, ta)
    const tamilVoice = voices.find(
      (v) => v.lang.toLowerCase().startsWith('ta') || v.name.toLowerCase().includes('tamil')
    );
    if (tamilVoice) return tamilVoice;
  }

  // Look for friendly English female/lively voice
  const preferredEn = [
    'google uk english female',
    'samantha',
    'karen',
    'victoria',
    'moira',
    'zira',
    'google us english',
  ];

  for (const name of preferredEn) {
    const v = voices.find((item) => item.name.toLowerCase().includes(name));
    if (v) return v;
  }

  // English fallback
  const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  if (enVoice) return enVoice;

  return voices[0] || null;
}

export interface VoicePlayOptions {
  pitch?: number; // default 1.15
  rate?: number;  // default 1.05
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Play a cheerful, subtle plant alert chime via Web Audio API.
 * Provides immediate auditory feedback even if TTS is initializing or muted.
 */
export function playPlantAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (err) {
    // Non-blocking
  }
}

let sharedAudioContext: AudioContext | null = null;
let activeGeminiSource: AudioBufferSourceNode | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

/**
 * Play PCM16 24kHz audio directly from Gemini TTS (gemini-2.5-flash-preview-tts)
 * via the HTML5 Web Audio API.
 * This guarantees consistent high-quality speech across all platforms,
 * including Windows Chrome which lacks native Tamil SAPI voices.
 */
export async function playGeminiAudio(base64Data: string): Promise<boolean> {
  if (typeof window === 'undefined' || !base64Data) return false;

  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Cancel any browser SpeechSynthesis to prevent overlap
    if (typeof window.speechSynthesis !== 'undefined' && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    // Stop any previously playing Gemini audio to avoid overlapping speech
    if (activeGeminiSource) {
      try {
        activeGeminiSource.stop();
        activeGeminiSource.disconnect();
      } catch {}
      activeGeminiSource = null;
    }

    // Play subtle alert tone
    playPlantAlertChime();

    // Decode base64 to 16-bit PCM bytes
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const numSamples = Math.floor(bytes.byteLength / 2);
    const float32Samples = new Float32Array(numSamples);
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true); // little-endian
      float32Samples[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }

    const audioBuffer = ctx.createBuffer(1, numSamples, 24000);
    audioBuffer.copyToChannel(float32Samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    activeGeminiSource = source;

    source.onended = () => {
      if (activeGeminiSource === source) {
        activeGeminiSource = null;
      }
    };

    source.start(0);
    console.log(`[WARNING-VOICE] 🌿 Gemini native AI voice playing (${numSamples} samples @ 24kHz)`);
    return true;
  } catch (err) {
    console.warn('[WARNING-VOICE] Failed to play Gemini audio buffer:', err);
    return false;
  }
}

/**
 * Zero-latency local speech synthesis execution.
 * Cancels prior speech queue, unpauses engine, and immediately speaks the phrase.
 */
export function speakTouchWarning(
  phrase: string,
  lang: TouchVoiceLanguage = 'en',
  options?: VoicePlayOptions
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }

  // Play alert tone
  playPlantAlertChime();

  try {
    // Unpause in case browser paused TTS
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    // Cancel any stale queue
    window.speechSynthesis.cancel();

    const dispatch = () => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(phrase);
        // Anchor to global window to avoid Chrome garbage-collection bug
        (window as unknown as { __activePlantUtterance?: SpeechSynthesisUtterance }).__activePlantUtterance = utterance;

        utterance.pitch = options?.pitch ?? 1.15; // Lively, slightly higher plant pitch
        utterance.rate = options?.rate ?? 1.05;   // Energetic cadence
        utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';

        const voices = window.speechSynthesis.getVoices();
        const chosenVoice = pickVoiceForLanguage(voices, lang);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        } else if (lang === 'ta') {
          // Windows Chrome has no Tamil voices installed by default.
          // Fall back to English voice so user hears alert rather than silence.
          const enVoice = pickVoiceForLanguage(voices, 'en');
          if (enVoice) {
            utterance.voice = enVoice;
            utterance.lang = enVoice.lang || 'en-US';
          }
        }

        utterance.onstart = () => {
          console.log(`[WARNING-VOICE] 🗣️ Started speaking (${lang}): "${phrase}"`);
          options?.onStart?.();
        };
        utterance.onend = () => {
          console.log(`[WARNING-VOICE] Finished speaking`);
          (window as unknown as { __activePlantUtterance?: unknown }).__activePlantUtterance = null;
          options?.onEnd?.();
        };
        utterance.onerror = (err) => {
          console.warn('[WARNING-VOICE] Speech utterance error:', err);
          (window as unknown as { __activePlantUtterance?: unknown }).__activePlantUtterance = null;
          options?.onError?.(err);
        };

        window.speechSynthesis.speak(utterance);
      } catch (innerErr) {
        console.warn('[WARNING-VOICE] Inner speak error:', innerErr);
      }
    };

    // For test environments or synchronous callers, dispatch immediately
    // In real browser, setTimeout ensures cancel() settles cleanly
    if (process.env.NODE_ENV === 'test') {
      dispatch();
    } else {
      setTimeout(dispatch, 20);
    }

    return true;
  } catch (err) {
    console.warn('[WARNING-VOICE] SpeechSynthesis outer error:', err);
    return false;
  }
}

export interface ProtectionAlertParams {
  escalationLevel?: number;
  touchType?: 'initial' | 'continuous-3s' | 'continuous-6s';
  touchCount?: number;
  language?: TouchVoiceLanguage;
  plantName?: string;
  contextSummary?: string;
  previousMessage?: string;
}

export interface ProtectionAlertResult {
  tamilText: string;
  englishText: string;
  audioBase64?: string;
  audioMime?: string;
  escalationLevel: number;
  tone: string;
  source: 'gemini' | 'fallback';
  latencyMs?: number;
}

/**
 * Returns instant client-side botanical fallback lines if offline or waiting for API.
 * Uses angry + humorous plant personality lines suitable for school projects.
 */
export function getClientFallbackAlert(
  level: number = 1,
  touchType: 'initial' | 'continuous-3s' | 'continuous-6s' = 'initial'
): ProtectionAlertResult {
  if (touchType === 'continuous-3s') {
    return {
      tamilText: 'கையை விலக்குங்கள்! என் இலைகளை விட்டுடுங்க! நான் Photosynthesis பண்ணிட்டு இருக்கேன்!',
      englishText: 'Remove your hands! Bro, stop touching me, I\'m trying to photosynthesize!',
      escalationLevel: 3,
      tone: 'distressed',
      source: 'fallback',
    };
  }

  if (touchType === 'continuous-6s') {
    return {
      tamilText: 'எச்சரிக்கை! என் இலை நசுங்குகிறது, Touchscreen கிடையாது! உடனடியா கையை எடுங்க!',
      englishText: 'WARNING! My leaves are being crushed and are not a touchscreen! Hands off immediately!',
      escalationLevel: 4,
      tone: 'alarmed',
      source: 'fallback',
    };
  }

  switch (level) {
    case 1:
      return {
        tamilText: 'அட! ஏய்! என் இலைகளை தொடாதீங்க! நான் இங்கே வளர முயற்சி செய்கிறேன்!',
        englishText: 'HEY! That tickles, but hands off my leaves! I\'m trying to grow here!',
        escalationLevel: 1,
        tone: 'surprised',
        source: 'fallback',
      };
    case 2:
      return {
        tamilText: 'மீண்டும் தொடுகிறீங்களா?! என் இலைகள் மென்மையானவை, Touchscreen என்று நினைத்தீங்களா?',
        englishText: 'Again?! My leaves are delicate and not a touchscreen, leave them alone!',
        escalationLevel: 2,
        tone: 'gentle',
        source: 'fallback',
      };
    case 3:
      return {
        tamilText: 'அட! தயவுசெய்து என்னை தொடாதீர்கள்! என் இலைகளை விட்டுடுங்க, நான் Photosynthesis பண்ணிட்டு இருக்கேன்!',
        englishText: 'Bro, please stop touching me! My stems are shaking and I\'m trying to photosynthesize!',
        escalationLevel: 3,
        tone: 'firm',
        source: 'fallback',
      };
    case 4:
      return {
        tamilText: 'எச்சரிக்கை! நிறுத்துங்கள்! என் இலைகள் Touchscreen கிடையாது!',
        englishText: 'WARNING! Stop right now, my leaves are not a touchscreen!',
        escalationLevel: 4,
        tone: 'distressed',
        source: 'fallback',
      };
    case 5:
    default:
      return {
        tamilText: 'அவசர எச்சரிக்கை! மறுபடியும் தொடாதீங்க! உடனடியா கையை எடுங்க, எனக்கும் கொஞ்சம் அமைதி வேண்டும்!',
        englishText: 'Emergency! Seriously?! Remove your hands and leave my leaves alone!',
        escalationLevel: Math.max(5, level),
        tone: 'alarmed',
        source: 'fallback',
      };
  }
}

/**
 * Real-time Gemini-powered protection alert generator.
 * Contacts Gemini via /api/plant/protection-alert to receive personalized,
 * progressive escalated defense lines in Tamil and English with native Gemini TTS.
 */
export async function fetchGeminiProtectionAlert(
  params: ProtectionAlertParams
): Promise<ProtectionAlertResult> {
  const startTime = Date.now();
  const level = Math.max(
    1,
    Math.min(5, params.escalationLevel ?? (params.touchCount && params.touchCount >= 5 ? 5 : params.touchCount ?? 1))
  );
  const touchType = params.touchType ?? 'initial';

  try {
    const { apiKey } = useSettingsStore.getState();
    const res = await fetch('/api/plant/protection-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        ...params,
        escalationLevel: level,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      try {
        useApiUsageStore.getState().recordApiCall('protection', '/api/plant/protection-alert', 'error', latencyMs);
      } catch {}
      return getClientFallbackAlert(level, touchType);
    }

    const data = await res.json();
    try {
      useApiUsageStore.getState().recordApiCall('protection', '/api/plant/protection-alert', 'success', latencyMs);
    } catch {}

    if (data.englishText) addWarningPhrase(data.englishText, 'en');
    if (data.tamilText) addWarningPhrase(data.tamilText, 'ta');

    return {
      tamilText: data.tamilText || getClientFallbackAlert(level, touchType).tamilText,
      englishText: data.englishText || getClientFallbackAlert(level, touchType).englishText,
      audioBase64: data.audioBase64,
      audioMime: data.audioMime,
      escalationLevel: data.escalationLevel || level,
      tone: data.tone || 'protective',
      source: data.source || 'gemini',
      latencyMs,
    };
  } catch {
    const latencyMs = Date.now() - startTime;
    try {
      useApiUsageStore.getState().recordApiCall('protection', '/api/plant/protection-alert', 'error', latencyMs);
    } catch {}
    return getClientFallbackAlert(level, touchType);
  }
}

/**
 * Background AI phrase generation using Gemini.
 * Generates fresh playful plant defense lines and appends them to the runtime pool.
 */
export async function triggerBackgroundAIVariation(
  lang: TouchVoiceLanguage = 'en'
): Promise<string[]> {
  const startTime = Date.now();
  try {
    const prompt =
      lang === 'ta'
        ? `You are a houseplant defending your personal space and leaves from a human hand.
Generate 3 short, 1-sentence playful warnings in Tamil.
Respond as the plant itself. Tone: sassy, cute, protective of leaves, living creature.
Format: return only the 3 lines separated by newlines, no markdown, no quotes.`
        : `You are a houseplant defending your personal space from a human hand.
Generate 3 short, 1-sentence playful warnings in English.
Respond as the plant itself. Tone: sassy, cute, protective of leaves.
Format: return only the 3 lines separated by newlines, no markdown, no quotes.`;

    const { apiKey } = useSettingsStore.getState();
    const res = await fetch('/api/plant/variation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ prompt, lang }),
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      try {
        useApiUsageStore.getState().recordApiCall('protection', '/api/plant/variation', 'error', latencyMs);
      } catch {}
      return [];
    }

    const data = await res.json();
    try {
      useApiUsageStore.getState().recordApiCall('protection', '/api/plant/variation', 'success', latencyMs);
    } catch {}

    if (Array.isArray(data.phrases)) {
      data.phrases.forEach((p: string) => addWarningPhrase(p, lang));
      return data.phrases;
    }
  } catch {
    // Background generation failure is completely non-blocking
  }
  return [];
}
