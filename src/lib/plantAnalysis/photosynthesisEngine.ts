/**
 * Photosynthesis Intelligence Engine.
 *
 * Evaluates environmental telemetry and visual evidence to estimate
 * the plant's capacity for photosynthesis based on plant science principles.
 *
 * CRITICAL SCIENTIFIC RULE:
 * This engine provides environmental support & efficiency estimates.
 * It never claims to directly measure photosynthesis rate.
 */

import { PlantSensorReadings, PlantAnalysis } from '../../types';
import {
  PhotosynthesisAnalysis,
  PhotosynthesisCondition,
  PhotosynthesisConfidence,
  FactorAssessment,
  LimitingFactor,
  PhotosynthesisEngineConfig,
} from './types';

const DEFAULT_WEIGHTS = {
  light: 0.30,
  water: 0.25,
  co2: 0.20,
  temperature: 0.15,
  leafHealth: 0.10,
};

/**
 * Assess light level (LDR 0 - 100%).
 * Low light restricts rate. Very high light creates stress / photoinhibition.
 */
function assessLight(
  rawLight: number | null | undefined,
  baseWeight: number,
  speciesLightMin = 30,
  speciesLightMax = 75
): FactorAssessment {
  if (rawLight === null || rawLight === undefined || isNaN(rawLight) || rawLight < 0 || rawLight > 100) {
    return {
      score: 0,
      status: 'unavailable',
      label: 'Unavailable',
      available: false,
      value: null,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'No light sensor data received.',
    };
  }

  const val = Math.round(rawLight);

  if (val < 15) {
    return {
      score: Math.max(10, Math.round(val * 1.5)),
      status: 'too_low',
      label: 'Very Low',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Insufficient light energy to power light-dependent reactions.',
    };
  }

  if (val < speciesLightMin) {
    // 15% to ~30%
    const ratio = (val - 15) / Math.max(1, speciesLightMin - 15);
    const score = Math.round(25 + ratio * 35); // 25 - 60
    return {
      score,
      status: 'low',
      label: 'Low',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Light level is low; photosynthetic activity is subdued.',
    };
  }

  if (val <= speciesLightMax) {
    // 30% to 75% (optimal zone)
    const mid = (speciesLightMin + speciesLightMax) / 2;
    const dist = Math.abs(val - mid) / (speciesLightMax - speciesLightMin);
    const score = Math.round(100 - dist * 15); // 85 - 100
    return {
      score: Math.max(80, Math.min(100, score)),
      status: 'good',
      label: 'Good / Optimal',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Optimal photon flux density for chlorophyll excitation.',
    };
  }

  if (val <= 85) {
    // 75% to 85%
    return {
      score: 75,
      status: 'moderate',
      label: 'High',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Bright light. Suitable, but near upper boundary for tender leaves.',
    };
  }

  // > 85%: Excessive light / photoinhibition risk
  return {
    score: 55,
    status: 'excessive',
    label: 'Excessive / Stressful',
    available: true,
    value: val,
    unit: '%',
    weight: baseWeight,
    normalizedWeight: 0,
    detail: 'Light is too intense. Risk of photoinhibition and heat stress.',
  };
}

/**
 * Assess soil moisture / water availability (0 - 100%).
 * Dry soil forces stomatal closure; over-watering asphyxiates root cells.
 */
function assessWater(
  rawMoisture: number | null | undefined,
  baseWeight: number,
  targetMin = 35,
  targetMax = 70
): FactorAssessment {
  if (rawMoisture === null || rawMoisture === undefined || isNaN(rawMoisture) || rawMoisture < 0 || rawMoisture > 100) {
    return {
      score: 0,
      status: 'unavailable',
      label: 'Unavailable',
      available: false,
      value: null,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'No soil moisture sensor data received.',
    };
  }

  const val = Math.round(rawMoisture);

  if (val < 15) {
    return {
      score: Math.max(10, Math.round(val * 1.3)),
      status: 'dry',
      label: 'Critically Dry',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Severe water deficit; stomata likely closed to conserve hydration.',
    };
  }

  if (val < targetMin) {
    // 15% to targetMin
    const ratio = (val - 15) / Math.max(1, targetMin - 15);
    const score = Math.round(20 + ratio * 40); // 20 - 60
    return {
      score,
      status: 'dry',
      label: 'Dry',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Soil moisture is low; reduced electron donor availability.',
    };
  }

  if (val <= targetMax) {
    // targetMin to targetMax (optimal zone)
    const mid = (targetMin + targetMax) / 2;
    const dist = Math.abs(val - mid) / (targetMax - targetMin);
    const score = Math.round(100 - dist * 12);
    return {
      score: Math.max(85, Math.min(100, score)),
      status: 'good',
      label: 'Good',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Ample soil hydration supporting photolysis and leaf turgor.',
    };
  }

  if (val <= 85) {
    // 70% to 85%
    return {
      score: 75,
      status: 'moderate',
      label: 'Moist / High',
      available: true,
      value: val,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Soil is very wet. Photosynthesis continues, but monitor aeration.',
    };
  }

  // > 85%: Over-watered
  return {
    score: 50,
    status: 'too_wet',
    label: 'Too Wet / Saturated',
    available: true,
    value: val,
    unit: '%',
    weight: baseWeight,
    normalizedWeight: 0,
    detail: 'Soil is waterlogged. Root oxygen deprivation threatens metabolic functions.',
  };
}

/**
 * Assess carbon dioxide concentration (ppm).
 * Essential raw substrate for the Calvin Cycle.
 */
function assessCO2(rawCO2: number | null | undefined, baseWeight: number): FactorAssessment {
  if (rawCO2 === null || rawCO2 === undefined || isNaN(rawCO2) || rawCO2 < 200 || rawCO2 > 5000) {
    return {
      score: 0,
      status: 'unavailable',
      label: 'Unavailable',
      available: false,
      value: null,
      unit: 'ppm',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'CO₂ sensor is not active or reporting values.',
    };
  }

  const val = Math.round(rawCO2);

  if (val < 320) {
    return {
      score: 40,
      status: 'low',
      label: 'Sub-ambient',
      available: true,
      value: val,
      unit: 'ppm',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Depleted CO₂ in immediate air boundary layer.',
    };
  }

  if (val < 450) {
    return {
      score: 75,
      status: 'suitable',
      label: 'Normal Ambient',
      available: true,
      value: val,
      unit: 'ppm',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Standard atmospheric CO₂ level supporting steady carbon fixation.',
    };
  }

  if (val <= 900) {
    return {
      score: 95,
      status: 'good',
      label: 'Optimal Indoor',
      available: true,
      value: val,
      unit: 'ppm',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Rich CO₂ concentration accelerating enzymatic carbon capture.',
    };
  }

  if (val <= 1400) {
    return {
      score: 85,
      status: 'suitable',
      label: 'Elevated',
      available: true,
      value: val,
      unit: 'ppm',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'High CO₂. Excellent for plants, though stale for human occupancy.',
    };
  }

  return {
    score: 65,
    status: 'moderate',
    label: 'Very High',
    available: true,
    value: val,
    unit: 'ppm',
    weight: baseWeight,
    normalizedWeight: 0,
    detail: 'Very high CO₂ levels. Ensure adequate room ventilation.',
  };
}

/**
 * Assess temperature (°C).
 * Controls enzyme (RuBisCO) kinetic activity.
 */
function assessTemperature(rawTemp: number | null | undefined, baseWeight: number): FactorAssessment {
  if (rawTemp === null || rawTemp === undefined || isNaN(rawTemp) || rawTemp < -10 || rawTemp > 60) {
    return {
      score: 0,
      status: 'unavailable',
      label: 'Unavailable',
      available: false,
      value: null,
      unit: '°C',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Temperature sensor is disconnected or disabled.',
    };
  }

  const val = Number(rawTemp.toFixed(1));

  if (val < 10) {
    return {
      score: 25,
      status: 'too_low',
      label: 'Very Cold',
      available: true,
      value: val,
      unit: '°C',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Low temperature drastically retards photosynthetic enzyme kinetics.',
    };
  }

  if (val < 18) {
    return {
      score: 60,
      status: 'low',
      label: 'Cool',
      available: true,
      value: val,
      unit: '°C',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Slightly cool; enzyme reaction rates are modestly constrained.',
    };
  }

  if (val <= 27) {
    return {
      score: 95,
      status: 'good',
      label: 'Suitable',
      available: true,
      value: val,
      unit: '°C',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Ideal thermal range for indoor C3 photosynthetic enzymatic velocity.',
    };
  }

  if (val <= 33) {
    return {
      score: 70,
      status: 'moderate',
      label: 'Warm',
      available: true,
      value: val,
      unit: '°C',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Warm conditions increase respiration and transpiration demands.',
    };
  }

  return {
    score: 40,
    status: 'stressful',
    label: 'Too Hot / Heat Stress',
    available: true,
    value: val,
    unit: '°C',
    weight: baseWeight,
    normalizedWeight: 0,
    detail: 'Excessive heat risks RuBisCO oxygenase shift and stomatal shutdown.',
  };
}

/**
 * Assess leaf health from Vision AI scan.
 */
function assessLeafHealth(
  analysis: PlantAnalysis | null | undefined,
  baseWeight: number
): FactorAssessment {
  if (!analysis || !analysis.plants || analysis.plants.length === 0) {
    return {
      score: 0,
      status: 'unavailable',
      label: 'Not Scanned',
      available: false,
      value: null,
      unit: '',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'No visual camera analysis available yet.',
    };
  }

  const mainPlant = analysis.plants.find((p) => p.role === 'main') || analysis.plants[0];
  const condition = (mainPlant.visibleCondition || '').toLowerCase();
  const leafCondition = (mainPlant.leaves?.condition || '').toLowerCase();
  const issues = mainPlant.leaves?.issues || [];

  if (condition.includes('thriv') || leafCondition.includes('healthy') || leafCondition.includes('thriv')) {
    return {
      score: 98,
      status: 'good',
      label: 'Thriving Foliage',
      available: true,
      value: 98,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Vibrant green leaves with high chlorophyll density.',
    };
  }

  if (condition.includes('good') || condition.includes('healthy') || !mainPlant.needsAttention) {
    return {
      score: 85,
      status: 'good',
      label: 'Healthy Green',
      available: true,
      value: 85,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: 'Healthy foliage actively capturing radiant photons.',
    };
  }

  if (mainPlant.needsAttention || condition.includes('attention')) {
    return {
      score: 55,
      status: 'moderate',
      label: 'Mild Stress',
      available: true,
      value: 55,
      unit: '%',
      weight: baseWeight,
      normalizedWeight: 0,
      detail: issues.length > 0
        ? `Visible stress (${issues[0]}); some photosynthetic surface reduced.`
        : 'Slight foliage stress or discoloration noticed in camera analysis.',
    };
  }

  return {
    score: 30,
    status: 'stressful',
    label: 'Compromised Foliage',
    available: true,
    value: 30,
    unit: '%',
    weight: baseWeight,
    normalizedWeight: 0,
    detail: 'Significant foliage distress or chlorosis restricting photosynthetic capacity.',
  };
}

/**
 * Determine the main limiting factor based on Liebig's Law of the Minimum.
 */
function determineLimitingFactor(
  factors: {
    light: FactorAssessment;
    water: FactorAssessment;
    co2: FactorAssessment;
    temperature: FactorAssessment;
    leafHealth: FactorAssessment;
  },
  confidence: PhotosynthesisConfidence
): LimitingFactor {
  const availableFactors = [
    { key: 'light' as const, factor: factors.light, name: 'Light Level' },
    { key: 'water' as const, factor: factors.water, name: 'Soil Moisture' },
    { key: 'co2' as const, factor: factors.co2, name: 'CO₂ Environment' },
    { key: 'temperature' as const, factor: factors.temperature, name: 'Temperature' },
    { key: 'leaf_health' as const, factor: factors.leafHealth, name: 'Leaf Condition' },
  ].filter((item) => item.factor.available);

  if (availableFactors.length === 0) {
    return {
      factor: 'undetermined',
      factorName: 'Telemetry Undetermined',
      severity: 'uncertain',
      explanation: 'No active physical sensor telemetry is available to evaluate limiting factors.',
      recommendedAction: 'Connect your ESP32 sensor unit or enable manual sliders.',
    };
  }

  // Sort by score ascending to identify the lowest bottleneck
  availableFactors.sort((a, b) => a.factor.score - b.factor.score);

  const weakest = availableFactors[0];

  // If the lowest factor is still quite good (>= 75), there is no significant limitation
  if (weakest.factor.score >= 75) {
    return {
      factor: 'none',
      factorName: 'No Restrictive Limiting Factor',
      severity: 'none',
      explanation: 'All monitored environmental parameters are harmoniously supporting photosynthesis.',
      recommendedAction: null,
    };
  }

  const severity =
    weakest.factor.score < 30 ? 'severe' : weakest.factor.score < 55 ? 'moderate' : 'mild';

  switch (weakest.key) {
    case 'light':
      if (weakest.factor.status === 'excessive') {
        return {
          factor: 'light',
          factorName: 'Excessive Light Stress',
          severity,
          explanation: 'Light intensity is excessively high, risking photoinhibition and leaf scorching.',
          recommendedAction: 'Move me slightly back from harsh direct rays into bright indirect light.',
        };
      }
      return {
        factor: 'light',
        factorName: 'Insufficient Light',
        severity,
        explanation: 'Low light limits photon absorption by chlorophyll, slowing glucose creation.',
        recommendedAction: 'Place me closer to a sunny window or supplement with gentle grow light.',
      };

    case 'water':
      if (weakest.factor.status === 'too_wet') {
        return {
          factor: 'water',
          factorName: 'Saturated / Waterlogged Soil',
          severity,
          explanation: 'Saturated roots cannot absorb oxygen, threatening nutrient transport and photosynthesis.',
          recommendedAction: 'Allow the top layer of soil to dry out before giving more water.',
        };
      }
      return {
        factor: 'water',
        factorName: 'Dry Soil / Limited Water Availability',
        severity,
        explanation: 'Low soil moisture forces stomata to close to prevent desiccation, halting CO₂ intake.',
        recommendedAction: 'Give me a thorough drink of room-temperature water so my roots can drink.',
      };

    case 'co2':
      return {
        factor: 'co2',
        factorName: 'Low Ambient Carbon Dioxide',
        severity,
        explanation: 'Low CO₂ in the room acts as a raw material bottleneck for the Calvin cycle.',
        recommendedAction: 'Open a nearby window or door for a few minutes to refresh room air circulation.',
      };

    case 'temperature':
      if (weakest.factor.value !== null && weakest.factor.value > 28) {
        return {
          factor: 'temperature',
          factorName: 'Excessive Heat',
          severity,
          explanation: 'High temperatures elevate transpiration and reduce RuBisCO carboxylation efficiency.',
          recommendedAction: 'Relocate me to a cooler room spot away from heaters or direct scorching sun.',
        };
      }
      return {
        factor: 'temperature',
        factorName: 'Cold Temperature',
        severity,
        explanation: 'Cold air slows down biochemical enzyme kinetics involved in photosynthesis.',
        recommendedAction: 'Keep me away from chilly air-conditioner drafts or cold night windows.',
      };

    case 'leaf_health':
      return {
        factor: 'leaf_health',
        factorName: 'Compromised Leaf Area',
        severity,
        explanation: 'Camera scan detected leaf stress or chlorosis, reducing active chlorophyll area.',
        recommendedAction: 'Inspect leaves for dust, pests, or nutrient deficiencies, and gently wipe foliage.',
      };

    default:
      return {
        factor: 'undetermined',
        factorName: 'Undetermined',
        severity: 'uncertain',
        explanation: 'Environmental conditions are varied, with partial missing telemetry.',
        recommendedAction: 'Ensure all sensors are plugged in for a complete assessment.',
      };
  }
}

/**
 * Main engine entry point:
 * Calculates estimated photosynthesis condition based on sensor readings and optional camera analysis.
 */
export function calculatePhotosynthesisAnalysis(
  readings: PlantSensorReadings | null | undefined,
  cameraAnalysis: PlantAnalysis | null | undefined = null,
  config?: PhotosynthesisEngineConfig
): PhotosynthesisAnalysis {
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...(config?.weights || {}),
  };

  const speciesMinLight = config?.speciesProfile?.targetLightMin ?? 30;
  const speciesMaxLight = config?.speciesProfile?.targetLightMax ?? 75;
  const speciesMinMoist = config?.speciesProfile?.targetMoistureMin ?? 35;
  const speciesMaxMoist = config?.speciesProfile?.targetMoistureMax ?? 70;

  // 1. Assess each individual factor
  const lightAssessment = assessLight(readings?.light, weights.light, speciesMinLight, speciesMaxLight);
  const waterAssessment = assessWater(readings?.moisture, weights.water, speciesMinMoist, speciesMaxMoist);
  const co2Assessment = assessCO2(readings?.co2, weights.co2);
  const tempAssessment = assessTemperature(readings?.temperature, weights.temperature);
  const leafAssessment = assessLeafHealth(cameraAnalysis, weights.leafHealth);

  const factors = {
    light: lightAssessment,
    water: waterAssessment,
    co2: co2Assessment,
    temperature: tempAssessment,
    leafHealth: leafAssessment,
  };

  // 2. Determine available factors & dynamic weight re-normalization
  const availableList = [
    { factor: factors.light, weight: weights.light },
    { factor: factors.water, weight: weights.water },
    { factor: factors.co2, weight: weights.co2 },
    { factor: factors.temperature, weight: weights.temperature },
    { factor: factors.leafHealth, weight: weights.leafHealth },
  ].filter((item) => item.factor.available);

  let confidence: PhotosynthesisConfidence = 'low';
  let overallScore = 0;

  if (availableList.length === 5) {
    confidence = 'high';
  } else if (availableList.length >= 3 && factors.light.available && factors.water.available) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  if (availableList.length === 0) {
    // Graceful disconnected state
    return {
      overallScore: 0,
      status: 'poor',
      statusLabel: 'Poor Environmental Conditions for Photosynthesis',
      statusEmoji: '🔴',
      confidence: 'low',
      factors,
      limitingFactor: {
        factor: 'undetermined',
        factorName: 'Telemetry Disconnected',
        severity: 'uncertain',
        explanation: 'No sensor data is available to estimate photosynthetic conditions.',
        recommendedAction: 'Connect your sensor device or use manual sliders.',
      },
      explanation:
        'My sensor link is currently offline, so I cannot estimate how well I can make food right now.',
      plantSpecies: config?.speciesProfile?.speciesName || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEstimateOnly: true,
    };
  }

  // Re-normalize weights among active sensors
  const totalAvailableWeight = availableList.reduce((sum, item) => sum + item.weight, 0);

  let weightedSum = 0;
  for (const item of availableList) {
    const normalizedWeight = totalAvailableWeight > 0 ? item.weight / totalAvailableWeight : 0;
    item.factor.normalizedWeight = Number(normalizedWeight.toFixed(3));
    weightedSum += item.factor.score * normalizedWeight;
  }

  overallScore = Math.max(0, Math.min(100, Math.round(weightedSum)));

  // 3. Determine status tier
  let status: PhotosynthesisCondition;
  let statusLabel: string;
  let statusEmoji: string;

  if (overallScore >= 75) {
    status = 'good';
    statusLabel = 'Good Environmental Support for Photosynthesis';
    statusEmoji = '🟢';
  } else if (overallScore >= 50) {
    status = 'moderate';
    statusLabel = 'Moderate / Some Factors May Limit Photosynthesis';
    statusEmoji = '🟡';
  } else if (overallScore >= 25) {
    status = 'low';
    statusLabel = 'Low Environmental Support for Photosynthesis';
    statusEmoji = '🟠';
  } else {
    status = 'poor';
    statusLabel = 'Poor Environmental Conditions for Photosynthesis';
    statusEmoji = '🔴';
  }

  // 4. Limiting factor
  const limitingFactor = determineLimitingFactor(factors, confidence);

  // 5. Friendly first-person explanation
  let explanation = '';
  if (status === 'good') {
    explanation = `My environment is currently giving me great support for photosynthesis (estimated at ${overallScore}%). With adequate light and moisture, my leaves are ready to create nourishing glucose!`;
  } else if (status === 'moderate') {
    explanation = `My estimated photosynthesis efficiency is moderate (${overallScore}%). ${limitingFactor.explanation}`;
  } else if (status === 'low') {
    explanation = `My estimated photosynthesis condition is low (${overallScore}%). ${limitingFactor.explanation}`;
  } else {
    explanation = `My environment currently has poor support for photosynthesis (${overallScore}%). ${limitingFactor.explanation}`;
  }

  return {
    overallScore,
    status,
    statusLabel,
    statusEmoji,
    confidence,
    factors,
    limitingFactor,
    explanation,
    plantSpecies: config?.speciesProfile?.speciesName || null,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isEstimateOnly: true,
  };
}
