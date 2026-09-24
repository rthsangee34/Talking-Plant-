/**
 * AI Plant Personality & Bilingual Explanation Layer
 *
 * Explains deterministic health engine findings in English and Sri Lankan Tamil.
 * Features:
 * - Deterministic condition input (AI never decides health status)
 * - Living Plant personalities: Angry 😤, Humorous 😂, Protective 🛡️, Friendly 🌱
 * - Zero-failure fallbacks for instant offline reliability
 * - Asynchronous Gemini enrichment when API key is available
 */

export interface HealthExplanationRequest {
  plantName?: string;
  species?: string;
  temperature: number | null;
  humidity: number | null;
  soilMoisture: number;
  healthStatus: string;
  reason: string;
  trend: string;
  personality?: 'angry' | 'humorous' | 'friendly' | 'protective';
}

export interface HealthExplanationResult {
  english: string;
  tamil: string;
  personality: 'angry' | 'humorous' | 'friendly' | 'protective';
  source: 'ai' | 'fallback';
}

// ─── Instant Offline Pre-Cached Explanations ─────────────────────────────────

const PRECACHED_EXPLANATIONS = {
  CRITICAL_DRY: {
    humorous: {
      english: "Hey! My soil is bone dry! I'm a living plant, not a desert cactus! 😤🌱 Go grab the watering can!",
      tamil: "என் மண்ணில் ஈரப்பதம் சுத்தமா இல்ல! நான் பாலைவனக் கள்ளிச்செடி இல்லையே! 😤🌱 உடனே கொஞ்சம் தண்ணி ஊத்துங்கப்பா!",
    },
    angry: {
      english: "Excuse me?! Look at this soil! It's like the Sahara down here! Water me right now! 😤",
      tamil: "மண்ணை பாத்தீங்களா?! ரொம்ப காய்ஞ்சு போச்சு! என்ன வாட விட்டுடாதீங்க, சீக்கிரம் தண்ணி ஊத்துங்க! 😤",
    },
    protective: {
      english: "Emergency alert from my root zone! Moisture is critically depleted. Please hydrate me immediately! 🛡️",
      tamil: "வேர் பகுதியில் இருந்து அவசர எச்சரிக்கை! ஈரப்பதம் மிகக் குறைவாக உள்ளது. உடனடியாக தண்ணீர் தேவை! 🛡️",
    },
  },
  ATTENTION_DRY: {
    humorous: {
      english: "Hmm, my pot is starting to feel a bit crispy. A refreshing drink would be nice today! 🌱💧",
      tamil: "ம்ம், மண் கொஞ்சம் காய ஆரம்பிச்சிருக்கு. இன்னைக்கு கொஞ்சம் தண்ணி ஊத்துனா நல்லா இருக்கும்! 🌱💧",
    },
    angry: {
      english: "Hey, don't let me dry out! Check my soil before I get grumpy! 😤",
      tamil: "ஏய், என்னை காய விடாதீங்க! நான் வாடுறதுக்கு முன்னாடி மண்ணை கொஞ்சம் பாருங்க! 😤",
    },
  },
  HEATWAVE: {
    humorous: {
      english: "Whew! Is it hot in here or is it just me? I'm sweating through my stomata! Move me to the shade! ☀️🥵",
      tamil: "அப்பப்பா! என்ன ஒரு வெயில்! இலைகள் எல்லாம் சூடாயிடுச்சு! என்னை கொஞ்சம் நிழலில் வைங்கப்பா! ☀️🥵",
    },
    angry: {
      english: "Too hot! I am photosynthesizing, not baking in an oven! Cool this place down! 😤🔥",
      tamil: "ரொம்ப வெப்பமா இருக்கு! நான் தாவரம், அவனில் வேகும் பொருள் இல்லை! இடத்தை மாத்துங்க! 😤🔥",
    },
  },
  WATERLOGGED: {
    humorous: {
      english: "Glub glub! My roots are wearing scuba gear! Give the water a rest, friend! 🌊🌿",
      tamil: "ஐயோ! வேரெல்லாம் தண்ணில மூழ்குது! கொஞ்சம் தண்ணி ஊத்துறதை நிறுத்துங்கப்பா! 🌊🌿",
    },
  },
  HEALTHY: {
    friendly: {
      english: "Everything feels amazing! My leaves are crisp, temperature is cozy, and photosynthesis is thriving! 🌿✨",
      tamil: "எல்லாம் மிக அருமையாக உள்ளது! இலைகள் பசுமையா, நல்ல ஈரப்பதத்துடன் மகிழ்ச்சியாக இருக்கிறேன்! 🌿✨",
    },
  },
};

/**
 * Generate a bilingual explanation for the deterministic health state.
 */
export async function generatePlantHealthExplanation(
  request: HealthExplanationRequest
): Promise<HealthExplanationResult> {
  const personality = request.personality || (request.healthStatus === 'CRITICAL' ? 'angry' : 'humorous');

  // 1. Check if Gemini API key exists (prefer sessionStorage, then legacy fallback)
  const apiKey = typeof window !== 'undefined' 
    ? (window.sessionStorage.getItem('plant_talk_gemini_api_key') || localStorage.getItem('gemini_api_key'))
    : null;

  if (apiKey && request.healthStatus !== 'HEALTHY') {
    try {
      const prompt = `You are the witty, living personality of a houseplant named "${request.plantName || 'Plant'}".
The hardware monitoring system computed the following plant status:
- Plant Species: ${request.species || 'Indoor Plant'}
- Current Soil Moisture: ${request.soilMoisture}%
- Temperature: ${request.temperature ?? 'N/A'}°C
- Humidity: ${request.humidity ?? 'N/A'}%
- Deterministic Health Status: ${request.healthStatus}
- Reason: ${request.reason}
- Trend: ${request.trend}
- Tone: ${personality} (witty, slightly sassy living houseplant, protective of its leaves)

Provide:
1. Short English message (max 2 sentences, include plant emoji)
2. Sri Lankan Tamil translation (natural spoken Jaffna/Colombo conversational Tamil, max 2 sentences)

Return ONLY JSON:
{
  "english": "...",
  "tamil": "..."
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.english && parsed.tamil) {
            return {
              english: parsed.english,
              tamil: parsed.tamil,
              personality,
              source: 'ai',
            };
          }
        }
      }
    } catch {
      // Fallback on error
    }
  }

  // 2. Guaranteed instant offline fallback
  return getFallbackExplanation(request, personality);
}

function getFallbackExplanation(
  request: HealthExplanationRequest,
  personality: 'angry' | 'humorous' | 'friendly' | 'protective'
): HealthExplanationResult {
  if (request.healthStatus === 'CRITICAL') {
    if (request.temperature && request.temperature > 35) {
      return {
        english: PRECACHED_EXPLANATIONS.HEATWAVE[personality === 'angry' ? 'angry' : 'humorous'].english,
        tamil: PRECACHED_EXPLANATIONS.HEATWAVE[personality === 'angry' ? 'angry' : 'humorous'].tamil,
        personality,
        source: 'fallback',
      };
    }
    const pool = PRECACHED_EXPLANATIONS.CRITICAL_DRY;
    const entry = personality === 'angry' ? pool.angry : personality === 'protective' ? pool.protective : pool.humorous;
    return {
      english: entry.english,
      tamil: entry.tamil,
      personality,
      source: 'fallback',
    };
  }

  if (request.healthStatus === 'ATTENTION' || request.healthStatus === 'STRESSED') {
    if (request.soilMoisture > 80) {
      return {
        english: PRECACHED_EXPLANATIONS.WATERLOGGED.humorous.english,
        tamil: PRECACHED_EXPLANATIONS.WATERLOGGED.humorous.tamil,
        personality,
        source: 'fallback',
      };
    }
    const pool = PRECACHED_EXPLANATIONS.ATTENTION_DRY;
    const entry = personality === 'angry' ? pool.angry : pool.humorous;
    return {
      english: entry.english,
      tamil: entry.tamil,
      personality,
      source: 'fallback',
    };
  }

  return {
    english: PRECACHED_EXPLANATIONS.HEALTHY.friendly.english,
    tamil: PRECACHED_EXPLANATIONS.HEALTHY.friendly.tamil,
    personality: 'friendly',
    source: 'fallback',
  };
}
