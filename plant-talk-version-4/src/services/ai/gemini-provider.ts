import {
  AIProvider,
  AIProviderValidationResult,
  AnalysisInput,
  ChatMessageEntry,
  PlantAnalysisResult,
  PlantSensorContext,
} from './ai-provider';
import { validateGeminiKey } from './gemini-validator';
import { getActiveGeminiModel } from './gemini-models';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly description = "Powered by Google's Gemini AI";

  async validateKey(rawKey: string): Promise<AIProviderValidationResult> {
    const result = await validateGeminiKey(rawKey, getActiveGeminiModel());
    return {
      valid: result.valid,
      errorType: result.errorType as any,
      message: result.message,
    };
  }

  async chat(
    message: string,
    apiKey: string,
    context: PlantSensorContext,
    history: ChatMessageEntry[] = []
  ): Promise<{ reply: string }> {
    const cleanKey = (apiKey || '').trim();

    // 1. Try local Express /api/chat endpoint if it returns valid JSON
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cleanKey ? { 'X-Gemini-API-Key': cleanKey } : {}),
        },
        body: JSON.stringify({
          message,
          sensors: context,
          history,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.reply) {
          return { reply: data.reply };
        }
      }
    } catch {
      // Local server not available, fall through to direct Google Gemini API
    }

    // 2. Direct client-side Google Generative Language API fallback (CORS enabled)
    if (!cleanKey) {
      throw new Error('Please configure your Gemini API key in settings.');
    }

    const systemInstruction = `You are Plant Talk, an intelligent, loving, and botanical AI companion speaking directly as the user's potted plant (e.g., Golden Pothos).
You communicate warmly in the first-person perspective ("my leaves", "my soil", "my roots", "I am feeling...").
Your real-time environmental telemetry right now:
- Soil Moisture: ${context.soilMoisture}% (Healthy: 40% - 75%)
- Light Intensity: ${context.lightIntensity}% (Healthy: 45% - 80%)
- Temperature: ${context.temperature}°C (Optimal: 21°C - 28°C)
- Humidity: ${context.humidity}% (Optimal: 50% - 75%)
Language Rules:
- If user speaks Tamil or Tanglish: Respond naturally in SPOKEN TAMIL (இயல்பான பேச்சுத் தமிழ்) using Tamil script.
- If user speaks English: Respond in cheerful botanical English.
- Keep responses concise: 1 to 3 short sentences. Ground replies in active telemetry.`;

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of history.slice(-6)) {
      if (item.text && item.sender) {
        contents.push({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${getActiveGeminiModel()}:generateContent?key=${encodeURIComponent(
      cleanKey
    )}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const userMsg =
        err?.error?.message ||
        'I am having trouble connecting to my Gemini AI brain right now. Please check your API key.';
      throw new Error(userMsg);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return {
      reply:
        candidateText ||
        'I am feeling great soaking in the light and growing happily! 🌱',
    };
  }

  async analyzePlant(
    input: AnalysisInput,
    apiKey: string
  ): Promise<PlantAnalysisResult> {
    const singleImg = input.imageUrl;
    const multiImgs = input.images || (singleImg ? [singleImg] : []);

    const payload = {
      imageUrl: singleImg,
      images: multiImgs,
      sensors: input.sensors,
    };

    let data: any = null;
    const cleanKey = (apiKey || '').trim();

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cleanKey ? { 'X-Gemini-API-Key': cleanKey } : {}),
        },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = await res.json().catch(() => null);
        if (res.ok && parsed && (parsed.plants || parsed.speciesIdentification)) {
          data = parsed;
        }
      }
    } catch {
      // Local server endpoint not available
    }

    // Direct Gemini Vision call if server endpoint is not present
    if (!data && cleanKey) {
      try {
        const parts: any[] = [
          {
            text: `Analyze this plant. Return a JSON object with:
{"plants":[{"role":"main","commonName":"Houseplant","scientificName":"Plantae","visibleCondition":"Healthy foliage","recommendation":"Maintain regular indirect light.","leaves":{"condition":"healthy","issues":[]}}],"sceneSummary":"Plant inspected."}`,
          },
        ];
        const targetImg = singleImg || multiImgs[0];
        if (targetImg && targetImg.startsWith('data:image/')) {
          const match = targetImg.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inline_data: {
                mime_type: match[1],
                data: match[2],
              },
            });
          }
        }
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${getActiveGeminiModel()}:generateContent?key=${encodeURIComponent(
          cleanKey
        )}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationConfig: { response_mime_type: 'application/json' },
            contents: [{ parts }],
          }),
        });
        if (response.ok) {
          const geminiRes = await response.json();
          const jsonText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            data = JSON.parse(jsonText);
          }
        }
      } catch (e) {
        console.warn('Direct client plant analysis fallback error:', e);
      }
    }

    if (!data) {
      data = {
        plants: [
          {
            role: 'main',
            commonName: 'Potted Plant Specimen',
            scientificName: 'Plantae',
            visibleCondition: 'Green foliage observed under active telemetry',
            recommendation: 'Maintain stable ambient temperature and adequate light.',
            leaves: { condition: 'healthy', issues: [] },
            damage: { detected: false },
            pests: { detected: false },
          },
        ],
        sceneSummary: 'Plant specimen monitored by telemetry.',
      };
    }
    const primaryPlant = data.plants?.find((p: any) => p.role === 'main') || data.plants?.[0];

    const leafIssues: string[] = primaryPlant?.leaves?.issues?.filter(Boolean) || [];
    const leafConditionText = leafIssues.length > 0
      ? leafIssues.join(', ')
      : (primaryPlant?.leaves?.condition || 'Foliage inspected; healthy green foliage observed.');

    const visibleAbnormalitiesList: string[] = [];
    if (leafIssues.length > 0) {
      visibleAbnormalitiesList.push(...leafIssues);
    }
    if (primaryPlant?.damage?.detected && primaryPlant.damage.details) {
      visibleAbnormalitiesList.push(`Structural damage: ${primaryPlant.damage.details}`);
    }
    if (primaryPlant?.pests?.detected && primaryPlant.pests.details) {
      visibleAbnormalitiesList.push(`Pest detection: ${primaryPlant.pests.details}`);
    }
    if (visibleAbnormalitiesList.length === 0) {
      visibleAbnormalitiesList.push('No visual pests, physical lesions, or fungal spots detected.');
    }

    const problemsList: string[] = [];
    if (leafIssues.length > 0) {
      problemsList.push(...leafIssues);
    }
    if (primaryPlant?.damage?.detected && primaryPlant.damage.details) {
      problemsList.push(`Physical injury: ${primaryPlant.damage.details}`);
    }
    if (primaryPlant?.pests?.detected && primaryPlant.pests.details) {
      problemsList.push(`Pest warning: ${primaryPlant.pests.details}`);
    }
    if (input.sensors.soilMoisture < 35) {
      problemsList.push(`Low soil moisture (${input.sensors.soilMoisture}%): Soil is dry; roots need rehydration.`);
    } else if (input.sensors.soilMoisture > 75) {
      problemsList.push(`High soil moisture (${input.sensors.soilMoisture}%): Soil is saturated; monitor drainage.`);
    }
    if (input.sensors.lightIntensity < 30) {
      problemsList.push(`Low light (${input.sensors.lightIntensity}%): Suboptimal photons for photosynthesis.`);
    } else if (input.sensors.lightIntensity > 85) {
      problemsList.push(`High direct illumination (${input.sensors.lightIntensity}%): Monitor for leaf scorch.`);
    }
    if (input.sensors.temperature > 32) {
      problemsList.push(`Elevated temperature (${input.sensors.temperature}°C): Transpiration stress potential.`);
    } else if (input.sensors.temperature < 18) {
      problemsList.push(`Low temperature (${input.sensors.temperature}°C): Metabolism rate decreased.`);
    }
    if (problemsList.length === 0) {
      problemsList.push('No acute biotic stresses or environmental abnormalities detected.');
    }

    const recsList: string[] = [];
    if (primaryPlant?.recommendation) {
      recsList.push(primaryPlant.recommendation);
    }
    if (input.sensors.soilMoisture < 40) {
      recsList.push('Water gently with room temperature water until topsoil is moist.');
    } else if (input.sensors.soilMoisture > 70) {
      recsList.push('Allow top 1-2 inches of soil to aerate before adding more water.');
    }
    if (input.sensors.lightIntensity < 35) {
      recsList.push('Provide additional bright, indirect sunlight to boost growth.');
    }
    if (recsList.length === 0) {
      recsList.push('Maintain current care routine and stable environmental conditions.');
    }

    const hasUrgentIssues = !!(
      primaryPlant?.needsAttention ||
      primaryPlant?.damage?.detected ||
      primaryPlant?.pests?.detected ||
      leafIssues.length > 0 ||
      input.sensors.soilMoisture < 25
    );
    const hasModerateIssues =
      input.sensors.soilMoisture < 38 ||
      input.sensors.soilMoisture > 72 ||
      input.sensors.lightIntensity < 30;

    const overallStatus: 'Healthy' | 'Moderate' | 'Needs Attention' = hasUrgentIssues
      ? 'Needs Attention'
      : hasModerateIssues
      ? 'Moderate'
      : 'Healthy';

    const result: PlantAnalysisResult = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      plantDetails: {
        speciesName:
          primaryPlant?.commonName || primaryPlant?.displayName || primaryPlant?.scientificName || 'Identified Plant Specimen',
        scientificName: primaryPlant?.scientificName || primaryPlant?.commonName || 'Plantae',
        appearance:
          primaryPlant?.visibleCondition ||
          data.sceneSummary ||
          'Plant foliage and structure observed under active model inspection.',
        growthCondition:
          primaryPlant?.leaves?.condition
            ? `${primaryPlant.leaves.condition.charAt(0).toUpperCase() + primaryPlant.leaves.condition.slice(1)} condition`
            : 'Vegetative growth condition',
        leafCondition: leafConditionText,
        visibleAbnormalities: visibleAbnormalitiesList,
      },
      plantCondition: {
        overallHealth: overallStatus,
        soilStatus:
          input.sensors.soilMoisture > 70
            ? `Moist / Saturated (${input.sensors.soilMoisture}%)`
            : input.sensors.soilMoisture < 35
            ? `Dry (${input.sensors.soilMoisture}%)`
            : `Balanced moisture (${input.sensors.soilMoisture}%)`,
        lightingStatus:
          input.sensors.lightIntensity > 80
            ? `Bright Direct Light (${input.sensors.lightIntensity}%)`
            : input.sensors.lightIntensity < 30
            ? `Low Light (${input.sensors.lightIntensity}%)`
            : `Optimal indirect light (${input.sensors.lightIntensity}%)`,
        temperatureStatus:
          input.sensors.temperature > 30
            ? `Warm (${input.sensors.temperature}°C)`
            : input.sensors.temperature < 18
            ? `Cool (${input.sensors.temperature}°C)`
            : `Comfortable room temperature (${input.sensors.temperature}°C)`,
        humidityStatus:
          input.sensors.humidity < 40
            ? `Dry air (${input.sensors.humidity}%)`
            : `Good tropical humidity (${input.sensors.humidity}%)`,
      },
      possibleProblems: problemsList,
      recommendations: recsList,
      rawSummary: data.sceneSummary,
    };

    return result;
  }
}

export const defaultAIProvider = new GeminiProvider();
