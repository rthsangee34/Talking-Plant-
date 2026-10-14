import { z } from 'zod';

const normalizeConfidence = (val: unknown): number => {
  if (typeof val === 'number') {
    if (val > 1) return Math.min(1, val / 100);
    if (val < 0) return 0;
    return val;
  }
  if (typeof val === 'string') {
    const num = parseFloat(val);
    if (!isNaN(num)) return num > 1 ? Math.min(1, num / 100) : Math.max(0, num);
  }
  return 0.8;
};

export const PlantSensorReadingsSchema = z.object({
  moisture: z.coerce.number().min(0).max(100),
  light: z.coerce.number().min(0).max(100),
  temperature: z.coerce.number().nullable().optional(),
  humidity: z.coerce.number().nullable().optional(),
  co2: z.coerce.number().nullable().optional(),
});

export const SpeciesIdentificationSchema = z.object({
  commonName: z.string().nullable().optional(),
  scientificName: z.string().nullable().optional(),
  confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(1)).default(0.8),
  alternatives: z
    .array(
      z.object({
        name: z.string().default(''),
        confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(1)).default(0.5),
      })
    )
    .catch([]),
  identifyingFeatures: z.array(z.string()).catch([]),
});

export const ImageQualitySchema = z.object({
  usable: z.boolean().default(true),
  sharpness: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.includes('good') || lower.includes('high') || lower.includes('sharp')) return 'good';
        if (lower.includes('poor') || lower.includes('low') || lower.includes('blur')) return 'poor';
      }
      return 'acceptable';
    }, z.enum(['good', 'acceptable', 'poor']))
    .default('good'),
  lighting: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.includes('dark') || lower.includes('low')) return 'dark';
        if (lower.includes('over') || lower.includes('bright')) return 'overexposed';
      }
      return 'good';
    }, z.enum(['good', 'dark', 'overexposed']))
    .default('good'),
  framing: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.includes('far')) return 'too-far';
        if (lower.includes('close')) return 'too-close';
        if (lower.includes('part')) return 'partial';
      }
      return 'good';
    }, z.enum(['good', 'too-far', 'too-close', 'partial']))
    .default('good'),
  flowerSearchPossible: z.boolean().default(true),
  issues: z.array(z.string()).catch([]),
  guidance: z.string().nullable().optional(),
});

export const FlowersSchema = z.object({
  detected: z.boolean().default(false),
  countEstimate: z.coerce.number().nullable().optional(),
  colors: z.array(z.string()).catch([]),
  condition: z.string().nullable().optional(),
  confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(1)).default(0.5),
  evidence: z.string().default(''),
  visibility: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase().replace('_', '-');
        if (['clear', 'partial', 'uncertain', 'not-visible'].includes(lower)) return lower;
        if (lower.includes('not') || lower.includes('none') || lower.includes('hidden')) return 'not-visible';
        if (lower.includes('part')) return 'partial';
        if (lower.includes('unsure') || lower.includes('uncertain')) return 'uncertain';
      }
      return 'clear';
    }, z.enum(['clear', 'partial', 'uncertain', 'not-visible']))
    .default('clear'),
  flowerType: z.string().nullable().optional(),
  locations: z.array(z.string()).catch([]),
  possibleFlowerRegions: z.array(z.string()).catch([]),
  requiresCloserView: z.boolean().default(false),
  statusState: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase().replace('_', '-');
        if (['confirmed', 'likely', 'uncertain', 'not-visible'].includes(lower)) return lower;
        if (lower.includes('confirm') || lower.includes('yes') || lower.includes('present')) return 'confirmed';
        if (lower.includes('likely') || lower.includes('probab')) return 'likely';
        if (lower.includes('unsure') || lower.includes('uncertain') || lower.includes('bud')) return 'uncertain';
        if (lower.includes('not') || lower.includes('no')) return 'not-visible';
      }
      return 'not-visible';
    }, z.enum(['confirmed', 'likely', 'uncertain', 'not-visible']))
    .default('not-visible'),
});

export const BudsSchema = z.object({
  detected: z.boolean().default(false),
  countEstimate: z.coerce.number().nullable().optional(),
  confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(1)).default(0.5),
  evidence: z.string().optional().default(''),
});

export const DamagedPartSchema = z.object({
  partType: z.string(),
  damageType: z.string(),
  location: z.string(),
  severity: z.enum(['none', 'minor', 'moderate', 'severe', 'uncertain']),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

export const StructuralDamageSchema = z.object({
  detected: z.boolean(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['none', 'minor', 'moderate', 'severe', 'uncertain']),
  damagedPartCount: z.number().int().min(0),
  damagedParts: z.array(DamagedPartSchema).default([]),
  evidence: z.array(z.string()).default([]),
  needsCloserImage: z.boolean().default(false),
});

export const FriendlyResponseSchema = z.object({
  english: z.string().default(''),
  tamil: z.string().default(''),
});

export const LeavesSchema = z.object({
  color: z.string().default('green'),
  condition: z.string().default('healthy'),
  issues: z.array(z.string()).catch([]),
});

export const PestsSchema = z.object({
  detected: z.boolean().default(false),
  evidence: z.array(z.string()).catch([]),
});

export const MultiPlantIndividualSchema = z.object({
  plantId: z.string(),
  role: z.enum(['main', 'friend']).default('friend'),
  displayName: z.string(),
  position: z.string(),
  commonName: z.string().nullable().optional(),
  scientificName: z.string().nullable().optional(),
  identificationConfidence: z.string(),
  visibleCondition: z.string(),
  leaves: z.object({
    condition: z.string(),
    issues: z.array(z.string())
  }),
  flowers: z.object({
    status: z.string(),
    countEstimate: z.number().nullable().optional(),
    details: z.string()
  }),
  buds: z.object({
    status: z.string(),
    countEstimate: z.number().nullable().optional()
  }),
  pests: z.object({
    detected: z.boolean(),
    details: z.string()
  }),
  damage: z.object({
    detected: z.boolean(),
    details: z.string()
  }),
  recommendation: z.string(),
  plantMessage: z.string().optional(),
  conditionKey: z.string().default('happyAndHealthy'),
  personalityTone: z.string().default('humorous'),
  needsAttention: z.boolean().default(false),
});

export const ConversationTurnSchema = z.object({
  speakerId: z.string(),
  text: z.string()
});

export const PlantAnalysisSchema = z.object({
  totalPlantsDetected: z.number().default(0),
  sceneSummary: z.string().default('No plant can be clearly detected in this frame.'),
  mainPlantId: z.string().nullable().optional(),
  plants: z.array(MultiPlantIndividualSchema).default([]),
  conversation: z.array(ConversationTurnSchema).default([]),
  imageQuality: ImageQualitySchema.optional(),
  timestamp: z.string().optional(),
});

export const PlantObservationSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string().optional(),
  visualEvidence: z.string().default('Visual check complete.'),
  sensorEvidence: z.string().default('Sensor telemetry checked.'),
  interpretation: z.string().default('Plant is responding well to environment.'),
  healthStatus: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.includes('thriv')) return 'Thriving';
        if (lower.includes('good') || lower.includes('healthy')) return 'Good';
        if (lower.includes('attent') || lower.includes('warn')) return 'Needs Attention';
        if (lower.includes('critic') || lower.includes('poor')) return 'Critical';
      }
      return 'Thriving';
    }, z.enum(['Thriving', 'Good', 'Needs Attention', 'Critical']))
    .default('Thriving'),
  urgentNeeds: z.array(z.string()).catch([]),
  sensoryNote: z.string().optional().default(''),
  conditionKey: z.string().default('happyAndHealthy'),
  personalityTone: z.string().default('humorous'),
  actionRequired: z.boolean().default(false),
  moisture: z.coerce.number().default(50),
  light: z.coerce.number().default(60),
  temperature: z.coerce.number().nullable().optional(),
  humidity: z.coerce.number().nullable().optional(),
  co2: z.coerce.number().nullable().optional(),
  imageUrl: z.string().optional(),
});
