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
