import { Request, Response } from 'express';
import { getGemini, ensureApiKey, GEMINI_VISION_MODEL } from './gemini';
import { PLANT_OBSERVATION_SYSTEM_PROMPT } from '../src/lib/plant/prompts';
import { PlantObservationSchema } from '../src/lib/plant/schemas';
import { logServerError } from '../src/lib/api/response-logging';
import { Type } from '@google/genai';
import { updateSensors, updateObservation, updateImage } from './plant-state';
import { sanitizePlantVoiceResponse } from '../src/lib/plant/voice-translator';
import { getPlantDialogue, PlantPersonality } from '../src/lib/plant/personality';

export async function handleObserveRequest(req: Request, res: Response): Promise<void> {
  const reqApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  if (!ensureApiKey(res, reqApiKey)) return;

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendNdjson = (obj: unknown) => {
    res.write(JSON.stringify(obj) + '\n');
  };

  try {
    sendNdjson({ type: 'status', message: 'Capturing sensor telemetry and webcam frame...' });

    const {
      imageUrl,
      moisture = 50,
      light = 60,
      temperature = null,
      humidity = null,
      co2 = null,
      historySummary = '',
    } = req.body || {};

    sendNdjson({ type: 'status', message: 'Analyzing visual evidence and comparing with sensor readings...' });

    const ai = getGemini(reqApiKey);

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }

    const promptText = `
Perform a plant observation using the camera frame and current physical sensor readings:
- Soil Moisture: ${moisture}%
- Light Level: ${light}%
- Temperature: ${temperature !== null ? `${temperature}°C` : 'N/A (sensor disabled)'}
- Humidity: ${humidity !== null ? `${humidity}%` : 'N/A (sensor disabled)'}
- CO2: ${co2 !== null ? `${co2} ppm` : 'N/A (sensor disabled)'}

Recent observation history summary:
${historySummary || 'No previous observations.'}

Provide a structured response. Distinguish clearly between visual evidence (from image) and physical sensor evidence.
`;

    parts.push({ text: promptText });

    sendNdjson({ type: 'status', message: 'Synthesizing botanical findings...' });

    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: { parts },
      config: {
        systemInstruction: PLANT_OBSERVATION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visualEvidence: { type: Type.STRING, description: 'Visual appearance observed strictly in camera frame.' },
            sensorEvidence: { type: Type.STRING, description: 'Summary of physical telemetry sensor data.' },
            interpretation: { type: Type.STRING, description: 'Botanical interpretation linking sensors with visuals.' },
            healthStatus: { type: Type.STRING, description: 'Thriving, Good, Needs Attention, or Critical.' },
            urgentNeeds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Urgent care actions required.' },
            sensoryNote: { type: Type.STRING, description: 'Optional. Kept for fallback backwards compatibility.' },
            conditionKey: { type: Type.STRING, description: 'Key representing plant condition (e.g., needWater, happyAndHealthy)' },
            personalityTone: { type: Type.STRING, description: 'Selected tone (e.g., humorous, playful, gentle)' },
            actionRequired: { type: Type.BOOLEAN, description: 'Whether caregiver action is immediately needed.' },
          },
          required: ['visualEvidence', 'sensorEvidence', 'interpretation', 'healthStatus', 'conditionKey', 'personalityTone'],
        },
      },
    });

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      throw new Error('Gemini returned an empty observation response.');
    }

    let parsedJson: unknown;
    try {
      const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
      parsedJson = JSON.parse(cleanJson);
    } catch {
      throw new Error('Failed to parse Gemini JSON response.');
    }

    const parseResult = PlantObservationSchema.safeParse({
      ...((parsedJson as object) || {}),
      id: `obs-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      moisture,
      light,
      temperature,
      humidity,
      co2,
      imageUrl: imageUrl || undefined,
    });

    if (parseResult.success) {
      const sanitizedSensoryNote = sanitizePlantVoiceResponse(parseResult.data.sensoryNote || '');
      const finalData = { ...parseResult.data, sensoryNote: sanitizedSensoryNote };

      sendNdjson({ type: 'final', data: finalData });

      // Push to server-side shared state for WhatsApp & alert engine
      updateSensors({
        soilMoisture: moisture,
        light,
        temperature: temperature ?? undefined,
        humidity: humidity ?? undefined,
        co2: co2 ?? undefined,
      });
      updateObservation({
        overallCondition: parseResult.data.healthStatus,
        sensoryNote: sanitizedSensoryNote,
        visualEvidence: parseResult.data.visualEvidence,
        recommendedAction: parseResult.data.urgentNeeds?.[0],
        capturedAt: new Date().toISOString(),
      });

      // Store image buffer for WhatsApp PHOTO command
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
        const imgParts = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (imgParts) {
          updateImage(Buffer.from(imgParts[2], 'base64'), imgParts[1]);
        }
      }
    } else {
      logServerError('observe_validation', parseResult.error);
      const fallback = PlantObservationSchema.parse({
        id: `obs-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        moisture,
        light,
        temperature,
        humidity,
        co2,
        imageUrl: imageUrl || undefined,
      });
      sendNdjson({ type: 'final', data: fallback });
    }
    res.end();
  } catch (err) {
    logServerError('observe', err);
    const errorMsg = err instanceof Error ? err.message : 'Observation failed.';
    sendNdjson({ type: 'error', error: errorMsg });
    res.end();
  }
}
