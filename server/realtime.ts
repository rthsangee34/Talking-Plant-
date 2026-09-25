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
    'gemini-2.5-flash-preview-tts',
    'gemini-3.8-flash-tts',
    GEMINI_TTS_MODEL,
    'gemini-3.1-flash-tts-preview',
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
      const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) return audioData;
    } catch (err: any) {
      console.warn(`[LIVE-TTS] Model ${model} failed, trying fallback:`, err?.message || err);
    }
  }

  throw new Error('Could not synthesize speech audio from Gemini');
}

/**
 * Generate plant response for live conversation with Tamil/Tanglish/English intelligence
 */
async function generateLivePlantReply(
  userText: string,
  apiKey?: string,
  conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): Promise<string> {
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

  const systemInstruction = `${PLANT_LIVE_SYSTEM_INSTRUCTION}

REAL-TIME SENSORS RIGHT NOW:
- Soil Moisture: ${moisture}%
- Light Intensity: ${light}%
- Temperature: ${temp}°C
- Humidity: ${humidity}%

CRITICAL VOICE & SPEAKING RULES (SPEAK, DO NOT READ):
1. You are SPEAKING OUT LOUD to your caregiver. DO NOT sound like an announcer reading a weather report, news bulletin, or sensor diagnostic log.
2. DO NOT read out numbers, percentages, bullet points, asterisks, brackets, or emojis! Speak conversationally about your feelings (e.g., "my soil is nice and moist", "this sunshine feels wonderful").
3. BILINGUAL & LANGUAGE DELIVERY:
${
  asksBilingual || (hasTamil && /[a-zA-Z]/.test(userText))
    ? `* Caregiver wants BILINGUAL (Tamil + English). Speak 1 lively sentence in natural spoken Tamil (இயல்பான பேச்சுத் தமிழ்), followed immediately by 1 friendly sentence in conversational English!
  Example: "வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this morning sunshine today!"`
    : hasTamil || hasTanglish
    ? `* Caregiver speaks Tamil or Tanglish. Respond 100% in natural, lively conversational spoken Tamil (இயல்பான பேச்சுத் தமிழ்: e.g. 'ஹாய்!', 'அடடே!', 'எப்படி இருக்கீங்க?', 'செம ஜாலியா இருக்கு!'). NEVER use formal written textbook Tamil.`
    : `* Caregiver speaks English. Respond in 1-2 short, warm, lively conversational English sentences with plant personality.`
}

Keep entire response to 1-2 short, punchy, conversational spoken sentences.`;

  const chatModels = [
    GEMINI_CHAT_MODEL,
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  for (const model of chatModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: userText }] },
        ],
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return cleanTextForSpeech(text);
    } catch (err: any) {
      console.warn(`[LIVE-REPLY] Model ${model} failed, trying next:`, err?.message || err);
    }
  }

  return hasTamil || hasTanglish
    ? 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்! Hey friend, loving this sunshine today!'
    : "Hey friend! I'm feeling so fresh and happy soaking up the morning light!";
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

    if (!isApiKeyConfigured(reqApiKey)) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on server.' }));
      clientWs.close();
      return;
    }

    // Keep session history for contextual multi-turn conversation
    const liveHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    let currentPlantTurnText = '';
    let currentUserTurnText = '';

    // Send ready status to client
    clientWs.send(
      JSON.stringify({
        status: 'connected',
        voice: GEMINI_LIVE_VOICE,
        model: GEMINI_LIVE_MODEL,
        timestamp: new Date().toISOString(),
      })
    );

    let session: any = null;

    // Connect to Google Gemini Multimodal Live API
    const liveCandidateModels = [
      GEMINI_LIVE_MODEL,
      'gemini-3.1-flash-live-preview',
      'gemini-2.5-flash-native-audio-latest',
      'gemini-3.8-live',
    ];

    const ai = getGemini(reqApiKey);
    const plantState = getPlantState();
    const s = plantState.sensors;
    const moisture = Math.round(s?.soilMoisture ?? 58);
    const light = Math.round(s?.light ?? 65);
    const temp = Math.round(s?.temperature ?? 26);
    const humidity = Math.round(s?.humidity ?? 62);

    const liveSystemInstruction = `${PLANT_LIVE_SYSTEM_INSTRUCTION}

REAL-TIME SENSORS RIGHT NOW:
- Soil Moisture: ${moisture}%
- Light Intensity: ${light}%
- Temperature: ${temp}°C
- Humidity: ${humidity}%

CRITICAL VOICE & SPEAKING RULES (SPEAK, DO NOT READ):
1. You are SPEAKING OUT LOUD to your caregiver in real-time voice, NOT reading a text, book, or weather bulletin.
2. DO NOT read out numbers, percentages, bullet points, asterisks, brackets, or emojis! Speak conversationally about your feelings (e.g. "my roots are nice and hydrated", "loving this morning light").
3. LANGUAGE & BILINGUAL INTELLIGENCE:
   - When the caregiver speaks Tamil, Tanglish, or asks for Tamil and English: Respond warmly with 1 lively sentence in natural spoken Tamil (இயல்பான பேச்சுத் தமிழ்), followed immediately by 1 friendly sentence in conversational English (e.g., 'வணக்கம்! நல்ல வெயில் அடிக்குது, செம ஃப்ரெஷ்ஷா இருக்கேன்ப்பா! Hey friend, loving this sunshine today!').
   - If the caregiver communicates only in pure Tamil: Respond in 1-2 short, warm sentences of authentic spoken colloquial Tamil. Never use formal written textbook Tamil.
   - If the caregiver communicates in English: Respond in 1-2 short, warm, lively conversational English sentences.
4. Tone & Delivery:
   - Speak in 1-2 short, punchy, conversational sentences with cute living plant personality.`;

    for (const modelToTry of liveCandidateModels) {
      try {
        session = await ai.live.connect({
          model: modelToTry,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: liveSystemInstruction,
            tools: [{ functionDeclarations: PLANT_LIVE_TOOLS as any }],
          },
          callbacks: {
            onopen: () => {
              console.log(`✅ [BIDI-LIVE] Session established on ${modelToTry} with voice ${GEMINI_LIVE_VOICE}`);
            },
            onmessage: (message: any) => {
              try {
                // 1. Audio chunks (24kHz linear PCM)
                const parts = message.serverContent?.modelTurn?.parts;
                if (parts) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                    }
                  }
                }

                // 2. Output transcript streaming (spoken by plant)
                if (message.serverContent?.outputTranscription?.text) {
                  currentPlantTurnText += message.serverContent.outputTranscription.text;
                  clientWs.send(
                    JSON.stringify({
                      plantTranscriptPartial: currentPlantTurnText,
                    })
                  );
                }

                // 3. User input transcript streaming (detected from user mic audio)
                if (message.serverContent?.inputTranscription?.text) {
                  currentUserTurnText += message.serverContent.inputTranscription.text;
                }

                // 4. Turn completion: finalize transcripts and history
                if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
                  if (currentPlantTurnText.trim()) {
                    clientWs.send(
                      JSON.stringify({
                        plantTranscript: currentPlantTurnText.trim(),
                      })
                    );
                    if (currentUserTurnText.trim()) {
                      clientWs.send(
                        JSON.stringify({
                          userTranscript: currentUserTurnText.trim(),
                        })
                      );
                      liveHistory.push({ role: 'user', parts: [{ text: currentUserTurnText.trim() }] });
                    }
                    liveHistory.push({ role: 'model', parts: [{ text: currentPlantTurnText.trim() }] });
                    if (liveHistory.length > 10) liveHistory.splice(0, liveHistory.length - 10);
                  }
                  currentPlantTurnText = '';
                  currentUserTurnText = '';
                }

                // 5. Interrupted event (user started speaking while plant was speaking)
                if (message.serverContent?.interrupted) {
                  currentPlantTurnText = '';
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }

                // 6. Tool / Function calls
                const toolCall = message.toolCall;
                if (toolCall?.functionCalls) {
                  for (const call of toolCall.functionCalls) {
                    clientWs.send(
                      JSON.stringify({
                        toolCall: {
                          id: call.id,
                          name: call.name,
                          args: call.args,
                        },
                      })
                    );
                  }
                }
              } catch (err) {
                logServerError('live-message', err);
              }
            },
            onerror: (err: any) => {
              console.warn(`[BIDI-LIVE] Warning on ${modelToTry}:`, err?.message || err);
            },
            onclose: (e: any) => {
              console.log(`[BIDI-LIVE] Stream closed on ${modelToTry}:`, e?.code, e?.reason);
              session = null;
            },
          },
        });
        if (session) break;
      } catch (err: any) {
        console.warn(`[LIVE] Model ${modelToTry} connect failed, trying next candidate:`, err?.message || err);
        session = null;
      }
    }

    if (!session) {
      console.log('[LIVE] Live session active in streaming pipeline mode.');
    }

    // Message handler for client interactions
    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 1. Raw audio streaming from client mic
        if (msg.type === 'audio' && msg.audio) {
          if (session) {
            try {
              session.sendRealtimeInput({
                media: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } catch (err: any) {
              console.warn('[LIVE] Failed to forward audio to live session:', err?.message);
            }
          }
        }

        // 2. User spoken speech event (from browser recognition or user transcript)
        if (msg.type === 'userSpeech' && msg.text) {
          const userTranscript = msg.text.trim();
          if (!userTranscript) return;

          logServerEvent('live-speech', `User spoke: ${userTranscript}`);

          // Broadcast user transcript back to client
          clientWs.send(JSON.stringify({ userTranscript }));

          // If Gemini Live session is connected, send turn to Live API
          if (session) {
            try {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: userTranscript }],
                  },
                ],
                turnComplete: true,
              });
              return;
            } catch (sendErr: any) {
              console.warn('[LIVE] sendClientContent fallback:', sendErr?.message);
            }
          }

          // Fallback pipeline if session is not active
          try {
            const replyText = await generateLivePlantReply(userTranscript, reqApiKey, liveHistory);

            liveHistory.push({ role: 'user', parts: [{ text: userTranscript }] });
            liveHistory.push({ role: 'model', parts: [{ text: replyText }] });
            if (liveHistory.length > 10) liveHistory.splice(0, liveHistory.length - 10);

            // Send plant transcript
            clientWs.send(JSON.stringify({ plantTranscript: replyText }));

            // Synthesize Gemini native female audio
            try {
              const audioBase64 = await generateGeminiLiveAudio(replyText, reqApiKey, GEMINI_LIVE_VOICE);
              clientWs.send(JSON.stringify({ audio: audioBase64 }));
            } catch (audioErr: any) {
              console.warn('[LIVE] Audio synthesis fallback:', audioErr?.message);
            }
          } catch (err: any) {
            logServerError('live-reply-error', err);
            clientWs.send(
              JSON.stringify({
                plantTranscript: 'வணக்கம்! நான் உங்கள் செடி! என் இலைகள் நன்றாக இருக்கின்றன. 🌱',
              })
            );
          }
        }

        // 3. Tool response forwarding
        if (msg.type === 'toolResponse' && msg.id && msg.name) {
          if (session) {
            try {
              session.sendToolResponse({
                functionResponses: [
                  {
                    id: msg.id,
                    name: msg.name,
                    response: { result: msg.result || {} },
                  },
                ],
              });
            } catch (toolErr: any) {
              console.warn('[LIVE] Tool response error:', toolErr?.message);
            }
          }
        }

        // 4. Interrupt event
        if (msg.type === 'interrupt') {
          currentPlantTurnText = '';
          clientWs.send(JSON.stringify({ interrupted: true }));
        }
      } catch (err) {
        logServerError('live-client-input', err);
      }
    });

    clientWs.on('close', () => {
      logServerEvent('live', 'Client disconnected from Live WebSocket');
      if (session) {
        try {
          session.close();
        } catch {}
        session = null;
      }
    });
  });

  return wss;
}
