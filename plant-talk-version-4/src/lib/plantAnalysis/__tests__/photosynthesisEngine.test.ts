import { describe, it, expect } from 'vitest';
import { calculatePhotosynthesisAnalysis } from '../photosynthesisEngine';
import {
  detectPhotosynthesisIntent,
  getPhotosynthesisDialogue,
} from '../knowledge';
import { PlantSensorReadings, PlantAnalysis } from '../../../types';

describe('Photosynthesis Intelligence System & Knowledge', () => {
  // TEST 1: Low light + good water -> Light identified as main limiting factor
  it('TEST 1: identifies insufficient light as the main limiting factor when light is low and moisture is good', () => {
    const readings: PlantSensorReadings = {
      moisture: 60, // Good
      light: 12, // Very low (< 15%)
      temperature: 24, // Good
      humidity: 55,
      co2: 500, // Good
    };

    const analysis = calculatePhotosynthesisAnalysis(readings);

    expect(analysis.factors.light.score).toBeLessThan(analysis.factors.water.score);
    expect(analysis.limitingFactor.factor).toBe('light');
    expect(analysis.limitingFactor.factorName).toMatch(/Insufficient Light/i);
    expect(analysis.limitingFactor.recommendedAction).toBeDefined();
    expect(analysis.isEstimateOnly).toBe(true);
  });

  // TEST 2: Very dry soil + good light -> Water/soil condition identified as limiting factor
  it('TEST 2: identifies dry soil/water scarcity as the limiting factor when moisture is dry and light is optimal', () => {
    const readings: PlantSensorReadings = {
      moisture: 10, // Critically dry (< 15%)
      light: 65, // Optimal (30-75%)
      temperature: 24,
      humidity: 50,
      co2: 600,
    };

    const analysis = calculatePhotosynthesisAnalysis(readings);

    expect(analysis.factors.water.score).toBeLessThan(analysis.factors.light.score);
    expect(analysis.limitingFactor.factor).toBe('water');
    expect(analysis.limitingFactor.factorName).toMatch(/Dry Soil/i);
    expect(analysis.limitingFactor.severity).toBe('severe');
  });

  // TEST 3: Good environmental conditions -> Good estimated photosynthesis condition (score >= 75)
  it('TEST 3: yields Good condition (score >= 75) under optimal environmental conditions', () => {
    const readings: PlantSensorReadings = {
      moisture: 55,
      light: 60,
      temperature: 23,
      humidity: 50,
      co2: 650,
    };

    const mockVision: PlantAnalysis = {
      totalPlantsDetected: 1,
      sceneSummary: 'Single thriving potted fern in bright indoor setting.',
      mainPlantId: 'plant_1',
      plants: [
        {
          plantId: 'plant_1',
          role: 'main',
          displayName: 'Main Fern',
          position: 'center',
          commonName: 'Boston Fern',
          scientificName: 'Nephrolepis exaltata',
          identificationConfidence: 'certain',
          visibleCondition: 'Thriving',
          leaves: {
            condition: 'thriving',
            issues: [],
          },
          flowers: {
            status: 'not-visible',
            details: '',
          },
          buds: {
            status: 'not-visible',
          },
          pests: {
            detected: false,
            details: '',
          },
          damage: {
            detected: false,
            details: '',
          },
          recommendation: 'Continue current routine',
          plantMessage: 'Feeling wonderful!',
          needsAttention: false,
        },
      ],
      conversation: [],
      imageQuality: {
        usable: true,
        flowerSearchPossible: true,
        issues: [],
        guidance: 'Clear shot',
        lighting: 'good',
        sharpness: 'good',
        framing: 'good',
      },
    };

    const analysis = calculatePhotosynthesisAnalysis(readings, mockVision);

    expect(analysis.overallScore).toBeGreaterThanOrEqual(75);
    expect(analysis.status).toBe('good');
    expect(analysis.statusLabel).toMatch(/Good Environmental Support/i);
    expect(analysis.statusEmoji).toBe('🟢');
    expect(analysis.limitingFactor.severity).toBe('none');
  });

  // TEST 4: Missing CO₂ sensor -> CO₂ marked unavailable, confidence reduced, no fake CO₂ value
  it('TEST 4: handles missing CO2 sensor gracefully without faking values and re-normalizes weights', () => {
    const readings: PlantSensorReadings = {
      moisture: 55,
      light: 60,
      temperature: 24,
      humidity: 50,
      co2: null, // Disabled / disconnected sensor
    };

    const analysis = calculatePhotosynthesisAnalysis(readings);

    expect(analysis.factors.co2.available).toBe(false);
    expect(analysis.factors.co2.value).toBeNull();
    expect(analysis.factors.co2.label).toBe('Unavailable');
    // Re-normalizing active sensors: light, water, temperature -> confidence medium
    expect(analysis.confidence).toBe('medium');
    expect(analysis.overallScore).toBeGreaterThan(0);
    // Verified that available weights sum to ~1.0
    const sumWeights =
      analysis.factors.light.normalizedWeight +
      analysis.factors.water.normalizedWeight +
      analysis.factors.temperature.normalizedWeight;
    expect(sumWeights).toBeCloseTo(1.0, 2);
  });

  // TEST 5: Disconnected ESP32 / unavailable readings -> Graceful unavailable state
  it('TEST 5: returns a graceful offline state when telemetry is completely missing/disconnected', () => {
    const analysis = calculatePhotosynthesisAnalysis(null);

    expect(analysis.overallScore).toBe(0);
    expect(analysis.confidence).toBe('low');
    expect(analysis.status).toBe('poor');
    expect(analysis.limitingFactor.factor).toBe('undetermined');
    expect(analysis.factors.light.available).toBe(false);
    expect(analysis.factors.water.available).toBe(false);
  });

  // TEST 6: User asks "How do you make your food?" -> First-person friendly photosynthesis explanation
  it('TEST 6: explains how the plant makes food through photosynthesis in first person', () => {
    const query = 'How do you make your food?';
    const intent = detectPhotosynthesisIntent(query);

    expect(intent.isPhotosynthesis).toBe(true);
    expect(intent.factor).toBe('food');

    const dialogue = getPhotosynthesisDialogue(intent.factor, 'simple', 'en');

    expect(dialogue).toMatch(/I do not eat food like humans or animals/i);
    expect(dialogue).toMatch(/photosynthesis/i);
    expect(dialogue).toMatch(/glucose/i);
    expect(dialogue).toMatch(/oxygen/i);
    // Must be first person
    expect(dialogue).toContain('I');
  });

  // TEST 7: User asks "Why do you need sunlight?" -> Correct explanation of light energy
  it('TEST 7: correctly explains why sunlight is needed as radiant energy to power photosynthesis', () => {
    const query = 'Why do you need sunlight?';
    const intent = detectPhotosynthesisIntent(query);

    expect(intent.isPhotosynthesis).toBe(true);
    expect(intent.factor).toBe('light');

    const dialogue = getPhotosynthesisDialogue(intent.factor, 'simple', 'en');

    expect(dialogue).toMatch(/energy/i);
    expect(dialogue).toMatch(/sunlight/i);
    expect(dialogue).toMatch(/leaves/i);
  });

  // TEST 8: User asks in Tamil "நீ எப்படி உணவு தயாரிக்கிறாய்?" -> Natural Tamil explanation
  it('TEST 8: returns a natural Tamil explanation with proper botanical terms when asked in Tamil', () => {
    const query = 'நீ எப்படி உணவு தயாரிக்கிறாய்?';
    const intent = detectPhotosynthesisIntent(query);

    expect(intent.isPhotosynthesis).toBe(true);
    expect(intent.language).toBe('ta');

    const dialogue = getPhotosynthesisDialogue(intent.factor, 'simple', 'ta');

    expect(dialogue).toContain('ஒளிச்சேர்க்கை');
    expect(dialogue).toContain('குளுக்கோஸ்');
    expect(dialogue).toContain('ஆக்சிஜன்');
  });

  // TEST 9: Contextual follow-up "Why?" -> Explains the requested factor in depth
  it('TEST 9: supports contextual follow-up reasoning for specific factors', () => {
    // Detailed science mode follow-up on light
    const detailedLight = getPhotosynthesisDialogue('light', 'detailed_science', 'en');
    expect(detailedLight).toMatch(/chlorophyll/i);
    expect(detailedLight).toMatch(/photons|photolysis/i);

    // Child-friendly metaphor follow-up
    const childFriendly = getPhotosynthesisDialogue('general', 'child_friendly', 'en');
    expect(childFriendly).toMatch(/solar/i);
    expect(childFriendly).toMatch(/kitchen/i);
  });

  // TEST 10: Simple question with live sensor data -> General explanation first, live sensor insight second
  it('TEST 10: personalizes dialogue with current live sensor analysis after general explanation', () => {
    const liveReadings: PlantSensorReadings = {
      moisture: 20, // Low moisture
      light: 65,
      temperature: 24,
      humidity: 50,
      co2: 600,
    };

    const liveAnalysis = calculatePhotosynthesisAnalysis(liveReadings);
    const dialogue = getPhotosynthesisDialogue('food', 'simple', 'en', liveAnalysis);

    // General explanation first
    expect(dialogue).toMatch(/I do not eat food like humans or animals/i);
    // Live sensor insight second
    expect(dialogue).toMatch(/Right now, my estimated photosynthesis condition is/i);
    expect(dialogue).toMatch(/limiting factor/i);
  });

  // Additional check: High light stress check (excess light penalized)
  it('penalizes excessive light (>85%) to reflect photoinhibition stress', () => {
    const normalReadings: PlantSensorReadings = {
      moisture: 50,
      light: 60, // Optimal
      temperature: 24,
      humidity: 50,
      co2: 500,
    };
    const intenseReadings: PlantSensorReadings = {
      moisture: 50,
      light: 95, // Blinding direct sun
      temperature: 24,
      humidity: 50,
      co2: 500,
    };

    const normal = calculatePhotosynthesisAnalysis(normalReadings);
    const intense = calculatePhotosynthesisAnalysis(intenseReadings);

    expect(intense.factors.light.score).toBeLessThan(normal.factors.light.score);
    expect(intense.factors.light.status).toBe('excessive');
    expect(intense.limitingFactor.factorName).toMatch(/Excessive Light/i);
  });
});
