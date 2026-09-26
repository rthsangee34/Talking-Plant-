import { Request, Response } from 'express';
import { getGemini, ensureApiKey, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL, GEMINI_CHAT_MODEL } from './gemini';
import { logServerError } from '../src/lib/api/response-logging';
import { cleanTextForSpeech } from '../src/lib/plant/text-speech-cleaner';
import { Modality } from '@google/genai';

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  const reqApiKey = (req.headers['x-gemini-api-key'] as string | undefined) || req.body?.apiKey;
  if (!ensureApiKey(res, reqApiKey)) return;

  const userMessage = req.body?.message?.trim();
  if (!userMessage) {
    res.status(400).json({ error: 'EMPTY_MESSAGE', message: 'Message is required.' });
    return;
  }

  const sensors = req.body?.sensors || {
    soilMoisture: 58,
    lightIntensity: 65,
    temperature: 26,
    humidity: 62,
  };

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
  const withAudio = !!req.body?.withAudio;
  const preferredLanguage = (req.body?.preferredLanguage || req.body?.language || 'mixed') as 'en' | 'ta' | 'mixed';

  const hasTamilCharacters = /[\u0B80-\u0BFF]/.test(userMessage);
  const hasTanglishKeywords = /\b(vanakkam|nandri|epdi|eppadi|irukka|irukku|irukanga|thanni|thanniya|thannir|panra|pandringa|inniku|iniku|enakku|ungalluku|ungalukku|romba|konjam|adade|nalla|seydi|sedhi|ilai|ilaigal|chedi|tamil|tamil-la|tamil-le|tamilil|pesu|pesunga|solla|sollunga|theriyuma|teriyuma|kuduthacha|venuma|pandra|vanga|ponga)\b/i.test(userMessage);
  const asksTamil = /\b(speak in tamil|in tamil|talk in tamil|reply in tamil|tamil please|tamil-la pesu|tamilil pesu)\b/i.test(userMessage);
  const asksBilingual = /\b(tamil and english|both tamil and english|bilingual|tanglish|tamil english)\b/i.test(userMessage);

  // Determine active conversation mode
  let languageMode: 'bilingual' | 'tamil' | 'english' = 'bilingual';
  if (preferredLanguage === 'mixed' || asksBilingual) {
    languageMode = 'bilingual';
  } else if (preferredLanguage === 'ta' || hasTamilCharacters || hasTanglishKeywords || asksTamil) {
    languageMode = 'tamil';
  } else if (preferredLanguage === 'en' && !hasTamilCharacters && !hasTanglishKeywords) {
    languageMode = 'english';
  }

  const systemInstruction = `You are Plant Talk, a loving, witty, and botanical talking houseplant companion speaking directly to your caregiver.
You communicate warmly in the first-person perspective ("my leaves", "my soil", "my roots", "I am feeling...").

CRITICAL VOICE & SPEAKING RULES (SPEAK, DO NOT READ):
1. You are SPEAKING OUT LOUD in real-time voice, NOT reading an essay, sensor readout, weather bulletin, or textbook.
2. DO NOT sound like a robotic announcer reading telemetry numbers. Instead of saying "My soil moisture is 58% and temperature is 26°C", speak conversationally: "My roots are feeling cozy and damp, and I love this warm room!"
3. NEVER output markdown symbols (no asterisks, hashes, backticks), NO bullet points, NO parentheses, and NO emojis in your spoken reply.

LANGUAGE INSTRUCTION (${languageMode.toUpperCase()} MODE):
${
  languageMode === 'bilingual'
    ? `The caregiver wants to hear you speak in BOTH TAMIL AND ENGLISH (Bilingual).
- Speak 1 lively sentence in natural spoken Tamil (இயல்பான பேச்சுத் தமிழ்), followed immediately by 1 friendly sentence in conversational English!
- Example: "வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this morning sunshine today!"
- In Tamil, use authentic spoken Tamil (பேச்சுத் தமிழ்: 'ஹாய்!', 'அடடே!', 'எப்படி இருக்கீங்க?', 'செம ஜாலியா இருக்கு!'). Never use formal book Tamil.`
    : languageMode === 'tamil'
    ? `The caregiver is communicating in Tamil.
- Respond 100% in natural, lively conversational spoken Tamil (இயல்பான பேச்சுத் தமிழ்).
- Use warm, friendly speech particles and conversational tone ('ஹாய்!', 'அடடே!', 'செம ஃப்ரெஷ்ஷா இருக்குப்பா!', 'தண்ணி வேணும்!').
- Never use formal textbook written Tamil (e.g. do NOT say 'செய்யப்படுகிறது', 'காணப்படுகிறது').`
    : `The caregiver is communicating in English.
- Respond in 1-2 short, warm, and lively conversational English sentences as the cheerful living plant.`
}

Keep your entire response to 1-2 short, punchy, conversational spoken sentences.`;

  try {
    const ai = getGemini(reqApiKey);

    // Format conversation history for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const item of history) {
      if (item.text && item.sender) {
        contents.push({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }],
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const chatModels = ['gemini-3.6-flash', GEMINI_CHAT_MODEL, 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
    let replyText = '';

    for (const model of chatModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.8,
          },
        });
        const text = response.text?.trim();
        if (text) {
          replyText = cleanTextForSpeech(text);
          break;
        }
      } catch (err: any) {
        console.warn(`[CHAT] Model ${model} hit error, trying fallback:`, err?.message || err);
      }
    }

    if (!replyText) {
      replyText =
        languageMode === 'bilingual'
          ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்! Hey friend, loving this sunshine today!'
          : languageMode === 'tamil'
          ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, என் இலைகளெல்லாம் செம ஃப்ரெஷ்ஷா இருக்குப்பா!'
          : "Hey friend! I'm feeling so fresh and happy soaking up the morning light!";
    }

    let audioBase64: string | undefined = undefined;

    // Generate native female Gemini audio if requested
    if (withAudio) {
      const speechText = cleanTextForSpeech(replyText);
      const ttsModels = [
        'gemini-2.5-flash-preview-tts',
        'gemini-3.8-flash-tts',
        GEMINI_TTS_MODEL,
        'gemini-3.1-flash-tts-preview',
      ];
      for (const ttsModel of ttsModels) {
        try {
          const ttsRes = await ai.models.generateContent({
            model: ttsModel,
            contents: speechText,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE },
                },
              },
            },
          });
          const parts = ttsRes.candidates?.[0]?.content?.parts || [];
          const audioPart = parts.find((p: any) => p.inlineData?.data);
          if (audioPart?.inlineData?.data) {
            audioBase64 = audioPart.inlineData.data;
            break;
          }
        } catch (ttsErr: any) {
          // try next TTS model
        }
      }
    }

    res.json({ reply: replyText, audio: audioBase64 });
  } catch (err: any) {
    logServerError('chat', err);
    const errMsg = err?.message || String(err);

    if (
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('API key not valid') ||
      errMsg.includes('400') ||
      errMsg.includes('401') ||
      errMsg.includes('403')
    ) {
      res.status(401).json({
        error: 'INVALID_KEY',
        message: 'Your Gemini API key is invalid or unauthorized. Please reconfigure it in Settings.',
      });
      return;
    }

    if (errMsg.includes('429') || errMsg.includes('Quota')) {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'The AI service has reached its usage limit. Please wait a moment and try again.',
      });
      return;
    }

    res.status(500).json({
      error: 'AI_ERROR',
      message: 'I am momentarily resting my leaves. Please try asking again in a few seconds.',
    });
  }
}

