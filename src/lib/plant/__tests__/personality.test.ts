import { describe, it, expect } from 'vitest';
import { getPlantDialogue, resolveSafePersonality } from '../personality';

describe('Plant Personality System', () => {
  describe('resolveSafePersonality', () => {
    it('returns the requested personality for healthy status', () => {
      expect(resolveSafePersonality('humorous', 'healthy')).toBe('humorous');
      expect(resolveSafePersonality('playful', 'healthy')).toBe('playful');
    });

    it('forces gentle or calm when status is critical', () => {
      expect(resolveSafePersonality('humorous', 'critical')).toBe('gentle');
      expect(resolveSafePersonality('playful', 'critical')).toBe('gentle');
      expect(resolveSafePersonality('calm', 'critical')).toBe('calm');
    });

    it('forces gentle for humorous when status is needs_attention', () => {
      expect(resolveSafePersonality('humorous', 'needs_attention')).toBe('gentle');
      // Other personalities remain unchanged
      expect(resolveSafePersonality('playful', 'needs_attention')).toBe('playful');
    });
  });

  describe('getPlantDialogue', () => {
    it('returns a humorous string for a happy condition', () => {
      const dialogue = getPlantDialogue('happyAndHealthy', 'humorous', 'healthy');
      // Should fall back to cheerful
      expect(dialogue).toMatch(/தேங்க்ஸ் நண்பா! தண்ணியும் வெளிச்சமும் கரெக்டா கிடைச்சிருச்சு|சூப்பர்! இப்போ தான் எனக்கு புத்துணர்ச்சியா இருக்கு/);
    });

    it('returns a humorous string for tooMuchWater if available', () => {
      const dialogue = getPlantDialogue('tooMuchWater', 'humorous', 'healthy');
      expect(dialogue).toMatch(/அன்பு அதிகம்தான் எஜமான்|நீச்சல் பழகிக்கிட்டு இருக்கு/);
    });

    it('returns gentle text for critical needWater even if humorous is requested', () => {
      const dialogue = getPlantDialogue('needWater', 'humorous', 'critical');
      expect(dialogue).toBe('தாகமா இருக்கு நண்பா... என்னோட வேர்களுக்கு கொஞ்சம் தண்ணீர் கொடுத்து உதவுறியா?');
    });

    it('returns default fallback text for an unknown condition', () => {
      const dialogue = getPlantDialogue('unknownConditionXYZ', 'humorous', 'healthy');
      expect(dialogue).toBe('இப்போதைக்கு நான் நல்லா இருக்கேன் நண்பா... என்னைக் கவனிச்சுக்கோங்க.');
    });
  });
});
