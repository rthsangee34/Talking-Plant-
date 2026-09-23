/**
 * Botanical Photosynthesis Knowledge Base & Conversational Formatter.
 *
 * Provides scientifically grounded, friendly first-person explanations
 * in both English and natural Sri Lankan Tamil.
 */

import {
  PhotosynthesisAnalysis,
  PhotosynthesisResponseMode,
} from './types';

export const BOTANICAL_KNOWLEDGE = {
  equation: {
    chemical: '6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂',
    words: 'Carbon Dioxide + Water + Sunlight → Glucose (Plant Food) + Oxygen',
    tamil: 'கார்பன் டைஆக்சைடு + நீர் + சூரிய ஒளி → குளுக்கோஸ் (உணவு) + ஆக்சிஜன்',
  },
  tamilVocabulary: {
    photosynthesis: 'ஒளிச்சேர்க்கை (Photosynthesis)',
    glucose: 'குளுக்கோஸ் (Glucose - உணவு)',
    chlorophyll: 'பச்சையம் (Chlorophyll)',
    stomata: 'இலைத்துளைகள் (Stomata)',
    oxygen: 'ஆக்சிஜன் (Oxygen)',
    carbonDioxide: 'கார்பன் டைஆக்சைடு (CO₂)',
    sunlight: 'சூரிய ஒளி (Sunlight)',
    water: 'தண்ணீர் / நீர் (Water)',
    roots: 'வேர்கள் (Roots)',
    leaves: 'இலைகள் (Leaves)',
  },
};

export interface IntentResult {
  isPhotosynthesis: boolean;
  factor: 'general' | 'light' | 'water' | 'co2' | 'temperature' | 'food';
  language: 'en' | 'ta';
  suggestedMode: PhotosynthesisResponseMode;
}

/**
 * Detects whether a user prompt is asking about plant food, feeding, or photosynthesis.
 */
export function detectPhotosynthesisIntent(query: string): IntentResult {
  const normalized = query.toLowerCase().trim();

  // Check Tamil characters
  const isTamil = /[\u0B80-\u0BFF]/.test(query);

  let factor: IntentResult['factor'] = 'general';

  if (
    normalized.includes('sunlight') ||
    normalized.includes('sun') ||
    normalized.includes('light') ||
    normalized.includes('வெயில்') ||
    normalized.includes('சூரிய') ||
    normalized.includes('வெளிச்சம்')
  ) {
    factor = 'light';
  } else if (
    normalized.includes('water') ||
    normalized.includes('thirsty') ||
    normalized.includes('moisture') ||
    normalized.includes('தண்ணீர்') ||
    normalized.includes('நீர்') ||
    normalized.includes('தாகம்')
  ) {
    factor = 'water';
  } else if (
    normalized.includes('co2') ||
    normalized.includes('carbon') ||
    normalized.includes('கார்பன்') ||
    normalized.includes('காத்து')
  ) {
    factor = 'co2';
  } else if (
    normalized.includes('temperature') ||
    normalized.includes('heat') ||
    normalized.includes('cold') ||
    normalized.includes('சூடு') ||
    normalized.includes('குளிர்')
  ) {
    factor = 'temperature';
  } else if (
    normalized.includes('food') ||
    normalized.includes('eat') ||
    normalized.includes('feed') ||
    normalized.includes('hunger') ||
    normalized.includes('hungry') ||
    normalized.includes('உணவு') ||
    normalized.includes('சாப்பாடு') ||
    normalized.includes('பசி')
  ) {
    factor = 'food';
  }

  // Detect mode requests
  let suggestedMode: PhotosynthesisResponseMode = 'simple';
  if (
    normalized.includes('child') ||
    normalized.includes('kid') ||
    normalized.includes('simple') ||
    normalized.includes('குழந்தை')
  ) {
    suggestedMode = 'child_friendly';
  } else if (
    normalized.includes('science') ||
    normalized.includes('detail') ||
    normalized.includes('deep') ||
    normalized.includes('explain how') ||
    normalized.includes('விளக்க') ||
    normalized.includes('ஆராய்ச்சி')
  ) {
    suggestedMode = 'detailed_science';
  }

  // Matching patterns
  const englishPatterns = [
    /how do you (make|cook|prepare|produce|get) (your )?(food|energy|glucose)/i,
    /how do you eat/i,
    /what do you eat/i,
    /what is photosynthesis/i,
    /where do you get (your )?(food|energy)/i,
    /why do you need (sunlight|light|sun)/i,
    /why do you need (water|moisture)/i,
    /why do you need (co2|carbon dioxide)/i,
    /photosynthesis/i,
    /make food/i,
  ];

  const tamilPatterns = [
    /உணவு.*(எப்படி|தயாரிக்கிறாய்|சாப்பிடுவாய்|உண்கிறாய்)/,
    /சாப்பாடு.*(எப்படி|எங்கிருந்து)/,
    /ஒளிச்சேர்க்கை/,
    /சூரிய.*(ஏன்.*தேவை|வெளிச்சம்.*வேண்டுமா)/,
    /தண்ணீர்.*(ஏன்.*தேவை|எதற்கு)/,
    /கார்பன்.*டைஆக்சைடு.*(ஏன்|எதற்கு)/,
  ];

  const matchedEn = englishPatterns.some((p) => p.test(normalized));
  const matchedTa = tamilPatterns.some((p) => p.test(normalized));

  const isPhotosynthesis = matchedEn || matchedTa;

  return {
    isPhotosynthesis,
    factor,
    language: isTamil ? 'ta' : 'en',
    suggestedMode,
  };
}

/**
 * Returns conversational first-person explanations for photosynthesis in English and Tamil.
 */
export function getPhotosynthesisDialogue(
  factor: IntentResult['factor'],
  mode: PhotosynthesisResponseMode = 'simple',
  language: 'en' | 'ta' = 'en',
  liveAnalysis?: PhotosynthesisAnalysis | null
): string {
  if (language === 'ta') {
    return getTamilDialogue(factor, mode, liveAnalysis);
  }
  return getEnglishDialogue(factor, mode, liveAnalysis);
}

function getEnglishDialogue(
  factor: IntentResult['factor'],
  mode: PhotosynthesisResponseMode,
  liveAnalysis?: PhotosynthesisAnalysis | null
): string {
  let explanation = '';

  if (mode === 'child_friendly') {
    switch (factor) {
      case 'light':
        explanation =
          "Think of sunlight as my solar energy charger! ☀️ My green leaves soak up the sun's warm rays so I have enough power to cook my yummy plant food.";
        break;
      case 'water':
        explanation =
          "My roots act just like little underground drinking straws! 💧 They sip water up into my stems and leaves so I stay fresh, bouncy, and ready to grow.";
        break;
      case 'co2':
        explanation =
          "Just like you breathe in fresh air, I breathe in carbon dioxide through tiny invisible leaf doors! It gives me the carbon bricks I need to build strong stems.";
        break;
      default:
        explanation =
          "I don't eat sandwiches or rice like you do! Instead, I have a tiny kitchen inside my green leaves called Photosynthesis 🌿. My roots sip water, my leaves catch sunlight like solar panels, and I breathe in carbon dioxide to bake sweet glucose treats!";
    }
  } else if (mode === 'detailed_science') {
    switch (factor) {
      case 'light':
        explanation =
          "I use sunlight as radiant energy! The chlorophyll in my chloroplasts absorbs photons (chiefly in blue and red wavelengths), exciting electrons to drive photolysis and generate ATP and NADPH for sugar synthesis.";
        break;
      case 'water':
        explanation =
          "Water is an indispensable electron donor in my light-dependent reactions! Through photolysis, water molecules (H₂O) are split to release electrons, protons, and pure oxygen (O₂) into your room, while maintaining leaf turgor pressure.";
        break;
      case 'co2':
        explanation =
          "Carbon dioxide (CO₂) enters my leaves via microscopic pores called stomata. During the Calvin cycle, enzyme RuBisCO fixes this carbon into organic molecules, ultimately forming glucose (C₆H₁₂O₆) for cellular respiration and cellulose growth.";
        break;
      default:
        explanation =
          "I produce my own sustenance through photosynthesis (6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂). Chlorophyll absorbs light energy to split water into oxygen and hydrogen, which is then combined with carbon dioxide captured via stomata to yield glucose for growth.";
    }
  } else {
    // Simple mode
    switch (factor) {
      case 'light':
        explanation =
          "I need sunlight because light is my primary energy source! My leaves capture light energy to power the process of turning water and carbon dioxide into food.";
        break;
      case 'water':
        explanation =
          "I need water because it's a vital raw ingredient for making my food! My roots drink it from the soil, keeping my stems standing tall while helping synthesize glucose.";
        break;
      case 'co2':
        explanation =
          "I need carbon dioxide because it supplies the carbon building blocks I need! I breathe it in from the room air through microscopic pores on my leaves called stomata.";
        break;
      default:
        explanation =
          "I do not eat food like humans or animals. I make my own food through a natural process called photosynthesis! My green leaves capture sunlight, my roots absorb water from the soil, and tiny openings take in carbon dioxide from the air. Together, they create glucose for my energy and release fresh oxygen for you!";
    }
  }

  // Append live sensor personalization if available
  if (liveAnalysis && liveAnalysis.status) {
    const score = liveAnalysis.overallScore;
    const cond = liveAnalysis.statusLabel;
    const limiting = liveAnalysis.limitingFactor;

    if (limiting && limiting.factor !== 'none' && limiting.factor !== 'undetermined') {
      explanation += ` Right now, my estimated photosynthesis condition is ${score}% (${cond}). My main limiting factor is ${limiting.factorName.toLowerCase()}—${limiting.explanation}`;
    } else {
      explanation += ` Right now, my estimated photosynthesis condition is ${score}% (${cond}), and my current environment is supporting my growth smoothly!`;
    }
  }

  return explanation;
}

function getTamilDialogue(
  factor: IntentResult['factor'],
  mode: PhotosynthesisResponseMode,
  liveAnalysis?: PhotosynthesisAnalysis | null
): string {
  let explanation = '';

  if (mode === 'child_friendly') {
    switch (factor) {
      case 'light':
        explanation =
          'சூரிய ஒளிதான் என்னோட சோலார் சார்ஜர்! ☀️ என் பச்சை இலைகள் அந்த வெயிலை உறிஞ்சி எனக்கு உணவு சமைக்க தேவையான சக்தியை தருகிறது.';
        break;
      case 'water':
        explanation =
          'என் வேர்கள் சின்ன ஸ்ட்ரா (straw) மாதிரி வேலை செய்யுது! 💧 மண்ணிலிருந்து தண்ணீரை உறிஞ்சி என் இலைகளுக்கு அனுப்பி என்னை புத்துணர்ச்சியா வச்சுக்குது.';
        break;
      case 'co2':
        explanation =
          'என் இலைகளில் உள்ள குட்டி கதவுகள் வழியா காற்றில் உள்ள கார்பன் டைஆக்சைடை நான் சுவாசிக்கிறேன்! அதுதான் என் உடல் வளர்ச்சிக்கு தேவையான செங்கற்கள்.';
        break;
      default:
        explanation =
          'நான் உங்களை மாதிரி சாப்பாடு எதுவும் சாப்பிட மாட்டேன்! என் இலைகளுக்குள்ளே ஒரு குட்டி சமையலறை இருக்கு, அதுக்கு பேருதான் ஒளிச்சேர்க்கை (Photosynthesis) 🌿! வேர்கள் வழியா தண்ணி, இலைகள் வழியா வெயில், காத்திலிருந்து கார்பன் டைஆக்சைடு சேர்த்து எனக்கு பிடிச்ச இனிப்பான குளுக்கோஸை நானே தயார் செய்வேன்!';
    }
  } else if (mode === 'detailed_science') {
    switch (factor) {
      case 'light':
        explanation =
          'சூரிய ஒளியில் உள்ள போட்டான்களை (photons) என் இலைகளில் உள்ள பச்சையம் (Chlorophyll) உறிஞ்சுகிறது. இந்த ஒளி ஆற்றல் நீரை பிளந்து (Photolysis) உணவு தயாரிக்க தேவையான வேதியியல் சக்தியை அளிக்கிறது.';
        break;
      case 'water':
        explanation =
          'வேர்கள் வழியே உறிஞ்சப்படும் நீர் (H₂O) ஒளிச்சேர்க்கையின் போது பிரிக்கப்பட்டு எலக்ட்ரான்களை வழங்குகிறது. இதன் மூலம் உங்களுக்கு தேவையான தூய ஆக்சிஜன் (O₂) வெளியிடப்படுகிறது.';
        break;
      case 'co2':
        explanation =
          'என் இலைகளில் உள்ள இலைத்துளைகள் (Stomata) வழியே கார்பன் டைஆக்சைடு உள்ளே செல்கிறது. கால்வின் சுழற்சி (Calvin Cycle) மூலம் இது குளுக்கோஸாக (C₆H₁₂O₆) மாற்றப்பட்டு என் வளர்ச்சிக்கு பயன்படுகிறது.';
        break;
      default:
        explanation =
          'ஒளிச்சேர்க்கை (Photosynthesis) மூலம் நான் சொந்தமாக உணவு தயாரிக்கிறேன் (6CO₂ + 6H₂O + ஒளி ஆற்றல் → C₆H₁₂O₆ + 6O₂). என் பச்சையம் சூரிய ஒளியை உறிஞ்சி, வேர் தந்த நீரையும் இலைத்துளைகள் தந்த கார்பன் டைஆக்சைடையும் சேர்த்து குளுக்கோஸ் உணவாக மாற்றி, சுத்தமான ஆக்சிஜனை வெளியிடுகிறது.';
    }
  } else {
    // Simple mode
    switch (factor) {
      case 'light':
        explanation =
          'எனக்கு சூரிய ஒளி ரொம்ப முக்கியம்! ஏன்னா ஒளிதான் என் உணவு தயாரிக்கும் சமையலறைக்கு தேவையான முதன்மை ஆற்றல்.';
        break;
      case 'water':
        explanation =
          'தண்ணீர் எனக்கு ஒரு முக்கிய மூலப்பொருள்! என் வேர்கள் மண்ணிலிருந்து தண்ணீரை உறிஞ்சி, இலைகளுக்கு அனுப்பி உணவு தயாரிக்க உதவுகிறது.';
        break;
      case 'co2':
        explanation =
          'என் இலைகளில் உள்ள இலைத்துளைகள் வழியா காற்றில் உள்ள கார்பன் டைஆக்சைடை எடுத்துக்கொண்டு, அதை ஊட்டச்சத்து மிக்க குளுக்கோஸாக மாற்றுகிறேன்.';
        break;
      default:
        explanation =
          'நான் மனிதர்களைப் போல உணவு உண்பதில்லை. ஒளிச்சேர்க்கை (Photosynthesis) என்ற இயற்கை முறையில் நானே எனக்கான உணவைத் தயாரிக்கிறேன்! என் இலைகள் சூரிய ஒளியையும், வேர்கள் மண்ணிலுள்ள நீரையும், இலைத்துளைகள் காற்றில் உள்ள கார்பன் டைஆக்சைடையும் உறிஞ்சி குளுக்கோஸ் (Glucose) உணவாக மாற்றி வளர்கிறேன். கூடவே உங்களுக்கு சுத்தமான ஆக்சிஜன் (Oxygen) தருகிறேன்!';
    }
  }

  // Append live sensor personalization if available
  if (liveAnalysis && liveAnalysis.status) {
    const score = liveAnalysis.overallScore;
    const cond = liveAnalysis.statusLabel;
    const limiting = liveAnalysis.limitingFactor;

    if (limiting && limiting.factor !== 'none' && limiting.factor !== 'undetermined') {
      explanation += ` இப்போதைக்கு, என் மதிப்பிடப்பட்ட ஒளிச்சேர்க்கை நிலை ${score}% (${cond}). என்னை முக்கியமாக கட்டுப்படுத்தும் காரணி: ${limiting.factorName}—${limiting.explanation}`;
    } else {
      explanation += ` இப்போதைக்கு, என் மதிப்பிடப்பட்ட ஒளிச்சேர்க்கை நிலை ${score}% (${cond}), சுற்றுச்சூழல் எனக்கு நல்ல ஆதரவாக உள்ளது!`;
    }
  }

  return explanation;
}
