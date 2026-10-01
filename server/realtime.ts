import { Server } from 'http';
import { Request, Response } from 'express';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { Modality, type FunctionDeclaration, type Session } from '@google/genai';
import { getGemini, isApiKeyConfigured, GEMINI_LIVE_MODEL, GEMINI_LIVE_VOICE } from './gemini';
import { PLANT_LIVE_SYSTEM_INSTRUCTION } from '../src/lib/plant/prompts';
import { PLANT_LIVE_TOOLS } from '../src/lib/plant/realtime-config';
import { getPlantState } from './plant-state';

export async function handleLiveTokenRequest(req: Request, res: Response): Promise<void> {
  const reqApiKey = (req.headers['x-gemini-api-key'] as string | undefined) || (req.query.key as string | undefined);
  if (!isApiKeyConfigured(reqApiKey)) {
    res.status(401).json({
      error: 'GEMINI_API_KEY_REQUIRED',
      message: 'GEMINI_API_KEY environment variable is not configured.',
    });
    return;
  }

  try {
    const ai = getGemini(reqApiKey);
    let ephemeralToken: string | null = null;
    try {
      const token = await ai.authTokens.create({});
      if (token?.name) {
        ephemeralToken = token.name;
      }
    } catch {
      // Gracefully fall back to backend proxy if ephemeral tokens are not enabled on this key
    }

    res.json({
      status: 'ready',
      token: ephemeralToken,
      model: GEMINI_LIVE_MODEL,
      voice: GEMINI_LIVE_VOICE,
      webSocketPath: '/api/live',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'TOKEN_CREATION_FAILED',
      message: err?.message || 'Could not initialize live session.',
    });
  }
}

/** Optional Node backend. Firebase Hosting users connect directly with their own key. */
export function setupLiveWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', 'http://localhost').pathname;
    if (pathname === '/api/live' || pathname === '/live') {
      wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
    }
  });

  wss.on('connection', async (clientWs: WsWebSocket, request) => {
    const url = new URL(request.url || '', 'http://localhost');
    const key = url.searchParams.get('key') || undefined;
    const language = ['en', 'ta', 'mixed'].includes(url.searchParams.get('lang') || '')
      ? url.searchParams.get('lang') : 'mixed';
    let session: Session | null = null;
    let closed = false;
    let setupComplete = false;
    let ready = false;
    const send = (message: unknown) => {
      if (!closed && clientWs.readyState === WsWebSocket.OPEN) clientWs.send(JSON.stringify(message));
    };
    const close = () => {
      closed = true;
      clearTimeout(timer);
      session?.close();
      session = null;
    };
    const fail = (message: string) => {
      if (closed) return;
      send({ error: message });
      close();
      clientWs.close(1011, 'Live session unavailable');
    };
    const timer = setTimeout(() => fail('Gemini Live did not become ready. Please try again.'), 15000);
    const markReady = () => {
      // SDK connect() resolves on socket open; setupComplete can arrive before
      // or after that promise. Both are required before accepting microphone PCM.
      if (closed || ready || !session || !setupComplete) return;
      ready = true;
      clearTimeout(timer);
      send({ status: 'listening' });
    };
    clientWs.on('close', close);
    clientWs.on('error', close);
    clientWs.on('message', data => {
      if (!ready || !session || closed) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio' && typeof msg.audio === 'string') {
          const mimeType = /^audio\/pcm;rate=\d+$/.test(msg.mimeType || '') ? msg.mimeType : 'audio/pcm;rate=16000';
          session.sendRealtimeInput({ audio: { data: msg.audio, mimeType } });
        } else if (msg.type === 'audioStreamEnd') {
          session.sendRealtimeInput({ audioStreamEnd: true });
        } else if (msg.type === 'toolResponse' && msg.id && msg.name) {
          session.sendToolResponse({ functionResponses: [{ id: msg.id, name: msg.name, response: { output: msg.result } }] });
        } else if (msg.type === 'userSpeech' && typeof msg.text === 'string') {
          session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.text }] }], turnComplete: true });
        } else if (msg.type === 'contextUpdate' && msg.context) {
          session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: `[System Update: Current plant state: ${JSON.stringify(msg.context)}]` }] }], turnComplete: false });
        }
      } catch {
        fail('Unable to send microphone audio to Gemini Live. Please try again.');
      }
    });

    if (!isApiKeyConfigured(key)) {
      fail('Connect your Gemini API key on the setup screen to start Live Speaking.');
      return;
    }
    try {
      const connectedSession = await getGemini(key).live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_LIVE_VOICE } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: { parts: [{ text: PLANT_LIVE_SYSTEM_INSTRUCTION +
            '\nCurrent readings: ' + JSON.stringify(getPlantState().sensors) +
            '\nPreferred language: ' + language + '. Wait for the caregiver to speak; then reply naturally in their language.' }] },
          tools: [{ functionDeclarations: PLANT_LIVE_TOOLS as FunctionDeclaration[] }],
        },
        callbacks: {
          onmessage: message => {
            if (message.setupComplete) { setupComplete = true; markReady(); }
            // Forward native transcripts, PCM, interruptions and tool IDs intact.
            if (message.serverContent || message.toolCall) send(message);
          },
          onerror: () => fail('Gemini Live encountered a connection error. Check your key and quota.'),
          onclose: event => {
            if (closed) return;
            if (event.code !== 1000) {
              fail(event.reason || 'Gemini Live disconnected. Check model access and quota.');
            } else {
              session = null;
              close();
              clientWs.close(1000);
            }
          },
        },
      });
      if (closed) { connectedSession.close(); return; }
      session = connectedSession;
      markReady();
    } catch {
      fail('Unable to start Gemini Live. Check the API key, model access and quota.');
    }
  });
  return wss;
}
