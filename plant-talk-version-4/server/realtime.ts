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
 * Package raw 16-bit 16kHz PCM frames into a standard WAV buffer for Gemini audio processing
 */
function pcm16ToWav(pcm16Buffers: Buffer[], sampleRate: number = 16000): Buffer {
  const dataLength = pcm16Buffers.reduce((sum, b) => sum + b.length, 0);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (SampleRate * NumChannels * BitsPerSample/8)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // 16 bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, ...pcm16Buffers]);
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

/**
 * Generate plant response directly from microphone audio (Tamil/Tanglish/English)
 */
async function generateLivePlantReplyFromAudio(
  wavBuffer: Buffer,
  apiKey?: string,
  conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): Promise<{ replyText: string; userTranscript?: string }> {
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
1. Listen carefully to user speech in English, Sri Lankan Tamil, or Tanglish.
2. If user speaks Tamil or Tanglish: Respond naturally in SPOKEN TAMIL (இயல்பான பேச்சுத் தமிழ்) using Tamil script. Do NOT translate into English.
3. If user speaks English: Respond in warm, cheerful, botanical English.
4. Speak in 1-2 short, lively sentences as the living plant companion Ferny.`;

  const audioBase64 = wavBuffer.toString('base64');
  const chatModels = [GEMINI_CHAT_MODEL, 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

  for (const model of chatModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          ...conversationHistory,
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: audioBase64,
                },
              },
              {
                text: 'Listen to the audio above. Transcribe what the user said if clearly audible, then reply directly as the living plant Ferny following the instructions.',
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (replyText) {
        return { replyText };
      }
    } catch (err: any) {
      console.warn(`[LIVE-AUDIO-REPLY] Model ${model} failed, trying next:`, err?.message || err);
    }
  }

  return { replyText: 'வணக்கம்! நான் நலமாக இருக்கிறேன். என் இலைகளுக்கு நல்ல வெளிச்சமும் வேர்களுக்கு ஈரப்பதமும் கிடைக்குது! 🌱' };
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

  wss.on('connection', (clientWs: WsWebSocket, req) => {
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

    // Audio buffers
    let audioBuffer: Buffer[] = [];
    let silenceChunks = 0;
    let speakingDetected = false;
    let isProcessingAudio = false;
    let audioChunkCount = 0;
    let session: any = null;
    let isConnectingSession = true;
    let isClientClosed = false;
    const pendingAudioChunks: string[] = [];

    // Message handler for client interactions - REGISTERED IMMEDIATELY
    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 1. Raw audio streaming from client mic
        if (msg.type === 'audio' && msg.audio) {
          audioChunkCount++;
          const pcmChunk = Buffer.from(msg.audio, 'base64');

          // Compute chunk RMS (16-bit signed integers)
          let sum = 0;
          const sampleCount = pcmChunk.length / 2;
          for (let i = 0; i < pcmChunk.length; i += 2) {
            const sample = pcmChunk.readInt16LE(i);
            sum += sample * sample;
          }
          const rms = Math.sqrt(sum / sampleCount);

          if (audioChunkCount === 1) {
            console.log(`[LIVE] Mic audio streaming started (chunk size: ${pcmChunk.length} bytes, rms: ${Math.round(rms)})`);
          } else if (audioChunkCount % 50 === 0) {
            console.log(`[LIVE] Mic streaming active (chunk #${audioChunkCount}, rms: ${Math.round(rms)}, session: ${session ? 'bidi' : isConnectingSession ? 'connecting' : 'fallback'})`);
          }

          if (isConnectingSession) {
            if (pendingAudioChunks.length < 30) {
              pendingAudioChunks.push(msg.audio);
            }
          } else if (session) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } catch (err: any) {
              console.warn('[LIVE] Failed to forward audio to bidi session:', err?.message);
            }
          }

          // Voice activity detection & speech turn monitoring
          if (rms > 320) {
            speakingDetected = true;
            silenceChunks = 0;
            audioBuffer.push(pcmChunk);
          } else if (speakingDetected) {
            audioBuffer.push(pcmChunk);
            silenceChunks++;

            // ~650ms of silence after speaking (each chunk is ~128ms)
            if (silenceChunks >= 5 && audioBuffer.length >= 6) {
              speakingDetected = false;
              silenceChunks = 0;

              if (session) {
                // Signal turn boundary to Gemini Live Bidi
                try {
                  session.sendRealtimeInput({
                    audioStreamEnd: true,
                  });
                  console.log('[LIVE] Speech burst ended -> sent audioStreamEnd to Gemini Live');
                } catch (err: any) {
                  console.warn('[LIVE] audioStreamEnd failed:', err?.message);
                }
              } else if (!isProcessingAudio) {
                // Streaming audio pipeline fallback when bidi session is offline
                isProcessingAudio = true;
                const capturedChunks = [...audioBuffer];
                audioBuffer = [];
                console.log(`[LIVE] Processing speech burst via fallback pipeline (${capturedChunks.length} chunks)...`);

                (async () => {
                  try {
                    const fullWav = pcm16ToWav(capturedChunks, 16000);
                    const { replyText, userTranscript } = await generateLivePlantReplyFromAudio(
                      fullWav,
                      reqApiKey,
                      liveHistory
                    );

                    if (userTranscript) {
                      clientWs.send(JSON.stringify({ userTranscript }));
                    }

                    liveHistory.push({ role: 'user', parts: [{ text: userTranscript || '(Spoken voice input)' }] });
                    liveHistory.push({ role: 'model', parts: [{ text: replyText }] });
                    if (liveHistory.length > 10) liveHistory.splice(0, liveHistory.length - 10);

                    clientWs.send(JSON.stringify({ plantTranscript: replyText, turnComplete: true }));

                    try {
                      const audioBase64 = await generateGeminiLiveAudio(replyText, reqApiKey, GEMINI_LIVE_VOICE);
                      clientWs.send(JSON.stringify({ audio: audioBase64 }));
                    } catch (audioErr: any) {
                      console.warn('[LIVE] Audio synthesis fallback:', audioErr?.message);
                    }
                  } catch (err: any) {
                    logServerError('live-audio-process-error', err);
                  } finally {
                    isProcessingAudio = false;
                  }
                })();
              }
            }
          }
        }

        // 2. User spoken text event (direct transcription compatibility)
        if (msg.type === 'userSpeech' && msg.text) {
          const userTranscript = msg.text.trim();
          if (!userTranscript) return;

          logServerEvent('live-speech', `User spoke: ${userTranscript}`);
          clientWs.send(JSON.stringify({ userTranscript }));

          if (session) {
            try {
              session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: userTranscript }] }],
                turnComplete: true,
              });
              return;
            } catch (err: any) {
              console.warn('[LIVE] session.sendClientContent failed, using fallback:', err?.message);
            }
          }

          try {
            const replyText = await generateLivePlantReply(userTranscript, reqApiKey, liveHistory);

            liveHistory.push({ role: 'user', parts: [{ text: userTranscript }] });
            liveHistory.push({ role: 'model', parts: [{ text: replyText }] });
            if (liveHistory.length > 10) liveHistory.splice(0, liveHistory.length - 10);

            clientWs.send(JSON.stringify({ plantTranscript: replyText, turnComplete: true }));

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

        // 4. Interrupt / Barge-in event
        if (msg.type === 'interrupt') {
          audioBuffer = [];
          speakingDetected = false;
          silenceChunks = 0;
          clientWs.send(JSON.stringify({ interrupted: true }));
        }
      } catch (err) {
        logServerError('live-client-input', err);
      }
    });

    clientWs.on('close', () => {
      isClientClosed = true;
      logServerEvent('live', 'Client disconnected from Live WebSocket');
      if (session) {
        try {
          session.close();
        } catch {}
        session = null;
      }
      audioBuffer = [];
      speakingDetected = false;
    });

    // Establish Google Bidi live session in background
    (async () => {
      const liveCandidateModels = [
        GEMINI_LIVE_MODEL,
        'gemini-3.1-flash-live-preview',
        'gemini-2.5-flash-native-audio-latest',
        'gemini-3.8-live',
      ].filter(Boolean);

      let activeModel = GEMINI_LIVE_MODEL;

      for (const candidateModel of liveCandidateModels) {
        if (session || isClientClosed) break;
        try {
          const ai = getGemini(reqApiKey);
          session = await ai.live.connect({
            model: candidateModel,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE },
                },
              },
              systemInstruction: {
                parts: [{ text: PLANT_LIVE_SYSTEM_INSTRUCTION }],
              },
              tools: [{ functionDeclarations: PLANT_LIVE_TOOLS as any }],
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                try {
                  // 1. Spoken audio chunks from Gemini
                  const parts = message.serverContent?.modelTurn?.parts;
                  if (parts) {
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                      }
                    }
                  }

                  // 2. Output speech transcription from Gemini Live (prefer outputTranscription over parts text to prevent duplicate tokens)
                  const outputText = message.serverContent?.outputTranscription?.text;
                  if (outputText) {
                    clientWs.send(JSON.stringify({ plantTranscript: outputText }));
                  } else if (parts) {
                    for (const part of parts) {
                      if (part.text) {
                        clientWs.send(JSON.stringify({ plantTranscript: part.text }));
                      }
                    }
                  }

                  // 3. User speech transcription from Gemini Live
                  const inputText = (message.serverContent as any)?.inputTranscription?.text;
                  if (inputText) {
                    clientWs.send(JSON.stringify({ userTranscript: inputText }));
                  }

                  // 4. Interruption event
                  if (message.serverContent?.interrupted) {
                    clientWs.send(JSON.stringify({ interrupted: true }));
                  }

                  // 5. Turn Complete event
                  if (message.serverContent?.turnComplete) {
                    clientWs.send(JSON.stringify({ turnComplete: true }));
                  }

                  // 5. Tool / Function call
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
                console.warn(`[BIDI-LIVE] Stream warning for model ${candidateModel}:`, err?.message || err);
              },
              onclose: (e: any) => {
                console.log('[BIDI-LIVE] Stream closed:', e?.code, e?.reason);
                session = null;
              },
            },
          });
          activeModel = candidateModel;
          console.log(`✅ Google Bidi Live session established with model: ${candidateModel} and voice: ${GEMINI_LIVE_VOICE}`);
          break;
        } catch (err: any) {
          console.log(`[LIVE] Model ${candidateModel} bidi connect attempt failed:`, err?.message || err);
        }
      }

      isConnectingSession = false;

      if (!isClientClosed && clientWs.readyState === WsWebSocket.OPEN) {
        // Drain any pending audio chunks
        if (session && pendingAudioChunks.length > 0) {
          console.log(`[LIVE] Forwarding ${pendingAudioChunks.length} pre-buffered audio chunks to session...`);
          for (const chunk of pendingAudioChunks) {
            try {
              session.sendRealtimeInput({
                audio: { data: chunk, mimeType: 'audio/pcm;rate=16000' },
              });
            } catch {}
          }
          pendingAudioChunks.length = 0;
        }

        // Notify client session is ready
        clientWs.send(
          JSON.stringify({
            status: 'connected',
            voice: GEMINI_LIVE_VOICE,
            model: session ? activeModel : 'live-voice-streaming',
            timestamp: new Date().toISOString(),
          })
        );
      }
    })();
  });

  return wss;
}
