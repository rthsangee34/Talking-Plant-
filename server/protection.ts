import { Request, Response } from 'express';
import { Type } from '@google/genai';
import { getGemini, ensureApiKey, GEMINI_VISION_MODEL, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL } from './gemini';
import { PLANT_PROTECTION_ALERT_SYSTEM_PROMPT } from '../src/lib/plant/prompts';
import { logServerError, logServerEvent } from '../src/lib/api/response-logging';
import { cleanTextForSpeech } from '../src/lib/plant/text-speech-cleaner';

export interface ProtectionAlertRequestBody {
  escalationLevel?: number; // 1 to 5
  touchType?: 'initial' | 'continuous-3s' | 'continuous-6s';
  touchCount?: number;
  language?: 'en' | 'ta' | 'mixed';
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
 * Uses lively, conversational spoken Tamil (இயல்பான பேச்சுத் தமிழ்) and playful English.
 */
function getFallbackProtectionAlert(
  level: number,
  touchType: 'initial' | 'continuous-3s' | 'continuous-6s' = 'initial'
): { tamilText: string; englishText: string; escalationLevel: number; tone: string } {
  if (touchType === 'continuous-3s') {
    return {
      tamilText: 'அட கையை எடுங்கப்பா! கையை விலக்குங்கள், என் இலைகளை விட்டுடுங்க, நான் போட்டோசிந்தசிஸ் பண்ணிட்டு இருக்கேன்!',
      englishText: 'Remove your hands! Bro, stop touching me, I\'m trying to photosynthesize!',
      escalationLevel: 3,
      tone: 'distressed',
    };
  }

  if (touchType === 'continuous-6s') {
    return {
      tamilText: 'ஐயோ நிறுத்துங்கள்! என் இலை நசுங்குகிறது, நான் என்ன டச் ஸ்க்ரீனா?! உடனடியா கையை எடுங்க!',
      englishText: 'WARNING! My leaves are being crushed and are not a touchscreen! Hands off immediately!',
      escalationLevel: 4,
      tone: 'alarmed',
    };
  }

  switch (level) {
    case 1:
      return {
        tamilText: 'அட! ஏய்! கையை எடுங்கப்பா, கிச்சு கிச்சு மூட்டுது! நான் இங்கே நிம்மதியா வளர வேண்டாமா?!',
        englishText: 'HEY! That tickles, but hands off my leaves! I\'m trying to grow here!',
        escalationLevel: 1,
        tone: 'surprised',
      };
    case 2:
      return {
        tamilText: 'மறுபடியும் தொடுறீங்களா?! என் இலை ரொம்ப சாஃப்ட், என்ன டச் ஸ்க்ரீன்னு நினைச்சீங்களா?!',
        englishText: 'Again?! My leaves are delicate and not a touchscreen, leave them alone!',
        escalationLevel: 2,
        tone: 'gentle',
      };
    case 3:
      return {
        tamilText: 'அடடே! என்னை தொந்தரவு செய்யாதீங்கப்பா! தண்டு எல்லாம் நடுங்குது, நான் போட்டோசிந்தசிஸ் பண்ணிட்டு இருக்கேன்!',
        englishText: 'Bro, please stop touching me! My stems are shaking and I\'m trying to photosynthesize!',
        escalationLevel: 3,
        tone: 'firm',
      };
    case 4:
      return {
        tamilText: 'ஐயோ! நிறுத்துங்க! என் இலைகள் டச் ஸ்க்ரீன் கிடையாது, உடனடியா கையை எடுங்க!',
        englishText: 'WARNING! Stop right now, my leaves are not a touchscreen!',
        escalationLevel: 4,
        tone: 'distressed',
      };
    case 5:
    default:
      return {
        tamilText: 'அவசர எச்சரிக்கை! அப்பப்பா! மறுபடியும் மறுபடியும் தொடுறீங்க! கையை எடுங்கப்பா, எனக்கும் கொஞ்சம் நிம்மதி வேணும்!',
        englishText: 'Emergency! Seriously?! Remove your hands and leave my leaves alone!',
        escalationLevel: Math.max(5, level),
        tone: 'alarmed',
      };
  }
}

/**
 * Synthesizes speech using Gemini's native voice model (Aoede voice).
 * Supports both Sri Lankan Tamil and English text, plus Bilingual.
 */
async function synthesizeGeminiVoice(
  ai: ReturnType<typeof getGemini>,
  text: string
): Promise<string | undefined> {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return undefined;

  const cacheKey = cleaned.trim();
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  const primaryModel = 'gemini-2.5-flash-preview-tts';
  const fallbackModel = GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

  try {
    const ttsRes = await ai.models.generateContent({
      model: primaryModel,
      contents: { parts: [{ text: cleaned }] },
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
    return undefined;
  } catch (err) {
    try {
      const ttsRes = await ai.models.generateContent({
        model: fallbackModel,
        contents: { parts: [{ text: cleaned }] },
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
    } catch {}
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
You are the voice of a living houseplant defending your leaves in a system called Plant Talk.
A person has just touched your plant leaves.
Consecutive Touch Number: ${touchCount} (Escalation Level: ${normalizedLevel} of 5)
Plant: ${plantName}
${contextSummary ? `Context: ${contextSummary}` : ''}

Generate ONE short warning message in BOTH Natural Spoken Tamil and Spoken English.

SPEAKING STYLE (CRITICAL - SPEAK, DO NOT READ):
- You are SPEAKING OUT LOUD to the human touching you, NOT reading an announcement or a textbook.
- 😡 Annoyed but playful: Express personal annoyance that someone touched your leaves, but witty, cute, and funny.
- 🌱 Botanical: Mention delicate leaves, growing, photosynthesis, tickles, stomata, or personal green space.
- Tamil: MUST be 100% natural, expressive spoken colloquial Tamil (இயல்பான பேச்சுத் தமிழ், e.g., 'அட கையை எடுங்கப்பா!', 'கிச்சு கிச்சு மூட்டுது!', 'டச் ஸ்க்ரீன்னு நினைச்சீங்களா?!'). NEVER use formal written Tamil like 'கையை விலக்குங்கள்' or 'செய்யப்படுகிறது'.
- English: Casual spoken conversational English (e.g., 'Whoa, hands off my leaves, I am trying to photosynthesize!').
- Strictly NO emojis, asterisks, brackets, bullet points, or markdown formatting in your response.
${previousMessage ? `- IMPORTANT: Generate a fresh message different from previous: "${previousMessage}".` : '- Generate a fresh, unique message for this touch.'}
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
              description: 'Natural spoken Tamil warning text (1-2 short, punchy sentences, colloquial spoken style)',
            },
            englishText: {
              type: Type.STRING,
              description: 'English warning text matching tone and meaning (1-2 short sentences, casual spoken style)',
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

    // Synthesize Gemini Voice Audio: in mixed mode, speak Tamil then English seamlessly
    const textToSpeak =
      language === 'ta'
        ? finalTamilText
        : language === 'mixed'
        ? `${finalTamilText} ${finalEnglishText}`
        : finalEnglishText;
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
      const textToSpeak =
        language === 'ta'
          ? fallback.tamilText
          : language === 'mixed'
          ? `${fallback.tamilText} ${fallback.englishText}`
          : fallback.englishText;
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
