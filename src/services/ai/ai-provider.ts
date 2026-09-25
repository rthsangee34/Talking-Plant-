export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'local';

export interface PlantSensorContext {
  soilMoisture: number; // 0 - 100%
  lightIntensity: number; // 0 - 100%
  temperature: number; // Celsius
  humidity: number; // 0 - 100%
  timestamp?: string;
}

export interface ChatMessageEntry {
  sender: 'user' | 'plant' | 'system';
  text: string;
  isVoice?: boolean;
  timestamp: string;
}

export interface PlantAnalysisDetails {
  speciesName: string;
  scientificName: string;
  appearance: string;
  growthCondition: string;
  leafCondition: string;
  visibleAbnormalities: string[];
}

export interface PlantConditionReport {
  overallHealth: 'Healthy' | 'Needs Attention' | 'Critical';
  soilStatus: string;
  lightingStatus: string;
  temperatureStatus: string;
  humidityStatus: string;
}

export interface PlantAnalysisResult {
  timestamp: string;
  plantDetails: PlantAnalysisDetails;
  plantCondition: PlantConditionReport;
  possibleProblems: string[];
  recommendations: string[];
  rawSummary?: string;
}

export interface AnalysisInput {
  imageUrl?: string | null;
  images?: string[];
  sensors: PlantSensorContext;
}

export interface AIProviderValidationResult {
  valid: boolean;
  message: string;
  errorType?: 'EMPTY_KEY' | 'INVALID_KEY' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'UNKNOWN';
}

export interface AIProvider {
  id: AIProviderType;
  name: string;
  description: string;
  validateKey(apiKey: string): Promise<AIProviderValidationResult>;
  chat(
    message: string,
    apiKey: string,
    context: PlantSensorContext,
    history?: ChatMessageEntry[]
  ): Promise<{ reply: string; audioBase64?: string }>;
  analyzePlant(
    input: AnalysisInput,
    apiKey: string
  ): Promise<PlantAnalysisResult>;
}
