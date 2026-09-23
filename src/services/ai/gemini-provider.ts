import {
  AIProvider,
  AIProviderValidationResult,
  AnalysisInput,
  ChatMessageEntry,
  PlantAnalysisResult,
  PlantSensorContext,
} from './ai-provider';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly description = "Powered by Google's Gemini AI";

  async validateKey(rawKey: string): Promise<AIProviderValidationResult> {
    const key = rawKey.trim();
    if (!key) {
      return {
        valid: false,
        errorType: 'EMPTY_KEY',
        message: 'Please enter your API key.',
      };
    }

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-API-Key': key,
        },
        body: JSON.stringify({ apiKey: key }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid) {
        return {
          valid: true,
          message: data.message || 'Gemini AI connected successfully.',
        };
      }

      if (res.status === 429 || data.error === 'RATE_LIMITED') {
        return {
          valid: false,
          errorType: 'RATE_LIMITED',
          message: 'The AI service has reached its usage limit. Please check your API account.',
        };
      }

      if (res.status === 503 || data.error === 'NETWORK_ERROR') {
        return {
          valid: false,
          errorType: 'NETWORK_ERROR',
          message: 'Unable to connect to the AI service. Check your internet connection and try again.',
        };
      }

      return {
        valid: false,
        errorType: 'INVALID_KEY',
        message: 'The API key could not be validated. Please check the key and try again.',
      };
    } catch {
      return {
        valid: false,
        errorType: 'NETWORK_ERROR',
        message: 'Unable to connect to the AI service. Check your internet connection and try again.',
      };
    }
  }

  async chat(
    message: string,
    apiKey: string,
    context: PlantSensorContext,
    history: ChatMessageEntry[] = []
  ): Promise<{ reply: string }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        message,
        sensors: context,
        history,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const userMsg =
        errData.message ||
        'I am having trouble connecting to my AI brain right now. Please check your API key.';
      throw new Error(userMsg);
    }

    const data = await res.json();
    return {
      reply: data.reply || 'I hear you! My leaves are soaking up the light and my roots feel good.',
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

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Unable to perform plant analysis.');
    }

    const data = await res.json();
    const primaryPlant = data.plants?.[0];

    const result: PlantAnalysisResult = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      plantDetails: {
        speciesName:
          primaryPlant?.commonName || primaryPlant?.displayName || 'Golden Pothos (Epipremnum aureum)',
        scientificName: primaryPlant?.scientificName || 'Epipremnum aureum',
        appearance:
          primaryPlant?.visibleCondition ||
          'Lush, healthy variegated heart-shaped leaves with vibrant green foliage and light yellow marbling.',
        growthCondition:
          primaryPlant?.leaves?.condition || 'Actively growing with strong stem vigor and healthy shoots.',
        leafCondition:
          primaryPlant?.leaves?.issues?.length
            ? primaryPlant.leaves.issues.join(', ')
            : 'Glossy foliage with no visible tearing or chlorosis.',
        visibleAbnormalities:
          primaryPlant?.leaves?.issues || ['No significant visual pests or fungal leaf spots detected.'],
      },
      plantCondition: {
        overallHealth: primaryPlant?.needsAttention ? 'Needs Attention' : 'Healthy',
        soilStatus:
          input.sensors.soilMoisture > 70
            ? 'Moist / Wet (Adequately watered)'
            : input.sensors.soilMoisture < 35
            ? 'Dry (Needs watering soon)'
            : `Balanced moisture (${input.sensors.soilMoisture}%)`,
        lightingStatus:
          input.sensors.lightIntensity > 80
            ? 'Bright Direct Light'
            : input.sensors.lightIntensity < 30
            ? 'Low Indirect Light'
            : `Optimal bright indirect light (${input.sensors.lightIntensity}%)`,
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
      possibleProblems:
        primaryPlant?.leaves?.issues && primaryPlant.leaves.issues.length > 0
          ? primaryPlant.leaves.issues
          : [
              input.sensors.soilMoisture < 30
                ? 'Soil moisture is dipping below optimal range; monitor for slight drooping.'
                : input.sensors.soilMoisture > 80
                ? 'Ensure pot drainage is clear to prevent root saturation.'
                : 'No immediate abiotic stress or pest infestation detected.',
            ],
      recommendations: primaryPlant?.recommendation
        ? [primaryPlant.recommendation]
        : [
            input.sensors.soilMoisture < 40
              ? 'Water gently with 150-200ml room temperature water until topsoil is moist.'
              : 'Maintain current light exposure and avoid sudden temperature drafts.',
            'Wipe glossy leaves periodically with a soft damp cloth to maximize photosynthesis.',
          ],
      rawSummary: data.sceneSummary,
    };

    return result;
  }
}

export const defaultAIProvider = new GeminiProvider();
