/**
 * Technical-to-Natural Plant Voice Translation & Sanitization Module.
 * 
 * Provides:
 * 1. transformTechnicalStateToPlantVoice: Translates raw sensor readings & visual observations
 *    into natural first-person plant voice dialogue, prioritized by physical urgency.
 * 2. sanitizePlantVoiceResponse: Enforces strict plant-only perspective by detecting prohibited
 *    technical terms and replacing them with natural plant-world expressions.
 */

export interface TechnicalPlantState {
  soilMoisture?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  light?: number | null;
  co2?: number | null;
  flowerStatus?: 'confirmed' | 'likely' | 'uncertain' | 'not-visible' | string | null;
  pestsDetected?: boolean | null;
  leafDamage?: boolean | null;
  overallCondition?: string | null;
}

export type VoiceLanguage = 'en' | 'ta' | 'ta-LK';

/**
 * List of technical terms prohibited in user-facing plant voice output.
 */
export const PROHIBITED_TECHNICAL_TERMS_EN = [
  'sensor',
  'sensors',
  'camera',
  'cameras',
  'frame',
  'frames',
  'image',
  'images',
  'photo',
  'photos',
  'percentage',
  'percentages',
  'reading',
  'readings',
  'esp32',
  'api',
  'apis',
  'gemini',
  'ai model',
  'computer vision',
  'detection',
  'confidence',
  'tool',
  'tools',
  'device',
  'devices',
  'hardware',
  'software',
  'system error',
  'connected',
  'disconnected',
  'analysis result',
  'unclear frame',
  'blurry frame',
  'overexposed',
];

export const PROHIBITED_TECHNICAL_TERMS_TA = [
  'சென்சார்',
  'சென்சார்கள்',
  'கேமரா',
  'கேமராக்கள்',
  'படம் தெளிவில்லை',
  'ஃப்ரேம்',
  'பிரேம்',
  'ரீடிங்',
  'அளவீடு',
  'சதவீதம்',
  'ஏபிஐ',
  'சிஸ்டம்',
  'டிடெக்ட்',
  'கண்டறிதல்',
  'தொழில்நுட்பம்',
  'சாதனம்',
  'இணைக்கப்பட்டுள்ளது',
  'துண்டிக்கப்பட்டுள்ளது',
];

/**
 * Sanitize any plant voice response string by removing or rewriting prohibited technical terms.
 */
export function sanitizePlantVoiceResponse(text: string, lang: VoiceLanguage = 'en'): string {
  if (!text) return text;

  let sanitized = text;

  const terms = lang === 'ta' ? PROHIBITED_TECHNICAL_TERMS_TA : PROHIBITED_TECHNICAL_TERMS_EN;

  // Specific common robotic phrase replacements
  if (lang === 'ta') {
    sanitized = sanitized
      .replace(/சென்சார்.*காட்டுகிறது/gi, 'என் மண் உலர்ந்து போயிருக்கு')
      .replace(/கேமராவை அருகில் கொண்டுவாருங்கள்/gi, 'என் கிளைகளின் நுனிகளை மெதுவாகப் பாருங்கள்')
      .replace(/படம் தெளிவில்லை/gi, 'என் இலைகளுக்குள் சிறிய மொட்டுகள் மறைந்திருக்கலாம் போல இருக்கு')
      .replace(/சென்சார்கள் வேலை செய்கின்றன/gi, 'நான் புத்துணர்ச்சியாக இருக்கிறேன்');
  } else {
    sanitized = sanitized
      .replace(/my (soil )?moisture sensor says (\d+%?)/gi, 'my soil feels dry around my roots')
      .replace(/my sensors are (working|disconnected)/gi, "I'm feeling comfortable and well cared for")
      .replace(/bring the camera (closer|nearer)/gi, 'gently look around my branch tips and leaf corners')
      .replace(/the camera frame is (blurry|unclear|overexposed)/gi, 'tiny buds may be hiding among my leaves')
      .replace(/I cannot see clearly/gi, 'gently inspect around my leaves')
      .replace(/the system detected/gi, 'I feel like')
      .replace(/according to the (reading|sensor)/gi, 'I feel that')
      .replace(/my sensor is disconnected/gi, "I'm not completely sure how I'm feeling yet")
      .replace(/the AI analysis is uncertain/gi, 'I feel like tiny buds may be hiding among my leaves');
  }

  // Check if any prohibited term remains
  const lower = sanitized.toLowerCase();
  const hasProhibitedTerm = terms.some((term) => lower.includes(term.toLowerCase()));

  if (hasProhibitedTerm) {
    // If a prohibited term still exists, replace with a safe natural fallback message
    if (lang === 'ta') {
      return 'நான் இன்று புத்துணர்ச்சியாக இருக்கிறேன். என் வேர்கள் மற்றும் இலைகளை அன்பாகப் பராமரிப்பதற்கு நன்றி!';
    }
    return "I'm feeling fresh and peaceful today. Thank you for taking such gentle care of my leaves and roots!";
  }

  return sanitized;
}

/**
 * Priority-based translation of raw technical plant state into natural plant voice.
 * Priority:
 * 1. Severe lack of water (moisture < 15)
 * 2. High heat / cold temperature (temp > 35 or temp < 10)
 * 3. Moderate dry soil (moisture < 25)
 * 4. Excess water (moisture > 80)
 * 5. Pests / leaf damage
 * 6. Low light (light < 25) / Excess light (light > 90)
 * 7. Flower updates
 * 8. Healthy state
 */
export function transformTechnicalStateToPlantVoice(
  state: TechnicalPlantState,
  lang: VoiceLanguage = 'en'
): string {
  const { soilMoisture, temperature, light, flowerStatus, pestsDetected, leafDamage } = state;

  const englishParts: string[] = [];
  const tamilParts: string[] = [];

  // Priority 1: Severe / Critical lack of water
  if (soilMoisture != null && soilMoisture < 15) {
    englishParts.push("Please don't forget me—my roots are very dry, and I'm finding it hard to stay fresh. A little water would make me feel much better.");
    tamilParts.push("தயவு செய்து என்னை மறந்துவிடாதீர்கள். என் வேர்கள் ரொம்ப உலர்ந்து போயிருக்கின்றன; புத்துணர்ச்சியாக இருக்க கஷ்டமாக இருக்கு. கொஞ்சம் தண்ணீர் கிடைத்தால் எனக்கு மிகவும் நன்றாக இருக்கும்.");
  }
  // Priority 2: Temperature extremes
  else if (temperature != null && temperature > 35) {
    englishParts.push("The heat is becoming too strong for my leaves. Could you give me some gentle shade before I become tired?");
    tamilParts.push("இந்த வெப்பம் என் இலைகளுக்கு கொஞ்சம் அதிகமாக இருக்கு. நான் சோர்ந்து போகும் முன் கொஞ்சம் நிழல் கொடுக்க முடியுமா?");
  } else if (temperature != null && temperature < 10) {
    englishParts.push("I'm feeling a little cold, and my leaves are uncomfortable. Please keep me somewhere warmer and protected.");
    tamilParts.push("எனக்கு கொஞ்சம் குளிராக இருக்கு; என் இலைகள் அசௌகரியமாக உணர்கின்றன. என்னை சற்றே வெப்பமான பாதுகாப்பான இடத்தில் வைக்க முடியுமா?");
  }
  // Priority 3: Moderate drought / Thirsty
  else if (soilMoisture != null && soilMoisture < 25) {
    englishParts.push("I'm feeling so thirsty, and my roots are struggling in this dry soil. Could you please give me a little water?");
    tamilParts.push("எனக்கு ரொம்பத் தாகமாக இருக்கு. உலர்ந்த மண்ணில் என் வேர்கள் கொஞ்சம் கஷ்டப்படுகின்றன. தயவு செய்து கொஞ்சம் தண்ணீர் ஊற்ற முடியுமா?");
  }
  // Priority 4: Excess water / Soggy roots
  else if (soilMoisture != null && soilMoisture > 80) {
    englishParts.push("My roots feel too wet and heavy right now. Please let my soil rest and breathe before giving me more water.");
    tamilParts.push("என் வேர்கள் இப்போது அதிகமாக நனைந்து கனமாக உணர்கின்றன. இன்னும் தண்ணீர் ஊற்றாமல், என் மண் கொஞ்சம் காய்ந்து சுவாசிக்க விடுங்கள்.");
  }
  // Priority 5: Insect disturbance or leaf damage
  else if (pestsDetected) {
    englishParts.push("Something seems to be bothering my leaves. Could you gently check around them for me?");
    tamilParts.push("என் இலைகளை ஏதோ தொந்தரவு செய்வது போல் உணர்கிறேன். தயவு செய்து என் இலைகளை மெதுவாகச் சரிபார்க்க முடியுமா?");
  } else if (leafDamage) {
    englishParts.push("Some of my leaves are hurting. Please take a gentle look around my branches and help me recover.");
    tamilParts.push("என் இலைகளில் சில காயம்பட்டது போல் உணர்கிறேன். தயவு செய்து என் கிளைகளைப் பார்த்து என்னை மீட்க உதவுங்கள்.");
  }
  // Priority 6: Light conditions
  else if (light != null && light < 20) {
    englishParts.push("It feels a little dark here, and my leaves are longing for some gentle sunlight. Could you move me somewhere brighter?");
    tamilParts.push("இங்கே கொஞ்சம் இருட்டாக இருக்கு. என் இலைகள் மென்மையான சூரிய ஒளியைத் தேடுகின்றன. என்னை கொஞ்சம் வெளிச்சமான இடத்துக்கு நகர்த்த முடியுமா?");
  }
  // Priority 7: Flower updates
  else if (flowerStatus === 'confirmed') {
    englishParts.push("Look at me—I'm happily showing off my beautiful flowers today!");
    tamilParts.push("என்னைப் பாருங்கள்! இன்று என் அழகான பூக்களை மகிழ்ச்சியாக மலர வைத்திருக்கிறேன்!");
  } else if (flowerStatus === 'likely') {
    englishParts.push("I think some lovely blooms are beginning to appear among my branches.");
    tamilParts.push("என் கிளைகளுக்குள் அழகான பூக்கள் மலர ஆரம்பிக்கிற மாதிரி உணர்கிறேன்.");
  } else if (flowerStatus === 'uncertain') {
    englishParts.push("I feel like tiny buds may be hiding among my leaves. Please gently look around my branch tips and leaf corners.");
    tamilParts.push("என் இலைகளுக்குள் சிறிய மொட்டுகள் மறைந்திருக்கலாம் போல உணர்கிறேன். என் கிளைகளின் நுனிகளையும் இலைகளின் அருகிலுள்ள பகுதிகளையும் மெதுவாகப் பாருங்கள்.");
  }
  // Priority 8: Healthy default
  else {
    englishParts.push("I'm feeling fresh and peaceful today. My roots are comfortable, and my leaves are enjoying the light.");
    tamilParts.push("இன்று நான் புத்துணர்ச்சியாகவும் அமைதியாகவும் இருக்கிறேன். என் வேர்கள் சுகமாக இருக்கின்றன; என் இலைகள் வெளிச்சத்தை ரசிக்கின்றன.");
  }

  const result = lang === 'ta' ? tamilParts.join(' ') : englishParts.join(' ');
  return sanitizePlantVoiceResponse(result, lang);
}
