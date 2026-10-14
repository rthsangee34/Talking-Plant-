import { PlantPersonality } from './lib/plant/personality';

export type PlantSensorReadings = {
  moisture: number; // 0 - 100%
  light: number; // 0 - 100%
  temperature?: number | null; // Celsius e.g. 24.5
  humidity?: number | null; // 0 - 100%
  co2?: number | null; // ppm e.g. 600
};

export type PlantProfile = {
  id: string;
  name: string;
  species: string;
  location: string;
  plantedDate: string;
  targetMoistureMin: number;
  targetMoistureMax: number;
  targetLightMin: number;
  targetLightMax: number;
  description: string;
  avatarUrl?: string;
  personality?: PlantPersonality;
};

export type SpeciesIdentification = {
  commonName: string | null;
  scientificName: string | null;
  confidence: number;
  alternatives: Array<{ name: string; confidence: number }>;
  identifyingFeatures: string[];
};

export type ImageQualityInfo = {
  usable: boolean;
  sharpness: 'good' | 'acceptable' | 'poor';
  lighting: 'good' | 'dark' | 'overexposed';
  framing: 'good' | 'too-far' | 'too-close' | 'partial';
  flowerSearchPossible: boolean;
  issues: string[];
  guidance: string | null;
};

export type FlowersInfo = {
  detected: boolean;
  countEstimate: number | null;
  colors: string[];
  condition: string | null;
  confidence: number;
  evidence: string;
  visibility?: 'clear' | 'partial' | 'uncertain' | 'not-visible';
  flowerType?: string | null;
  locations?: string[];
  possibleFlowerRegions?: string[];
  requiresCloserView?: boolean;
  statusState?: 'confirmed' | 'likely' | 'uncertain' | 'not-visible';
};

export type BudsInfo = {
  detected: boolean;
  countEstimate: number | null;
  confidence?: number;
  evidence?: string;
};

export type DamagedPlantPart = {
  partType: string;
  damageType: string;
  location: string;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'uncertain';
  confidence: number;
  evidence: string;
};

export type StructuralDamageInfo = {
  detected: boolean;
  confidence: number;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'uncertain';
  damagedPartCount: number;
  damagedParts: DamagedPlantPart[];
  evidence: string[];
  needsCloserImage: boolean;
};

export type FriendlyResponse = {
  english: string;
  tamil: string;
};

export type LeavesInfo = {
  color: string;
  condition: string;
  issues: string[];
};

export type PestsInfo = {
  detected: boolean;
  evidence: string[];
};

export type MultiPlantIndividual = {
  plantId: string;
  role: 'main' | 'friend';
  displayName: string;
  position: string;
  commonName?: string | null;
  scientificName?: string | null;
  identificationConfidence: string;
  visibleCondition: string;
  leaves: {
    condition: string;
    issues: string[];
  };
  flowers: {
    status: string;
    countEstimate?: number | null;
    details: string;
  };
  buds: {
    status: string;
    countEstimate?: number | null;
  };
  pests: {
    detected: boolean;
    details: string;
  };
  damage: {
    detected: boolean;
    details: string;
  };
  recommendation: string;
  plantMessage?: string;
  needsAttention: boolean;
  personality?: PlantPersonality;
};

export type ConversationTurn = {
  speakerId: string;
  text: string;
};

export type PlantAnalysis = {
  totalPlantsDetected: number;
  sceneSummary: string;
  mainPlantId?: string | null;
  plants: MultiPlantIndividual[];
  conversation: ConversationTurn[];
  imageQuality?: ImageQualityInfo;
  timestamp?: string;
};

export type PlantObservation = {
  id: string;
  timestamp: string;
  visualEvidence: string;
  sensorEvidence: string;
  interpretation: string;
  healthStatus: 'Thriving' | 'Good' | 'Needs Attention' | 'Critical';
  urgentNeeds: string[];
  sensoryNote: string; // The plant's first-person voice remark
  actionRequired: boolean;
  moisture: number;
  light: number;
  temperature?: number | null;
  humidity?: number | null;
  co2?: number | null;
  imageUrl?: string;
};

export type ToolCallLog = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  timestamp: string;
};

export type ChatMessage = {
  id: string;
  sender: 'user' | 'plant' | 'system';
  text: string;
  timestamp: string;
  language?: 'en' | 'ta' | 'mixed';
  toolCalls?: ToolCallLog[];
};

export type LiveSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error';
