import { describe, it, expect } from 'vitest';
import {
  transformTechnicalStateToPlantVoice,
  sanitizePlantVoiceResponse,
  PROHIBITED_TECHNICAL_TERMS_EN,
  PROHIBITED_TECHNICAL_TERMS_TA,
} from '../voice-translator';
import { PlantAnalysisSchema } from '../schemas';

describe('Plant Voice Translation & Sanitization', () => {
  describe('Test Case 1: Dry Soil & Very Dry Soil', () => {
    it('returns natural thirst voice for moderately dry soil', () => {
      const output = transformTechnicalStateToPlantVoice({ soilMoisture: 20, temperature: 29, light: 60 }, 'en');
      expect(output).toContain("thirsty");
      expect(output).not.toContain("20%");
      expect(output).not.toContain("sensor");
    });

    it('returns natural urgent dry voice for very dry soil', () => {
      const output = transformTechnicalStateToPlantVoice({ soilMoisture: 14, temperature: 29, light: 60 }, 'en');
      expect(output).toContain("roots are very dry");
      expect(output).not.toContain("14%");
      expect(output).not.toContain("sensor");
    });
  });

  describe('Test Case 2: Visual Uncertainty', () => {
    it('requests gentle branch inspection without mentioning camera quality or blur', () => {
      const output = transformTechnicalStateToPlantVoice({ flowerStatus: 'uncertain' }, 'en');
      expect(output).toContain("buds may be hiding");
      expect(output).not.toContain("camera");
      expect(output).not.toContain("blurry");
      expect(output).not.toContain("frame");
    });
  });

  describe('Test Case 3: Tool / Sensor Unavailable', () => {
    it('sanitizes tool failure into natural uncertainty without declaring sensor failure', () => {
      const rawText = "My moisture sensor is disconnected and returned no data.";
      const sanitized = sanitizePlantVoiceResponse(rawText, 'en');
      expect(sanitized).not.toContain("disconnected");
      expect(sanitized).not.toContain("sensor");
      expect(sanitized).toContain("leaves and roots");
    });
  });

  describe('Test Case 4: Healthy Plant', () => {
    it('expresses freshness and comfort without claiming sensors are working', () => {
      const output = transformTechnicalStateToPlantVoice({ soilMoisture: 50, temperature: 24, light: 70 }, 'en');
      expect(output).toContain("fresh and peaceful");
      expect(output).not.toContain("sensors are working");
    });
  });

  describe('Test Case 5: Flower Confirmed', () => {
    it('joyfully displays flowers without confidence percentages or computer vision terms', () => {
      const output = transformTechnicalStateToPlantVoice({ flowerStatus: 'confirmed' }, 'en');
      expect(output).toContain("showing off my beautiful flowers");
      expect(output).not.toContain("confidence");
      expect(output).not.toContain("computer vision");
    });
  });

  describe('Test Case 6: Tamil Dry Soil', () => {
    it('returns Sri Lankan Tamil thirst response without technical terms or percentages', () => {
      const output = transformTechnicalStateToPlantVoice({ soilMoisture: 20 }, 'ta');
      expect(output).toContain("தாகமாக");
      expect(output).not.toContain("சென்சார்");
      expect(output).not.toContain("சதவீதம்");
    });

    it('returns Sri Lankan Tamil urgent dry response for very dry soil', () => {
      const output = transformTechnicalStateToPlantVoice({ soilMoisture: 14 }, 'ta');
      expect(output).toContain("உலர்ந்து போயிருக்கின்றன");
      expect(output).not.toContain("சென்சார்");
      expect(output).not.toContain("சதவீதம்");
    });
  });

  describe('Requirement D: Structured Schema Validation', () => {
    it('parses valid plant analysis and enforces plants array structure', () => {
      const parsed = PlantAnalysisSchema.parse({
        totalPlantsDetected: 1,
        sceneSummary: 'One plant',
        plants: [
          {
            plantId: 'plant_1',
            role: 'main',
            displayName: 'Jasmine',
            position: 'center',
            commonName: 'Jasmine',
            scientificName: 'Jasminum sambac',
            identificationConfidence: 'High',
            visibleCondition: 'Healthy',
            leaves: { condition: 'Healthy', issues: [] },
            flowers: { status: 'confirmed', countEstimate: 3, details: 'white tubular petals' },
            buds: { status: 'none', countEstimate: null },
            pests: { detected: false, details: '' },
            damage: { detected: false, details: '' },
            recommendation: 'Provide indirect light',
          },
        ],
      });
      expect(parsed.totalPlantsDetected).toBe(1);
      expect(parsed.plants[0].commonName).toBe('Jasmine');
      expect(parsed.plants[0].plantId).toBe('plant_1');
    });
  });

  describe('Sanitizer Prohibited Terms Rejection', () => {
    it('sanitizes technical English phrases properly', () => {
      const input = "My moisture sensor says 18%. Please bring the camera closer because the frame is unclear.";
      const sanitized = sanitizePlantVoiceResponse(input, 'en');
      
      PROHIBITED_TECHNICAL_TERMS_EN.forEach((term) => {
        expect(sanitized.toLowerCase()).not.toContain(term.toLowerCase());
      });
    });

    it('sanitizes technical Tamil phrases properly', () => {
      const input = "என் மண் ஈரப்பத சென்சார் 15 சதவீதம் காட்டுகிறது. கேமராவை அருகில் கொண்டுவாருங்கள்.";
      const sanitized = sanitizePlantVoiceResponse(input, 'ta');
      
      PROHIBITED_TECHNICAL_TERMS_TA.forEach((term) => {
        expect(sanitized.toLowerCase()).not.toContain(term.toLowerCase());
      });
    });
  });
});
