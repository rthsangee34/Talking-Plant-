export type LiveVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'stopping'
  | 'error';

export interface LiveVoiceError {
  code:
    | 'PERMISSION_DENIED'
    | 'MICROPHONE_UNAVAILABLE'
    | 'MICROPHONE_IN_USE'
    | 'UNSUPPORTED_BROWSER'
    | 'NETWORK_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'MODEL_ERROR'
    | 'AUDIO_PLAYBACK_ERROR'
    | 'UNKNOWN_ERROR';
  message: string;
  originalError?: unknown;
}

export interface LiveTranscriptTurn {
  sender: 'user' | 'plant';
  text: string;
  isFinal: boolean;
  timestamp: string;
  language?: 'en' | 'ta' | 'mixed';
}

export interface LivePlantContext {
  plantName?: string;
  species?: string;
  soilMoisture?: number;
  lightIntensity?: number;
  temperature?: number;
  humidity?: number;
  co2?: number;
  plantHealth?: string;
  cameraStatus?: boolean;
  arduinoStatus?: boolean;
  flowerStatus?: string;
  caregiverNotes?: string;
}

export interface LiveSessionConfig {
  model?: string;
  voice?: string;
  preferredLanguage?: 'en' | 'ta' | 'mixed';
  apiKey?: string;
  ephemeralToken?: string;
  systemInstruction?: string;
  plantContext?: LivePlantContext;
}

export interface LiveServiceCallbacks {
  onStateChange?: (state: LiveVoiceState, errorMessage?: string) => void;
  onUserTranscript?: (text: string, isFinal: boolean, language?: 'en' | 'ta' | 'mixed') => void;
  onAssistantTranscript?: (text: string, isFinal: boolean, language?: 'en' | 'ta' | 'mixed') => void;
  onAudioChunk?: (pcm16: ArrayBuffer) => void;
  onInterruption?: () => void;
  onError?: (error: LiveVoiceError) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) => void;
}
