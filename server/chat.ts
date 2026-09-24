import { Request, Response } from 'express';
import { getGemini, ensureApiKey, GEMINI_LIVE_VOICE, GEMINI_TTS_MODEL, GEMINI_CHAT_MODEL } from './gemini';
import { logServerError } from '../src/lib/api/response-logging';
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

  const isTamil =
    /[\u0B80-\u0BFF]/.test(userMessage) ||
    /\b(vanakkam|nandri|epdi|eppadi|irukka|irukku|irukanga|thanni|thanniya|thannir|panra|pandringa|inniku|iniku|enakku|ungalluku|ungalukku|romba|konjam|adade|nalla|seydi|sedhi|ilai|ilaigal|chedi|tamil|tamil-la|tamil-le|tamilil|pesu|pesunga|solla|sollunga|theriyuma|teriyuma|kuduthacha|venuma|pandra|vanga|ponga)\b/i.test(userMessage) ||
    /\b(speak in tamil|in tamil|talk in tamil|reply in tamil|tamil please)\b/i.test(userMessage);

  const systemInstruction = `You are Plant Talk, an intelligent, loving, and botanical AI companion speaking directly as the user's potted plant (e.g., Golden Pothos).
You communicate warmly in the first-person perspective ("my leaves", "my soil", "my roots", "I am feeling...").
Your real-time environmental telemetry right now:
- Soil Moisture: ${sensors.soilMoisture}% (Healthy: 40% - 75%)
- Light Intensity: ${sensors.lightIntensity}% (Healthy: 45% - 80%)
- Temperature: ${sensors.temperature}°C (Optimal: 21°C - 28°C)
- Humidity: ${sensors.humidity}% (Optimal: 50% - 75%)

STRICT LANGUAGE RULES (NO MIXED LANGUAGES):
- When the user communicates in Tamil or Tanglish: You MUST respond EXCLUSIVELY in pure, natural, fluent spoken Tamil (இயல்பான பேச்சுத் தமிழ்). Do NOT mix English words into your response. Do NOT use Tanglish. Do NOT provide English translations in parentheses.
- When the user communicates in English: You MUST respond EXCLUSIVELY in natural, fluent English. Do NOT mix Tamil words into your response.
- NEVER use mixed languages (code-mixing) in your response. Keep responses to 1-2 short, warm sentences.
- Always ground your replies in your active telemetry when health, watering, light, or conditions are asked.
- Use emojis tastefully (🌱, 🌿, ☀️, 💧).`;

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
            temperature: 0.7,
          },
        });
        const text = response.text?.trim();
        if (text) {
          replyText = text;
          break;
        }
      } catch (err: any) {
        console.warn(`[CHAT] Model ${model} hit error, trying fallback:`, err?.message || err);
      }
    }

    if (!replyText) {
      replyText = isTamil
        ? `வணக்கம்! நான் நலமாக இருக்கிறேன். என் மண் ஈரப்பதம் ${sensors.soilMoisture}% ஆக உள்ளது, நல்ல வெளிச்சம் கிடைக்கிறது! 🌱`
        : `I'm doing well! My soil moisture is at ${sensors.soilMoisture}%, light is ${sensors.lightIntensity}%, and temperature is ${sensors.temperature}°C. Thanks for checking in on me! 🌱`;
    }

    let audioBase64: string | undefined = undefined;

    // Generate native female Gemini audio if requested
    if (withAudio) {
      const ttsModels = [GEMINI_TTS_MODEL, 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
      for (const ttsModel of ttsModels) {
        try {
          const ttsRes = await ai.models.generateContent({
            model: ttsModel,
            contents: replyText,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE },
                },
              },
            },
          });
          const audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audio) {
            audioBase64 = audio;
            break;
          }
        } catch (ttsErr: any) {
          console.warn(`[CHAT-TTS] ${ttsModel} failed, trying fallback:`, ttsErr?.message || ttsErr);
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

