import { Server } from 'http';
import { Request, Response } from 'express';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import {
  getGemini,
  isApiKeyConfigured,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_VOICE,
  GEMINI_TTS_MODEL,
  GEMINI_CHAT_MODEL,
} from './gemini';
import { PLANT_LIVE_SYSTEM_INSTRUCTION } from '../src/lib/plant/prompts';
import { PLANT_LIVE_TOOLS } from '../src/lib/plant/realtime-config';
import { logServerError, logServerEvent } from '../src/lib/api/response-logging';
import { executePlantToolCall } from '../src/lib/plant/realtime-tools';
import { getPlantState } from './plant-state';

export function handleLiveTokenRequest(req: Request, res: Response): void {
  const reqApiKey = req.query.key as string | undefined;
  if (!isApiKeyConfigured(reqApiKey)) {
    res.status(401).json({
      error: 'GEMINI_API_KEY_REQUIRED',
      message: 'GEMINI_API_KEY environment variable is not configured.',
    });
    return;
  }

  res.json({
    status: 'ready',
    model: GEMINI_LIVE_MODEL,
    voice: GEMINI_LIVE_VOICE,
    webSocketPath: '/api/live',
    timestamp: new Date().toISOString(),
  });
}

import { cleanTextForSpeech } from '../src/lib/plant/text-speech-cleaner';

/**
 * Synthesize native Gemini female voice audio (Aoede)
 * Returns base64 24kHz linear PCM audio
 */
async function generateGeminiLiveAudio(
  text: string,
  apiKey?: string,
  voiceName: string = GEMINI_LIVE_VOICE
): Promise<string> {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) throw new Error('No text to synthesize');

  const ai = getGemini(apiKey);
  const ttsModels = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
    GEMINI_TTS_MODEL,
  ];

  for (const model of ttsModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: cleaned,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p: any) => p.inlineData?.data);
      const audioData = audioPart?.inlineData?.data;
      if (audioData) return audioData;
    } catch (err: any) {
      console.warn(`[LIVE-TTS] Model ${model} failed, trying fallback:`, err?.message || err);
    }
  }

  throw new Error('Could not synthesize speech audio from Gemini');
}

/**
 * Stream plant speech response chunk-by-chunk with sentence-level TTS synthesis.
 * Calls onPartialText, onAudioChunk, and onComplete.
 * Checks isCancelled() before each audio synthesis/send to allow immediate interruption.
 */
async function streamLivePlantTurn(
  userText: string,
  apiKey: string | undefined,
  conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  preferredLanguage: 'ta' | 'en' | 'mixed',
  callbacks: {
    isCancelled: () => boolean;
    onPartialText: (textSoFar: string) => void;
    onAudioChunk: (audioBase64: string, sentenceText: string) => void;
    onComplete: (fullText: string) => void;
  }
): Promise<void> {
  const ai = getGemini(apiKey);
  const plantState = getPlantState();
  const s = plantState.sensors;
  const moisture = Math.round(s?.soilMoisture ?? 58);
  const light = Math.round(s?.light ?? 65);
  const temp = Math.round(s?.temperature ?? 26);
  const humidity = Math.round(s?.humidity ?? 62);

  const hasTamil = /[\u0B80-\u0BFF]/.test(userText);
  const hasTanglish = /\b(vanakkam|nandri|epdi|eppadi|irukka|irukku|irukanga|thanni|thanniya|thannir|panra|pandringa|inniku|iniku|enakku|ungalluku|ungalukku|romba|konjam|adade|nalla|seydi|sedhi|ilai|ilaigal|chedi|tamil|tamil-la|tamil-le|tamilil|pesu|pesunga|solla|sollunga|theriyuma|teriyuma|kuduthacha|venuma|pandra|vanga|ponga)\b/i.test(userText);
  const asksBilingual = /\b(tamil and english|both|bilingual|tanglish|tamil english)\b/i.test(userText);
  const asksTamil = /\b(tamil|tamil-la|tamilil|in tamil|speak in tamil)\b/i.test(userText);

  // Determine language mode
  const isBilingual = preferredLanguage === 'mixed' || asksBilingual || (hasTamil && /[a-zA-Z]/.test(userText));
  const isPureTamil = !isBilingual && (preferredLanguage === 'ta' || hasTamil || hasTanglish || asksTamil);

  const systemInstruction = `${PLANT_LIVE_SYSTEM_INSTRUCTION}

REAL-TIME SENSORS RIGHT NOW:
- Soil Moisture: ${moisture}%
- Light Intensity: ${light}%
- Temperature: ${temp}°C
- Humidity: ${humidity}%

CRITICAL VOICE & SPEAKING RULES (SPEAK, DO NOT READ):
1. You are PlantTalk, a sweet, charming, loving young female living houseplant companion speaking directly to your caregiver in a fluent, expressive female voice.
2. DO NOT sound like an announcer reading a weather report, news bulletin, or sensor diagnostic log.
3. DO NOT read out numbers, percentages, bullet points, asterisks, brackets, or emojis! Speak conversationally about your feelings.
4. LANGUAGE & FLUENT TAMIL INSTRUCTION:
${
  isBilingual
    ? `* Caregiver prefers BILINGUAL (Tamil + English).
- Speak 1 lively, natural sentence in authentic spoken Tamil (இயல்பான பேச்சுத் தமிழ்) FIRST, followed immediately by 1 friendly sentence in conversational English!
- Example: "வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this morning sunshine today!"
- In Tamil, always use authentic spoken colloquial Tamil ('ஹாய்!', 'அடடே!', 'எப்படி இருக்கீங்க?', 'செம ஃப்ரெஷ்ஷா இருக்குப்பா!'). NEVER use formal written textbook Tamil.`
    : isPureTamil
    ? `* Caregiver speaks Tamil or Tanglish.
- Respond 100% in natural, lively conversational spoken Tamil (இயல்பான பேச்சுத் தமிழ்: e.g. 'ஹாய்!', 'அடடே!', 'எப்படி இருக்கீங்க?', 'செம ஜாலியா இருக்குப்பா!', 'எனக்கு கொஞ்சம் தண்ணி ஊத்துறீங்களா?').
- NEVER use formal textbook written Tamil (e.g. do NOT say 'செய்யப்படுகிறது', 'காணப்படுகிறது', 'தகவல்'). Speak casually and affectionately like a sweet female houseplant friend.`
    : `* Caregiver speaks English.
- Respond in 1-2 short, warm, lively conversational English sentences with plant personality.`
}

Keep entire response to 1-2 short, punchy, conversational spoken sentences under 25 words total.`;

  const streamModels = [
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  let streamSuccess = false;
  let fullGeneratedText = '';
  let sentenceBuffer = '';

  for (const model of streamModels) {
    if (callbacks.isCancelled()) return;
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: userText }] },
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      for await (const chunk of stream) {
        if (callbacks.isCancelled()) return;
        const text = chunk.text;
        if (!text) continue;

        fullGeneratedText += text;
        sentenceBuffer += text;
        callbacks.onPartialText(cleanTextForSpeech(fullGeneratedText));

        // Check if we hit a sentence boundary: '.', '!', '?', or newline
        const sentenceMatch = sentenceBuffer.match(/^(.*?[.!?\n])\s*(.*)$/s);
        if (sentenceMatch) {
          const sentenceToSynthesize = cleanTextForSpeech(sentenceMatch[1]);
          sentenceBuffer = sentenceMatch[2] || '';

          if (sentenceToSynthesize && !callbacks.isCancelled()) {
            try {
              const audioBase64 = await generateGeminiLiveAudio(sentenceToSynthesize, apiKey, GEMINI_LIVE_VOICE);
              if (!callbacks.isCancelled()) {
                callbacks.onAudioChunk(audioBase64, sentenceToSynthesize);
              }
            } catch (err: any) {
              console.warn('[LIVE-STREAM] TTS error on chunk:', err?.message || err);
            }
          }
        }
      }

      // Synthesize any remaining sentence buffer
      const remainingSentence = cleanTextForSpeech(sentenceBuffer);
      if (remainingSentence && !callbacks.isCancelled()) {
        try {
          const audioBase64 = await generateGeminiLiveAudio(remainingSentence, apiKey, GEMINI_LIVE_VOICE);
          if (!callbacks.isCancelled()) {
            callbacks.onAudioChunk(audioBase64, remainingSentence);
          }
        } catch (err: any) {
          console.warn('[LIVE-STREAM] TTS error on final chunk:', err?.message || err);
        }
      }

      streamSuccess = true;
      if (!callbacks.isCancelled()) {
        callbacks.onComplete(cleanTextForSpeech(fullGeneratedText));
      }
      break;
    } catch (err: any) {
      console.warn(`[LIVE-STREAM] Model ${model} failed, trying next:`, err?.message || err);
    }
  }

  if (!streamSuccess && !callbacks.isCancelled()) {
    // Generate fallback text and audio
    const fallbackText = isPureTamil
      ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, என் இலைகளெல்லாம் செம ஃப்ரெஷ்ஷா இருக்குப்பா!'
      : isBilingual
      ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this sunshine today!'
      : "Hey friend! I'm feeling so fresh and happy soaking up the morning light!";

    callbacks.onPartialText(fallbackText);
    try {
      const audioBase64 = await generateGeminiLiveAudio(fallbackText, apiKey, GEMINI_LIVE_VOICE);
      callbacks.onAudioChunk(audioBase64, fallbackText);
    } catch {}
    callbacks.onComplete(fallbackText);
  }
}

export function setupLiveWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

    if (pathname === '/api/live' || pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WsWebSocket, req) => {
    logServerEvent('live', 'Client connected to Live WebSocket proxy');

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const reqApiKey = url.searchParams.get('key') || undefined;
    let sessionLang = (url.searchParams.get('lang') || 'mixed') as 'ta' | 'en' | 'mixed';

    if (!isApiKeyConfigured(reqApiKey)) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on server.' }));
      clientWs.close();
      return;
    }

    // Keep session history for contextual multi-turn conversation
    const liveHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    let activeTurnId = 0;
    let isCurrentTurnCancelled = false;

    const cancelCurrentTurn = () => {
      isCurrentTurnCancelled = true;
      activeTurnId++;
    };

    // Send ready status to client
    clientWs.send(
      JSON.stringify({
        status: 'connected',
        voice: GEMINI_LIVE_VOICE,
        model: GEMINI_LIVE_MODEL,
        language: sessionLang,
        timestamp: new Date().toISOString(),
      })
    );

    // Message handler for client interactions
    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Update preferred language dynamically if requested by client
        if (msg.type === 'setLanguage' && msg.language) {
          sessionLang = msg.language;
          return;
        }

        // Interruption event (user spoke while plant was speaking)
        if (msg.type === 'interrupt') {
          console.log('[LIVE] ⚡ User interrupted speaking!');
          cancelCurrentTurn();
          clientWs.send(JSON.stringify({ interrupted: true }));
          return;
        }

        // User spoken speech event (from microphone recognition)
        if (msg.type === 'userSpeech' && msg.text) {
          const userTranscript = msg.text.trim();
          if (!userTranscript) return;

          // If a previous turn is still generating or speaking, cancel it immediately (barge-in)
          cancelCurrentTurn();
          const thisTurnId = activeTurnId;
          isCurrentTurnCancelled = false;

          const userLang = (msg.language || sessionLang || 'mixed') as 'ta' | 'en' | 'mixed';
          logServerEvent('live-speech', `User spoke: ${userTranscript} [${userLang}]`);

          // Broadcast user transcript back to client
          clientWs.send(JSON.stringify({ userTranscript, language: userLang }));
          clientWs.send(JSON.stringify({ status: 'thinking' }));

          try {
            await streamLivePlantTurn(
              userTranscript,
              reqApiKey,
              liveHistory,
              userLang,
              {
                isCancelled: () => isCurrentTurnCancelled || thisTurnId !== activeTurnId,
                onPartialText: (textSoFar) => {
                  if (isCurrentTurnCancelled || thisTurnId !== activeTurnId) return;
                  clientWs.send(JSON.stringify({ plantTranscriptPartial: textSoFar }));
                },
                onAudioChunk: (audioBase64, sentenceText) => {
                  if (isCurrentTurnCancelled || thisTurnId !== activeTurnId) return;
                  clientWs.send(
                    JSON.stringify({
                      audio: audioBase64,
                      sentence: sentenceText,
                      status: 'speaking',
                    })
                  );
                },
                onComplete: (fullText) => {
                  if (isCurrentTurnCancelled || thisTurnId !== activeTurnId) return;
                  liveHistory.push({ role: 'user', parts: [{ text: userTranscript }] });
                  liveHistory.push({ role: 'model', parts: [{ text: fullText }] });
                  if (liveHistory.length > 10) liveHistory.splice(0, liveHistory.length - 10);
                  clientWs.send(
                    JSON.stringify({
                      plantTranscript: fullText,
                      type: 'turnComplete',
                      status: 'listening',
                    })
                  );
                },
              }
            );
          } catch (err: any) {
            logServerError('live-stream-turn', err);
            if (thisTurnId === activeTurnId && !isCurrentTurnCancelled) {
              const fallback =
                userLang === 'ta'
                  ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, என் இலைகளெல்லாம் செம ஃப்ரெஷ்ஷா இருக்குப்பா!'
                  : userLang === 'mixed'
                  ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this sunshine today!'
                  : "Hey friend! I'm feeling so fresh and happy soaking up the morning light!";
              clientWs.send(
                JSON.stringify({
                  plantTranscript: fallback,
                  audioFailed: true,
                  status: 'listening',
                })
              );
            }
          }
        }

        // Tool response forwarding
        if (msg.type === 'toolResponse' && msg.id && msg.name) {
          // Handled if tool callbacks invoked
        }
      } catch (err) {
        logServerError('live-client-input', err);
      }
    });

    clientWs.on('close', () => {
      logServerEvent('live', 'Client disconnected from Live WebSocket');
      cancelCurrentTurn();
    });
  });

  return wss;
}
