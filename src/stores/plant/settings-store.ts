import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SESSION_KEY_STORAGE_KEY = 'plant_talk_gemini_api_key';
export const LOCAL_KEY_STORAGE_KEY = 'plant_talk_saved_api_key';

export type ApiKeyStatus =
  | 'NO_KEY'
  | 'CONNECTING'
  | 'AI_READY'
  | 'INVALID_KEY'
  | 'AI_OFFLINE'
  | 'RATE_LIMITED';

interface SettingsState {
  aiProvider: 'gemini' | 'openai' | 'anthropic' | 'local';
  preferredLanguage: 'en' | 'ta' | 'mixed';
  geminiVisionModel: string;
  geminiLiveModel: string;
  apiKeyConfigured: boolean;
  apiKey: string;
  apiStatus: ApiKeyStatus;
  apiStatusMessage: string;
  isSetupModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isAnalysisModalOpen: boolean;
  isDisconnectConfirmOpen: boolean;
  isFullscreenVisionOpen: boolean;

  setAiProvider: (provider: 'gemini' | 'openai' | 'anthropic' | 'local') => void;
  setPreferredLanguage: (lang: 'en' | 'ta' | 'mixed') => void;
  setGeminiVisionModel: (model: string) => void;
  setGeminiLiveModel: (model: string) => void;
  setApiKeyConfigured: (configured: boolean) => void;
  setApiKey: (key: string) => void;
  setApiStatus: (status: ApiKeyStatus, message?: string) => void;
  openSetupModal: () => void;
  closeSetupModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openAnalysisModal: () => void;
  closeAnalysisModal: () => void;
  openDisconnectConfirm: () => void;
  closeDisconnectConfirm: () => void;
  setIsFullscreenVisionOpen: (open: boolean) => void;
  disconnectApiKey: () => void;
  validateAndConnectKey: (key: string) => Promise<{ success: boolean; message: string }>;
}

const getInitialStoredKey = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const sess = window.sessionStorage?.getItem(SESSION_KEY_STORAGE_KEY);
      if (sess && sess.trim()) return sess.trim();
      const local = window.localStorage?.getItem(LOCAL_KEY_STORAGE_KEY);
      if (local && local.trim()) return local.trim();
    } catch {
      return '';
    }
  }
  return '';
};

const initialKey = getInitialStoredKey();

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      aiProvider: 'gemini',
      preferredLanguage: 'mixed',
      geminiVisionModel: 'gemini-3.6-flash',
      geminiLiveModel: 'gemini-3.6-flash',
      apiKeyConfigured: initialKey.length > 0,
      apiKey: initialKey,
      apiStatus: initialKey.length > 0 ? 'AI_READY' : 'NO_KEY',
      apiStatusMessage: initialKey.length > 0 ? 'Gemini AI Ready' : 'Gemini AI Setup Required',
      isSetupModalOpen: false,
      isSettingsModalOpen: false,
      isAnalysisModalOpen: false,
      isDisconnectConfirmOpen: false,
      isFullscreenVisionOpen: false,

      setAiProvider: (provider) => set({ aiProvider: provider }),
      setPreferredLanguage: (lang) => set({ preferredLanguage: lang }),
      setGeminiVisionModel: (model) => set({ geminiVisionModel: model }),
      setGeminiLiveModel: (model) => set({ geminiLiveModel: model }),
      setApiKeyConfigured: (configured) => set({ apiKeyConfigured: configured }),

      setApiKey: (key: string) => {
        const trimmed = key.trim();
        if (typeof window !== 'undefined') {
          try {
            if (trimmed) {
              window.sessionStorage?.setItem(SESSION_KEY_STORAGE_KEY, trimmed);
              window.localStorage?.setItem(LOCAL_KEY_STORAGE_KEY, trimmed);
            } else {
              window.sessionStorage?.removeItem(SESSION_KEY_STORAGE_KEY);
              window.localStorage?.removeItem(LOCAL_KEY_STORAGE_KEY);
            }
          } catch {
            // Storage sandbox fallback
          }
        }
        set({
          apiKey: trimmed,
          apiKeyConfigured: trimmed.length > 0,
          apiStatus: trimmed.length > 0 ? 'AI_READY' : 'NO_KEY',
          apiStatusMessage: trimmed.length > 0 ? 'Gemini AI Ready' : 'Gemini AI Setup Required',
        });
      },

      setApiStatus: (status: ApiKeyStatus, message?: string) => {
        const defaultMessages: Record<ApiKeyStatus, string> = {
          NO_KEY: 'Gemini AI Setup Required',
          CONNECTING: 'Connecting to Plant Talk AI…',
          AI_READY: 'Gemini AI Ready',
          INVALID_KEY: 'The API key could not be validated. Please check the key and try again.',
          AI_OFFLINE: 'Unable to connect to the AI service. Check your internet connection.',
          RATE_LIMITED: 'The AI service has reached its usage limit. Please check your API account.',
        };
        set({
          apiStatus: status,
          apiStatusMessage: message || defaultMessages[status] || 'Unknown status',
        });
      },

      openSetupModal: () => set({ isSetupModalOpen: true }),
      closeSetupModal: () => set({ isSetupModalOpen: false }),
      openSettingsModal: () => set({ isSettingsModalOpen: true }),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      openAnalysisModal: () => set({ isAnalysisModalOpen: true }),
      closeAnalysisModal: () => set({ isAnalysisModalOpen: false }),
      openDisconnectConfirm: () => set({ isDisconnectConfirmOpen: true }),
      closeDisconnectConfirm: () => set({ isDisconnectConfirmOpen: false }),
      setIsFullscreenVisionOpen: (open) => set({ isFullscreenVisionOpen: open }),

      disconnectApiKey: () => {
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage?.removeItem(SESSION_KEY_STORAGE_KEY);
            window.localStorage?.removeItem(LOCAL_KEY_STORAGE_KEY);
          } catch {}
        }
        set({
          apiKey: '',
          apiKeyConfigured: false,
          apiStatus: 'NO_KEY',
          apiStatusMessage: 'Gemini AI Setup Required',
          isSettingsModalOpen: false,
          isDisconnectConfirmOpen: false,
          isAnalysisModalOpen: false,
        });
      },

      validateAndConnectKey: async (rawKey: string): Promise<{ success: boolean; message: string }> => {
        const key = rawKey.trim();
        if (!key) {
          set({
            apiStatus: 'NO_KEY',
            apiStatusMessage: 'Please enter your API key.',
          });
          return {
            success: false,
            message: 'Please enter your API key.',
          };
        }

        set({
          apiStatus: 'CONNECTING',
          apiStatusMessage: 'Connecting to Plant Talk AI...',
        });

        try {
          const { defaultAIProvider } = await import('../../services/ai/gemini-provider');
          const validation = await defaultAIProvider.validateKey(key);

          if (validation.valid) {
            get().setApiKey(key);
            set({
              apiStatus: 'AI_READY',
              apiStatusMessage: 'Gemini AI Ready',
              isSetupModalOpen: false,
            });
            return {
              success: true,
              message: validation.message || 'Gemini AI connected successfully.',
            };
          }

          const errorStatus: ApiKeyStatus =
            validation.errorType === 'RATE_LIMITED'
              ? 'RATE_LIMITED'
              : validation.errorType === 'NETWORK_ERROR'
              ? 'AI_OFFLINE'
              : 'INVALID_KEY';

          const userMessage =
            validation.message ||
            'The API key could not be validated. Please check the key and try again.';

          set({
            apiStatus: errorStatus,
            apiStatusMessage: userMessage,
          });

          return {
            success: false,
            message: userMessage,
          };
        } catch (err) {
          const msg = 'Unable to connect to the AI service. Check your internet connection and try again.';
          set({
            apiStatus: 'AI_OFFLINE',
            apiStatusMessage: msg,
          });
          return {
            success: false,
            message: msg,
          };
        }
      },
    }),
    {
      name: 'plant-settings',
      partialize: (state) => ({
        aiProvider: state.aiProvider,
        preferredLanguage: state.preferredLanguage,
        geminiVisionModel: state.geminiVisionModel,
        geminiLiveModel: state.geminiLiveModel,
      }),
    }
  )
);
