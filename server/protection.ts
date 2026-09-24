import { Request, Response } from 'express';
import { Type } from '@google/genai';
import { getGemini, ensureApiKey, GEMINI_VISION_MODEL, GEMINI_LIVE_VOICE } from './gemini';
import { PLANT_PROTECTION_ALERT_SYSTEM_PROMPT } from '../src/lib/plant/prompts';
import { logServerError, logServerEvent } from '../src/lib/api/response-logging';

export interface ProtectionAlertRequestBody {
  escalationLevel?: number; // 1 to 5
  touchType?: 'initial' | 'continuous-3s' | 'continuous-6s';
  touchCount?: number;
  language?: 'en' | 'ta';
  plantName?: string;
  contextSummary?: string;
  previousMessage?: string;
}

export interface ProtectionAlertResponse {
  tamilText: string;
  englishText: string;
  audioBase64?: string;
  audioMime?: string;
  escalationLevel: number;
  tone: string;
  source: 'gemini' | 'fallback';
  latencyMs: number;
}

const audioCache = new Map<string, string>();

/**
 * Robust botanical fallbacks for all escalation stages.
 * Used if Gemini is unreachable or experiencing quota limits.
 * Uses angry + humorous plant personality lines suitable for school projects.
 */
function getFallbackProtectionAlert(
  level: number,
  touchType: 'initial' | 'continuous-3s' | 'continuous-6s' = 'initial'
): { tamilText: string; englishText: string; escalationLevel: number; tone: string } {
  if (touchType === 'continuous-3s') {
    return {
      tamilText: 'கையை விலக்குங்கள்! என் இலைகளை விட்டுடுங்க! நான் Photosynthesis பண்ணிட்டு இருக்கேன்!',
      englishText: 'Remove your hands! Bro, stop touching me, I\'m trying to photosynthesize!',
      escalationLevel: 3,
      tone: 'distressed',
    };
  }

  if (touchType === 'continuous-6s') {
    return {
      tamilText: 'எச்சரிக்கை! என் இலை நசுங்குகிறது, Touchscreen கிடையாது! உடனடியா கையை எடுங்க!',
      englishText: 'WARNING! My leaves are being crushed and are not a touchscreen! Hands off immediately!',
      escalationLevel: 4,
      tone: 'alarmed',
    };
  }

  switch (level) {
    case 1:
      return {
        tamilText: 'அட! ஏய்! என் இலைகளை தொடாதீங்க! நான் இங்கே வளர முயற்சி செய்கிறேன்!',
        englishText: 'HEY! That tickles, but hands off my leaves! I\'m trying to grow here!',
        escalationLevel: 1,
        tone: 'surprised',
      };
    case 2:
      return {
        tamilText: 'மீண்டும் தொடுகிறீங்களா?! என் இலைகள் மென்மையானவை, Touchscreen என்று நினைத்தீங்களா?',
        englishText: 'Again?! My leaves are delicate and not a touchscreen, leave them alone!',
        escalationLevel: 2,
        tone: 'gentle',
      };
    case 3:
      return {
        tamilText: 'அட! தயவுசெய்து என்னை தொடாதீர்கள்! என் இலைகளை விட்டுடுங்க, நான் Photosynthesis பண்ணிட்டு இருக்கேன்!',
        englishText: 'Bro, please stop touching me! My stems are shaking and I\'m trying to photosynthesize!',
        escalationLevel: 3,
        tone: 'firm',
      };
    case 4:
      return {
        tamilText: 'எச்சரிக்கை! நிறுத்துங்கள்! என் இலைகள் Touchscreen கிடையாது!',
        englishText: 'WARNING! Stop right now, my leaves are not a touchscreen!',
        escalationLevel: 4,
        tone: 'distressed',
      };
    case 5:
    default:
      return {
        tamilText: 'அவசர எச்சரிக்கை! மறுபடியும் தொடாதீங்க! உடனடியா கையை எடுங்க, எனக்கும் கொஞ்சம் அமைதி வேண்டும்!',
        englishText: 'Emergency! Seriously?! Remove your hands and leave my leaves alone!',
        escalationLevel: Math.max(5, level),
        tone: 'alarmed',
      };
  }
}

/**
 * Synthesizes speech using Gemini's native voice model (Zephyr voice).
 * Supports both Sri Lankan Tamil and English text.
 */
async function synthesizeGeminiVoice(
  ai: ReturnType<typeof getGemini>,
  text: string
): Promise<string | undefined> {
  const cacheKey = text.trim();
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  try {
    const ttsRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text }] },
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE || 'Aoede' },
          },
        },
      },
    });

    const data = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) {
      audioCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    logServerError('protection-tts', err);
  }
  return undefined;
}

/**
 * POST /api/plant/protection-alert
 * Generates custom AI warning spoken alerts through Gemini,
 * including synthesized Gemini native voice audio for both Tamil and English.
 */
export async function handleProtectionAlertRequest(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const reqApiKey = req.headers['x-gemini-api-key'] as string | undefined;

  const {
    escalationLevel = 1,
    touchType = 'initial',
    touchCount = 1,
    language = 'ta',
    plantName = 'Houseplant',
    contextSummary = '',
    previousMessage = '',
  } = (req.body || {}) as ProtectionAlertRequestBody;

  const normalizedLevel = Math.max(1, Math.min(5, Number(escalationLevel) || (touchCount >= 5 ? 5 : touchCount)));

  // If API key is missing, respond with high-quality botanical fallback immediately
  if (!ensureApiKey(res, reqApiKey)) {
    return;
  }

  try {
    const ai = getGemini(reqApiKey);

    const promptText = `
You are the voice of a plant protection system called Plant Talk.
A person has just touched the plant.
Consecutive Touch Number: ${touchCount} (Escalation Level: ${normalizedLevel} of 5)
Plant: ${plantName}
${contextSummary ? `Context: ${contextSummary}` : ''}

Generate ONE short warning message in BOTH Natural Tamil and English as if the plant itself is speaking.

PERSONALITY:
- 😡 Angry but humorous: Personally annoyed that someone touched your leaves, but funny and playful.
- 🌱 Plant-like: Mention leaves, plants, growing, photosynthesis, or touching when appropriate.
- Sarcastic humor welcome (e.g. "Do I look like a touchscreen to you?").
- Family-friendly and suitable for a school technology project: NO profanity, NO threats, NO insults.
${previousMessage ? `- IMPORTANT: Generate a different message and avoid repeating the previous message: "${previousMessage}".` : '- Generate a fresh, unique message for this touch.'}

RULES:
- English: Maximum 1–2 short sentences.
- Tamil: 1 அல்லது 2 குறுகிய வாக்கியங்கள். இயல்பான, எளிதில் புரியும் தமிழ், விளையாட்டுத்தனமான கோபம்.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: {
        parts: [{ text: promptText }],
      },
      config: {
        systemInstruction: PLANT_PROTECTION_ALERT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tamilText: {
              type: Type.STRING,
              description: 'Natural spoken Tamil warning text (1-2 short, punchy sentences, angry but humorous)',
            },
            englishText: {
              type: Type.STRING,
              description: 'English warning text matching tone and meaning (1-2 short sentences, angry but humorous)',
            },
            escalationLevel: {
              type: Type.INTEGER,
              description: 'Escalation level from 1 to 5',
            },
            tone: {
              type: Type.STRING,
              description: 'Tone: angry, humorous, playful, annoyed, or alarmed',
            },
          },
          required: ['tamilText', 'englishText', 'escalationLevel', 'tone'],
        },
      },
    });

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      throw new Error('Gemini returned an empty protection alert response.');
    }

    const parsed = JSON.parse(rawText);
    const finalTamilText = parsed.tamilText || getFallbackProtectionAlert(normalizedLevel, touchType).tamilText;
    const finalEnglishText = parsed.englishText || getFallbackProtectionAlert(normalizedLevel, touchType).englishText;

    // Synthesize Gemini Voice Audio for the chosen language
    const textToSpeak = language === 'ta' ? finalTamilText : finalEnglishText;
    const audioBase64 = await synthesizeGeminiVoice(ai, textToSpeak);

    const latencyMs = Date.now() - startTime;
    logServerEvent('protection', `Gemini protection alert generated for Level ${normalizedLevel} (${language}) in ${latencyMs}ms (audio: ${!!audioBase64})`);

    res.json({
      tamilText: finalTamilText,
      englishText: finalEnglishText,
      audioBase64,
      audioMime: audioBase64 ? 'audio/L16;codec=pcm;rate=24000' : undefined,
      escalationLevel: parsed.escalationLevel || normalizedLevel,
      tone: parsed.tone || 'protective',
      source: 'gemini',
      latencyMs,
    } as ProtectionAlertResponse);
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logServerError('protection', error);

    const fallback = getFallbackProtectionAlert(normalizedLevel, touchType);
    let audioBase64: string | undefined;
    try {
      const ai = getGemini(reqApiKey);
      const textToSpeak = language === 'ta' ? fallback.tamilText : fallback.englishText;
      audioBase64 = await synthesizeGeminiVoice(ai, textToSpeak);
    } catch {}

    res.json({
      ...fallback,
      audioBase64,
      audioMime: audioBase64 ? 'audio/L16;codec=pcm;rate=24000' : undefined,
      source: 'fallback',
      latencyMs,
    } as ProtectionAlertResponse);
  }
}

/**
 * POST /api/plant/variation
 * Background AI phrase generation using Gemini.
 * Generates fresh playful plant defense lines to replenish the local phrase pool.
 */
export async function handlePlantVariationRequest(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const reqApiKey = req.headers['x-gemini-api-key'] as string | undefined;

  const { prompt, lang = 'en' } = req.body || {};

  if (!ensureApiKey(res, reqApiKey)) {
    return;
  }

  try {
    const ai = getGemini(reqApiKey);

    const instruction = lang === 'ta'
      ? `You are a living houseplant defending your personal space and leaves from a human hand.
Generate 3 short, 1-sentence playful warnings in natural Sri Lankan Tamil.
Respond as the plant itself. Tone: cute, protective of leaves, living creature.
Never use technical terms (camera, sensor, AI, detection).`
      : `You are a living houseplant defending your personal space and leaves from a human hand.
Generate 3 short, 1-sentence playful warnings in English.
Respond as the plant itself. Tone: sassy, cute, protective of leaves.
Never use technical terms (camera, sensor, AI, detection).`;

    const userPrompt = prompt || (lang === 'ta'
      ? 'Generate 3 new unique short Tamil warning phrases for hand touching leaves.'
      : 'Generate 3 new unique short English warning phrases for hand touching leaves.');

    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: {
        parts: [{ text: userPrompt }],
      },
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of 3 short plant warning phrases',
            },
          },
          required: ['phrases'],
        },
      },
    });

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      throw new Error('Gemini returned an empty phrase variation response.');
    }

    const parsed = JSON.parse(rawText);
    const phrases = Array.isArray(parsed.phrases) ? parsed.phrases : [];
    const latencyMs = Date.now() - startTime;

    logServerEvent('protection', `Generated ${phrases.length} phrase variations (${lang}) in ${latencyMs}ms`);

    res.json({
      phrases,
      latencyMs,
    });
  } catch (error) {
    logServerError('protection', error);

    // Provide friendly fallback phrases so the client pool expands gracefully
    const fallbackPhrases = lang === 'ta'
      ? [
          'என் பச்சை இலைகள் மிக மென்மையானவை, கவனமாக பாருங்கள்!',
          'அட, என் ஒளிச்சேர்க்கையை தடுக்காதீங்க, கையை எடுங்க!',
          'என்னைத் தொடாமல் தூரத்தில் இருந்து ரசியுங்கள், நண்பரே!',
        ]
      : [
          'Careful! My stomata are breathing, give me some space!',
          'Admire the greenery with your eyes, not your fingers!',
          'Hands back, please! Photosynthesis is serious business.',
        ];

    res.json({
      phrases: fallbackPhrases,
      latencyMs: Date.now() - startTime,
    });
  }
}
