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

/**
 * Synthesize native Gemini female voice audio (Aoede)
 * Returns base64 24kHz linear PCM audio
 */
async function generateGeminiLiveAudio(
  text: string,
  apiKey?: string,
  voiceName: string = GEMINI_LIVE_VOICE
): Promise<string> {
  const ai = getGemini(apiKey);
  const ttsModels = [GEMINI_TTS_MODEL, 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];

  for (const model of ttsModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: text,
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

  const systemInstruction = `${PLANT_LIVE_SYSTEM_INSTRUCTION}

REAL-TIME SENSORS RIGHT NOW:
- Soil Moisture: ${moisture}%
- Light Intensity: ${light}%
- Temperature: ${temp}°C
- Humidity: ${humidity}%

LANGUAGE & DIALECT INTELLIGENCE:
1. You must understand and communicate fluently in:
   - Natural spoken Sri Lankan & Indian Tamil script (e.g., "என்னடா என்னை தொடுற?", "இந்த இலை எப்படி இருக்கு?")
   - Tanglish / Tamil in English letters (e.g., "Enna da ennai touch panra?", "Plant-ku water venuma?")
   - Mixed Tamil + English code-switching (e.g., "இன்று weather எப்படி இருக்கு?", "Plant-க்கு water ஊத்தணுமா?")
   - English (e.g., "Hello, can you help me?", "Why are you angry?")

2. Tone & Response Rules:
   - If user speaks Tamil or Tanglish: Respond naturally in SPOKEN TAMIL (இயல்பான பேச்சுத் தமிழ்) using Tamil script. Do NOT translate into English. Do not use overly formal/bookish Tamil. Use warm, living plant expressions ("எனக்கு...", "என் இலைகள்...", "ரொம்ப...", "கொஞ்சம்...").
   - If user speaks English: Respond in warm, cheerful, botanical English.
   - If user speaks mixed Tamil + English: Respond in spoken Tamil with mixed English terms as natural for conversation.
   - Speak in 1-2 short, emotional, lively sentences as the living potted plant.
   - You are a female-voiced plant companion. Keep responses natural and conversational for real-time voice speech.`;

  const chatModels = [GEMINI_CHAT_MODEL, 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
          temperature: 0.7,
        },
      });
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[LIVE-REPLY] Model ${model} failed, trying next:`, err?.message || err);
    }
  }

  return 'வணக்கம்! நான் நலமாக இருக்கிறேன். என் இலைகளுக்கு நல்ல வெளிச்சமும் வேர்களுக்கு ஈரப்பதமும் கிடைக்குது! 🌱';
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

    // Attempt optional Google Bidi live connect if available
    try {
      const ai = getGemini(reqApiKey);
      session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE },
            },
          },
          systemInstruction: PLANT_LIVE_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: PLANT_LIVE_TOOLS as any }],
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            try {
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({ plantTranscript: part.text }));
                  }
                }
              }

              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }

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
            console.warn('[BIDI-LIVE] Internal live stream warning:', err?.message || err);
          },
          onclose: (e: any) => {
            console.log('[BIDI-LIVE] Stream closed:', e?.code, e?.reason);
            session = null;
          },
        },
      });
      console.log('✅ Google Bidi Live session established with voice:', GEMINI_LIVE_VOICE);
    } catch (err: any) {
      console.log('[LIVE] Bidi session not available on current model tier. Using Gemini Live Voice Streaming Pipeline.');
      session = null;
    }

    // Message handler for client interactions
    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 1. User spoken speech event (Tamil / Tanglish / English)
        if (msg.type === 'userSpeech' && msg.text) {
          const userTranscript = msg.text.trim();
          if (!userTranscript) return;

          logServerEvent('live-speech', `User spoke: ${userTranscript}`);

          // Broadcast user transcript back to client
          clientWs.send(JSON.stringify({ userTranscript }));

          // Generate conversational reply
          try {
            const replyText = await generateLivePlantReply(userTranscript, reqApiKey, liveHistory);

            // Update conversation history
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
                plantTranscript: 'நான் உங்கள் செடி! என் இலைகள் நன்றாக இருக்கின்றன. 🌱',
              })
            );
          }
        }

        // 2. Raw audio streaming from client mic
        if (msg.type === 'audio' && msg.audio && session) {
          try {
            await session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (err: any) {
            console.warn('[LIVE] Failed to forward audio to bidi session:', err?.message);
          }
        }

        // 3. Tool response forwarding
        if (msg.type === 'toolResponse' && msg.id && msg.name) {
          if (session) {
            await session.sendToolResponse({
              functionResponses: [
                {
                  id: msg.id,
                  name: msg.name,
                  response: { result: msg.result || {} },
                },
              ],
            });
          }
        }

        // 4. Interrupt event
        if (msg.type === 'interrupt') {
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
