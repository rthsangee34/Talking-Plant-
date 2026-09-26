import { create } from 'zustand';
import { LiveSessionStatus, ToolCallLog } from '../../types';

export interface UnifiedChatMessage {
  id: string;
  sender: 'user' | 'plant' | 'system';
  text: string;
  timestamp: string;
  isVoice?: boolean;
  language?: 'en' | 'ta' | 'mixed';
  toolCalls?: ToolCallLog[];
}

interface ConversationState {
  messages: UnifiedChatMessage[];
  liveStatus: LiveSessionStatus;
  isMuted: boolean;
  isVoiceMode: boolean;
  isListening: boolean;
  isTyping: boolean;
  activeError: string | null;

  addMessage: (msg: UnifiedChatMessage) => void;
  setLiveStatus: (status: LiveSessionStatus, errorMsg?: string) => void;
  setIsMuted: (muted: boolean) => void;
  setIsVoiceMode: (enabled: boolean) => void;
  toggleVoiceMode: () => void;
  setIsListening: (listening: boolean) => void;
  setIsTyping: (typing: boolean) => void;
  clearMessages: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  messages: [
    {
      id: 'welcome-1',
      sender: 'user',
      text: 'How is my plant today?',
      timestamp: '10:24 AM',
    },
    {
      id: 'welcome-2',
      sender: 'plant',
      text: 'Your plant looks healthy and fresh! 🌱\nSoil moisture is good (58%), light is sufficient (65%) and the temperature is perfect (26°C).\nKeep up the good care!',
      timestamp: '10:24 AM',
    },
    {
      id: 'welcome-3',
      sender: 'user',
      text: 'Do I need to water it now?',
      timestamp: '10:25 AM',
    },
    {
      id: 'welcome-4',
      sender: 'plant',
      text: 'No need to water now. The soil moisture is currently 58%, which is in the healthy range.\nYou can water it when it drops below 40%.',
      timestamp: '10:25 AM',
    },
    {
      id: 'welcome-5',
      sender: 'user',
      text: 'What about sunlight?',
      timestamp: '10:26 AM',
    },
    {
      id: 'welcome-6',
      sender: 'plant',
      text: "It's getting good light (65%). Keep it in a bright indirect light area. Avoid harsh direct sunlight.",
      timestamp: '10:26 AM',
    },
  ],
  liveStatus: 'disconnected',
  isMuted: false,
  isVoiceMode: false,
  isListening: false,
  isTyping: false,
  activeError: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setLiveStatus: (status, errorMsg) =>
    set({
      liveStatus: status,
      activeError: errorMsg || null,
      isVoiceMode: status !== 'disconnected' && status !== 'error',
      isListening: status === 'listening',
    }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsVoiceMode: (enabled) => set({ isVoiceMode: enabled }),
  toggleVoiceMode: () => set((state) => ({ isVoiceMode: !state.isVoiceMode })),
  setIsListening: (listening) => set({ isListening: listening }),
  setIsTyping: (typing) => set({ isTyping: typing }),
  clearMessages: () => set({ messages: [] }),
}));
