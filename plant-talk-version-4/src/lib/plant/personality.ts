export type PlantPersonality =
  | 'humorous'
  | 'playful'
  | 'gentle'
  | 'cheerful'
  | 'poetic'
  | 'calm';

export const PERSONALITY_FALLBACKS: Record<PlantPersonality, readonly PlantPersonality[]> = {
  humorous: ['humorous', 'playful', 'cheerful', 'gentle', 'calm'],
  playful: ['playful', 'humorous', 'cheerful', 'gentle', 'calm'],
  gentle: ['gentle', 'calm', 'poetic'],
  cheerful: ['cheerful', 'humorous', 'playful', 'gentle', 'calm'],
  poetic: ['poetic', 'gentle', 'calm'],
  calm: ['calm', 'gentle']
} as const;

export type HealthStatus = 'healthy' | 'minor_issue' | 'needs_attention' | 'critical' | 'uncertain';

export function resolveSafePersonality(
  personality: PlantPersonality,
  healthStatus: HealthStatus | string
): PlantPersonality {
  if (healthStatus === 'critical' || healthStatus === 'Critical') {
    return personality === 'calm' ? 'calm' : 'gentle';
  }

  if ((healthStatus === 'needs_attention' || healthStatus === 'Needs Attention') && personality === 'humorous') {
    return 'gentle';
  }

  return personality;
}

export const FIXED_TAMIL_PLANT_DIALOGUES: Record<string, Partial<Record<PlantPersonality, string[]>>> = {
  needWater: {
    playful: [
      "தம்பி... தொண்டையெல்லாம் ஒரே வறட்சியா இருக்கு! கொஞ்சம் தண்ணி ஊத்துனா புண்ணியமா போகும்!",
      "ஃபோனை பார்த்துட்டே இருந்தா போதாது... வந்து எனக்கு கொஞ்சம் தண்ணி ஊத்துங்க எஜமான்!"
    ],
    humorous: [
      "ஐயோ... கண் இருட்டுதே! நான் வாடி போறதுக்குள்ள கொஞ்சம் தண்ணி கொடுங்களேன்!"
    ],
    gentle: [
      "தாகமா இருக்கு நண்பா... என்னோட வேர்களுக்கு கொஞ்சம் தண்ணீர் கொடுத்து உதவுறியா?"
    ]
  },
  tooMuchWater: {
    humorous: [
      "அன்பு அதிகம்தான் எஜமான்... ஆனா இவ்வளவு தண்ணி ஊத்துனா நான் செடியா இல்ல மீனா ஆகிடுவேன்!",
      "அய்யய்யோ... என் வேர்கள் இப்போ நீச்சல் பழகிக்கிட்டு இருக்கு! கொஞ்ச நாளைக்கு தண்ணி ஊத்தாம விடுங்கப்பா!"
    ],
    gentle: [
      "என் மண்ணுல இப்போவே போதுமான ஈரம் இருக்கு நண்பா... கொஞ்சம் காய விடுங்க."
    ],
    calm: [
      "இப்போதைக்கு தண்ணி போதும் நண்பா... மண்ணு கொஞ்சம் காயட்டும்."
    ]
  },
  needLight: {
    playful: [
      "இருட்டுல இருந்தே எனக்கு போர் அடிச்சிடுச்சு... என்னை கொஞ்சம் வெயில் படுற இடத்துக்கு மாத்துங்களேன்!"
    ],
    humorous: [
      "நான் வளரணும்னா வெறும் காத்து மட்டும் போதாது... கொஞ்சம் சூரிய வெளிச்சமும் வேணும்! என்னை ஜன்னல் கிட்ட வைங்க boss."
    ],
    poetic: [
      "சூரியனின் வெளிச்சம் என் இலைகளில் பட்டால்தான் எனக்கு உயிர் வரும்... என்னை கொஞ்சம் வெளிச்சத்தில் வை!"
    ]
  },
  tooHot: {
    humorous: [
      "அப்பப்பா... என்ன ஒரு வேக்காடு! என்னை கொஞ்சம் நிழலான இடத்துக்கு மாத்துங்கப்பா!"
    ]
  },
  tooCold: {
    playful: [
      "அய்யோ நடுங்குதே! ஏசி காத்து தாங்கல... என்னை கொஞ்சம் கதகதப்பான இடத்துல வைங்க!"
    ]
  },
  lowHumidity: {
    humorous: [
      "இந்த காத்து என்னை அப்பளம் ஆக்க பிளான் போட்டிருக்கு போல! கொஞ்சம் ஈரமா வைங்கப்பா!",
      "அப்பப்பா... காத்தே ரொம்ப வறண்டுபோச்சு! என் இலை நுனியெல்லாம் சோர்ந்து போகுது நண்பா!"
    ],
    gentle: [
      "இங்க காத்து கொஞ்சம் வறண்டிருக்கு நண்பா... எனக்கு சின்னதா ஈரம் கிடைச்சா நல்லா இருக்கும்."
    ],
    calm: [
      "காத்து கொஞ்சம் வறண்டிருக்கு... என் இலைகளுக்கு சின்ன உதவி வேணும் நண்பா."
    ]
  },
  highHumidity: {
    humorous: [
      "இங்க காத்தே குளிச்சிட்டு வந்த மாதிரி ஈரமா இருக்கு! கொஞ்சம் காத்தாட விடுங்கப்பா!",
      "அய்யோ... இங்க ஒரே புழுக்கமா இருக்கு! நல்ல காத்து வர்ற இடத்துக்கு மாத்துங்க!"
    ],
    gentle: [
      "என்னைச் சுற்றி ஈரம் கொஞ்சம் அதிகமா இருக்கு நண்பா... நல்ல காத்து கிடைச்சா சுகமா இருக்கும்."
    ],
    calm: [
      "கொஞ்சம் காத்தாடுற இடத்துக்கு மாத்துங்க நண்பா... இங்க ஈரம் அதிகமா இருக்கு."
    ]
  },
  tooMuchLight: {
    humorous: [
      "சூரியன் இன்னைக்கு என்னோட நேரடியா சண்டைக்கு வந்துட்டான் போல! கொஞ்சம் காப்பாத்துங்க நண்பா!",
      "அப்பப்பா... வெயில் என்னை வறுவல் போட்டுக்கிட்டு இருக்கு! கொஞ்சம் நிழலுக்கு மாத்துங்கப்பா!"
    ],
    gentle: [
      "வெயில் கொஞ்சம் அதிகமா இருக்கு நண்பா... சின்ன நிழல் கிடைச்சா நல்லா இருக்கும்."
    ],
    calm: [
      "என்னை கொஞ்சம் நிழலான இடத்துக்கு மாத்துங்க... இந்த வெளிச்சம் அதிகமா இருக்கு."
    ]
  },
  needFertilizer: {
    humorous: [
      "வயிற்றை பசிக்குதே! வெறும் தண்ணி மட்டும் பத்தாது, கொஞ்சம் நல்ல உரமும் போடுங்க!"
    ]
  },
  needRepotting: {
    gentle: [
      "என் வேர்களுக்கு இந்த தொட்டி ரொம்ப சின்னதா இருக்கு! கொஞ்சம் பெரிய தொட்டிக்கு என்னை மாத்துறீங்களா?"
    ]
  },
  happyAndHealthy: {
    cheerful: [
      "தேங்க்ஸ் நண்பா! தண்ணியும் வெளிச்சமும் கரெக்டா கிடைச்சிருச்சு... இனி பாரு எனக்கு புது இலை வருதா இல்லையான்னு!",
      "சூப்பர்! இப்போ தான் எனக்கு புத்துணர்ச்சியா இருக்கு... Have a nice day!"
    ]
  },
  photosynthesisGeneral: {
    cheerful: [
      "நான் மனிதர்களைப் போல உணவு சாப்பிடுவதில்லை நண்பா! ஒளிச்சேர்க்கை (Photosynthesis) மூலமா என் இலைகளில் சூரிய ஒளியையும் நீரையும் வச்சு எனக்கான குளுக்கோஸை நானே தயார் செய்றேன்!",
      "என் இலைகளுக்குள்ளே ஒரு குட்டி சமையலறை இருக்கு! சூரிய வெளிச்சம், நீர், காற்று சேர்த்து நானே எனக்கான உணவை தயாரிச்சுப்பேன்."
    ],
    gentle: [
      "ஒளிச்சேர்க்கை மூலமா நானே உணவு தயாரித்து உங்களுக்கு தூய ஆக்சிஜனையும் தருகிறேன் நண்பா.",
      "என் வேர்கள் உறிஞ்சும் நீரும் இலைகள் ஏற்கும் சூரிய ஒளியும் சேர்ந்து என்னை பசுமையா வளர வைக்குது."
    ]
  },
  photosynthesisLowLight: {
    humorous: [
      "சூரிய ஒளி கம்மியா இருக்கு நண்பா... என் ஒளிச்சேர்க்கை சமையலறையில இன்னைக்கு கேஸ் தீர்ந்துபோன மாதிரி இருக்கு! கொஞ்சம் வெளிச்சம் காட்டுங்க!",
    ],
    gentle: [
      "வெளிச்சம் குறைவாக இருப்பதால் என்னால் முழுமையாக உணவு தயாரிக்க முடியவில்லை நண்பா. என்னை கொஞ்சம் ஜன்னல் பக்கம் மாத்துங்களேன்."
    ]
  },
  pestVisible: {
    humorous: [
      "அடடா... யாரோ என் இலையை இலவச ஹோட்டல்னு நினைச்சுட்டாங்க! கொஞ்சம் வந்து பாருங்கப்பா!"
    ]
  },
  yellowLeaves: {
    humorous: [
      "இந்த மஞ்சள் இலை என் புதிய ஸ்டைல் இல்லப்பா... கொஞ்சம் என்னை கவனிங்க!"
    ]
  },
  wiltedLeaves: {
    humorous: [
      "என் இலைகள் எல்லாம் கீழே பார்த்துக்கிட்டு இருக்கு... யாராவது கொஞ்சம் உற்சாகப்படுத்துங்கப்பா!"
    ],
    gentle: [
      "நான் கொஞ்சம் சோர்வா இருக்கேன் நண்பா... நல்ல கவனிப்பு கிடைச்சா மறுபடியும் நிமிர்ந்திடுவேன்."
    ],
    calm: [
      "என் இலைகள் கொஞ்சம் சோர்ந்திருக்கு... ஒருமுறை என்னை கவனிச்சுப் பாருங்க."
    ]
  },
  dryOrDamagedLeaves: {
    humorous: [
      "என் இலைக்கு கொஞ்சம் காயம் பட்டிருக்கு... இன்று நாள் எனக்கு சரியில்ல போல!"
    ],
    gentle: [
      "என் இலைக்கு கொஞ்சம் சேதம் இருக்கு நண்பா... மெதுவா என்னை கவனிங்க."
    ],
    calm: [
      "என் சில இலைகள் சரியில்ல... ஒருமுறை பார்த்து உதவுங்க நண்பா."
    ]
  },
  brokenStem: {
    gentle: [
      "என் தண்டுக்கு காயம் பட்டிருக்கு நண்பா... கொஞ்சம் மெதுவா என்னை சரிசெய்து உதவுங்க."
    ],
    calm: [
      "என் தண்டு சரியில்ல நண்பா... கவனமா பார்த்து உதவுங்க."
    ]
  },
  flowersVisible: {
    cheerful: [
      "என் பூவை பார்த்தீங்களா? இன்னைக்கு நான்தான் இங்க ஹீரோ!"
    ]
  },
  noFlowersVisible: {
    humorous: [
      "இன்னும் பூ வரல நண்பா... பெரிய நிகழ்ச்சிக்கு தயாராகிக்கிட்டு இருக்கேன்!"
    ],
    playful: [
      "இன்னும் பூ வரல நண்பா... நல்ல விஷயங்களுக்கு கொஞ்சம் நேரம் வேணுமே!"
    ],
    cheerful: [
      "பூக்கள் இன்னும் தயாராகிக்கிட்டு இருக்கு... சீக்கிரம் ஒரு சர்ப்ரைஸ் வரும்!"
    ],
    calm: [
      "இன்னும் பூ தெரியல நண்பா... கொஞ்சம் நேரம் கொடுங்க."
    ]
  }
} as const;

/**
 * Fallback response if the condition cannot be mapped to anything
 */
const DEFAULT_FALLBACK_TEXT = "இப்போதைக்கு நான் நல்லா இருக்கேன் நண்பா... என்னைக் கவனிச்சுக்கோங்க.";

/**
 * Returns the exact fixed dialogue string for a given condition, personality, and health status.
 */
export function getPlantDialogue(
  condition: string,
  personality: PlantPersonality,
  healthStatus: string
): string {
  const safePersonality = resolveSafePersonality(personality, healthStatus);
  const fallbacks = PERSONALITY_FALLBACKS[safePersonality];

  const conditionDialogues = FIXED_TAMIL_PLANT_DIALOGUES[condition];
  
  // If the condition doesn't exist at all, return the default fallback.
  if (!conditionDialogues) {
    return DEFAULT_FALLBACK_TEXT;
  }

  // Iterate over personality fallbacks to find an available dialogue list.
  for (const p of fallbacks) {
    const list = conditionDialogues[p as PlantPersonality];
    if (list && list.length > 0) {
      // Pick a random string from the available options for this condition + personality
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  // If even after full fallback chain there's no matching dialogue, pick ANY available key as a last resort
  const anyAvailableKey = Object.keys(conditionDialogues)[0] as PlantPersonality | undefined;
  if (anyAvailableKey && conditionDialogues[anyAvailableKey]) {
    const list = conditionDialogues[anyAvailableKey]!;
    if (list.length > 0) {
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  return DEFAULT_FALLBACK_TEXT;
}
