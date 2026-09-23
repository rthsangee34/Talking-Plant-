import { Request, Response } from 'express';
import { getGemini, ensureApiKey, GEMINI_VISION_MODEL } from './gemini';
import { PLANT_ANALYSIS_SYSTEM_PROMPT } from '../src/lib/plant/prompts';
import { PlantAnalysisSchema } from '../src/lib/plant/schemas';
import { validateImageDataUrl } from '../src/lib/plant/camera-capture';
import { logServerError } from '../src/lib/api/response-logging';
import { Type } from '@google/genai';
import { updateAnalysis } from './plant-state';
import { sanitizePlantVoiceResponse } from '../src/lib/plant/voice-translator';

export async function handleAnalyzeRequest(req: Request, res: Response): Promise<void> {
  const reqApiKey = (req.headers['x-gemini-api-key'] as string | undefined) || req.body?.apiKey;
  if (!ensureApiKey(res, reqApiKey)) return;

  try {
    const imagesInput: string[] = [];
    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      imagesInput.push(...req.body.images);
    } else {
      const singleUrl = req.body.imageUrl || req.body.image || req.body.dataUrl;
      if (singleUrl) imagesInput.push(singleUrl);
    }

    if (imagesInput.length === 0) {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'imageUrl or images array field is required.' });
      return;
    }

    const contentsParts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

    for (let i = 0; i < imagesInput.length; i++) {
      const img = imagesInput[i];
      const val = validateImageDataUrl(img);
      if (!val.valid) {
        if (process.env.NODE_ENV === 'development') console.log('[DEBUG] Invalid image format:', val.error);
        res.status(400).json({ error: 'INVALID_IMAGE', message: 'The captured picture format is not supported.' });
        return;
      }

      const matches = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!matches) continue;

      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] Captured MIME type:', matches[1]);
        console.log('[DEBUG] Base64 length:', matches[2].length);
      }

      contentsParts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }

    const promptText =
      imagesInput.length > 1
        ? `Perform an Enhanced Multi-Frame Botanical Scan across these ${imagesInput.length} camera frames. Compare the frames and return one consolidated result. Stage 1: Identify species (e.g. Jasmine Jasminum sambac, Peace Lily, Hibiscus). Stage 2: Meticulously inspect every frame for open flowers, white star petals, tubular flowers, unopened buds, stem axils, and image clarity.`
        : 'Perform a comprehensive plant scan. Carefully inspect the plant species, leaves, stems, branches, flowers, flower buds, soil, pests, disease-like symptoms, and all signs of structural or physical damage. Look specifically for torn leaves, missing leaf sections, snapped stems, cracked branches, cuts, wounds, bent parts, crushed tissue, and damaged growing tips. Inspect the complete frame before deciding that no damage is visible.';

    contentsParts.push({ text: promptText });

    const ai = getGemini(reqApiKey);

    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Model name:', GEMINI_VISION_MODEL);
    }

    let response;
    let attempt = 0;
    const maxAttempts = 3;
    const delays = [1000, 2000, 4000];

    while (attempt < maxAttempts) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 30000);
        });

        const genPromise = ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: {
        parts: contentsParts,
      },
      config: {
        systemInstruction: PLANT_ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalPlantsDetected: { type: Type.INTEGER },
            sceneSummary: { type: Type.STRING, description: "Detailed reasoning, chain of thought, and comprehensive summary of all visual observations across the frame before structuring individual plant data." },
            mainPlantId: { type: Type.STRING, nullable: true },
            plants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  plantId: { type: Type.STRING },
                  role: { type: Type.STRING },
                  displayName: { type: Type.STRING },
                  position: { type: Type.STRING },
                  commonName: { type: Type.STRING, nullable: true, description: "The simple common name of the plant (e.g., 'Crepe Jasmine'). Keep it short and concise." },
                  scientificName: { type: Type.STRING, nullable: true, description: "The formal scientific name (e.g., 'Tabernaemontana divaricata'). Do NOT put analysis summary here, strictly the name." },
                  identificationConfidence: { type: Type.STRING },
                  visibleCondition: { type: Type.STRING },
                  leaves: {
                    type: Type.OBJECT,
                    properties: {
                      condition: { type: Type.STRING },
                      issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['condition', 'issues']
                  },
                  flowers: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING },
                      countEstimate: { type: Type.INTEGER, nullable: true },
                      details: { type: Type.STRING }
                    },
                    required: ['status', 'details']
                  },
                  buds: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING },
                      countEstimate: { type: Type.INTEGER, nullable: true }
                    },
                    required: ['status']
                  },
                  pests: {
                    type: Type.OBJECT,
                    properties: {
                      detected: { type: Type.BOOLEAN },
                      details: { type: Type.STRING }
                    },
                    required: ['detected', 'details']
                  },
                  damage: {
                    type: Type.OBJECT,
                    properties: {
                      detected: { type: Type.BOOLEAN },
                      details: { type: Type.STRING }
                    },
                    required: ['detected', 'details']
                  },
                  recommendation: { type: Type.STRING },
                  plantMessage: { type: Type.STRING, nullable: true },
                  needsAttention: { type: Type.BOOLEAN }
                },
                required: [
                  'plantId', 'role', 'displayName', 'position',
                  'identificationConfidence', 'visibleCondition',
                  'leaves', 'flowers', 'buds', 'pests', 'damage',
                  'recommendation', 'needsAttention'
                ]
              }
            },
            conversation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speakerId: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ['speakerId', 'text']
              }
            },
            imageQuality: {
              type: Type.OBJECT,
              properties: {
                usable: { type: Type.BOOLEAN },
                sharpness: { type: Type.STRING },
                lighting: { type: Type.STRING },
                framing: { type: Type.STRING },
                flowerSearchPossible: { type: Type.BOOLEAN },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                guidance: { type: Type.STRING, nullable: true },
              },
              required: ['usable', 'sharpness', 'lighting', 'framing', 'flowerSearchPossible'],
            },
          },
          required: ['totalPlantsDetected', 'sceneSummary', 'plants', 'conversation'],
        },
      },
    });

        response = await Promise.race([genPromise, timeoutPromise]) as any;
        break; // Success
      } catch (err: any) {
        const status = err.status || err.response?.status || err.statusCode;
        const errMsg = err.message || String(err);
        
        console.error('[Gemini API Error]', {
          status: status || 'N/A',
          message: errMsg,
          model: GEMINI_VISION_MODEL,
          responseBody: err.response?.data || err.response?.text || 'N/A',
          attempt: attempt + 1
        });

        const isTimeout = errMsg.includes('TIMEOUT_ERROR') || errMsg.includes('timeout') || errMsg.includes('AbortError');
        
        if (status === 429 || status === 500 || status === 503 || isTimeout) {
          attempt++;
          if (attempt >= maxAttempts) throw err;
          await new Promise(r => setTimeout(r, delays[attempt - 1]));
        } else {
          throw err;
        }
      }
    }

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      res.status(502).json({ error: 'INVALID_MODEL_RESPONSE', message: 'Gemini returned an empty analysis result.' });
      return;
    }

    let parsedJson: unknown;
    try {
      const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
      parsedJson = JSON.parse(cleanJson);
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] JSON parsing failure. Raw text:', rawText.substring(0, 500) + '...');
      }
      res.status(502).json({ error: 'INVALID_MODEL_RESPONSE', message: 'The analysis response could not be understood.' });
      return;
    }

    const parseResult = PlantAnalysisSchema.safeParse({
      ...((parsedJson as object) || {}),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    if (parseResult.success) {
      const data = parseResult.data;

      // Ensure main plant exists if any plant exists
      if (data.plants.length > 0 && !data.mainPlantId) {
        data.mainPlantId = data.plants[0].plantId;
        data.plants[0].role = 'main';
      }

      // Sanitize text if necessary (optional)
      for (const turn of data.conversation) {
         turn.text = sanitizePlantVoiceResponse(turn.text, 'en'); // Adjust lang dynamically if needed, assuming english text for this simple sanitization.
      }

      res.json(data);

      // Push to server-side shared state for WhatsApp & alert engine
      const mainPlant = data.plants.find(p => p.role === 'main') || data.plants[0];
      
      updateAnalysis({
        plantName: mainPlant?.commonName ?? undefined,
        species: mainPlant?.scientificName ?? undefined,
        overallCondition: mainPlant?.visibleCondition ?? 'No plants visible',
        flowersDetected: mainPlant?.flowers.status !== 'not-visible',
        flowerConfidence: mainPlant?.flowers.status === 'confirmed' ? 0.9 : 0.5,
        pestsDetected: mainPlant?.pests.detected ?? false,
        pestDescription: mainPlant?.pests.details ?? undefined,
        recommendedAction: mainPlant?.recommendation ?? undefined,
      });
    } else {
      logServerError('analyze_validation', parseResult.error);
      res.status(502).json({ error: 'INVALID_MODEL_RESPONSE', message: 'The analysis response could not be understood.' });
      return;
    }
  } catch (err: any) {
    logServerError('analyze', err);

    const errMsg = err instanceof Error ? err.message : String(err);
    let category = 'INTERNAL_ERROR';
    let message = 'An error occurred while analyzing the image.';

    if (errMsg.includes('GEMINI_API_KEY') || errMsg.includes('missing')) {
      category = 'API_KEY_MISSING';
      message = 'Gemini API configuration is missing on the server.';
    } else if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key not valid') || errMsg.includes('authentication')) {
      category = 'GEMINI_AUTH_ERROR';
      message = 'Gemini authentication failed. Check the server API key.';
    } else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RATE_LIMIT')) {
      category = 'RATE_LIMIT';
      message = 'The analysis service is temporarily busy. Please try again shortly.';
    } else if (errMsg.includes('model') || errMsg.includes('404') || errMsg.includes('MODEL_NOT_SUPPORTED')) {
      category = 'MODEL_NOT_SUPPORTED';
      message = 'The configured Gemini model does not support image analysis.';
    } else if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('NETWORK_ERROR') || errMsg.includes('TIMEOUT_ERROR') || errMsg.includes('timeout')) {
      category = 'NETWORK_ERROR';
      message = 'The server could not reach Gemini.';
    } else if (errMsg.includes('JSON') || errMsg.includes('MALFORMED_JSON') || errMsg.includes('MODEL_RESPONSE_EMPTY')) {
      category = 'INVALID_MODEL_RESPONSE';
      message = 'The analysis response could not be understood.';
    }

    let statusCode = 500;
    if (category === 'API_KEY_MISSING' || category === 'GEMINI_AUTH_ERROR') statusCode = 401;
    else if (category === 'RATE_LIMIT') statusCode = 429;
    else if (category === 'MODEL_NOT_SUPPORTED') statusCode = 400;
    else if (category === 'NETWORK_ERROR') statusCode = 503;
    else if (category === 'INVALID_MODEL_RESPONSE') statusCode = 502;

    res.status(statusCode).json({ error: category, message });
  }
}
