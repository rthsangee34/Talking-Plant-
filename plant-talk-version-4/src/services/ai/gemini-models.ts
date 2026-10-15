/**
 * Shared Gemini model selection.
 *
 * IMPORTANT: Google's ListModels endpoint still LISTS some retired models
 * (e.g. gemini-2.5-flash, gemini-2.5-flash-lite) but `generateContent` returns
 * 404 "no longer available to new users" for them. Models such as
 * gemini-2.0-flash / gemini-1.5-* are fully retired. Never pick a model just
 * because it is listed — always confirm with a real generateContent call.
 */

/** Text/multimodal chat models, best first. `*-latest` aliases auto-track the newest stable release. */
export const PREFERRED_GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-pro-latest',
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

/** Models that are listed for generateContent but are not suitable for text chat. */
const NON_CHAT_MODEL_PATTERN =
  /(tts|image|live|native-audio|transcribe|translate|lyria|robotics|computer-use|deep-research|antigravity|nano-banana|embedding|aqa|gemma)/i;

export function isChatCapableModel(model: string): boolean {
  return model.startsWith('gemini-') && !NON_CHAT_MODEL_PATTERN.test(model);
}

/** Order discovered models so preferred ones are tried first, then any other chat-capable model. */
export function rankModels(discovered: string[], preferred?: string): string[] {
  const chat = discovered.filter(isChatCapableModel);
  const ordered: string[] = [];
  const push = (m: string) => {
    if (m && chat.includes(m) && !ordered.includes(m)) ordered.push(m);
  };
  if (preferred) push(preferred);
  PREFERRED_GEMINI_MODELS.forEach(push);
  chat.forEach(push);
  return ordered;
}

const ACTIVE_MODEL_STORAGE_KEY = 'planttalk_gemini_version';

/** Model confirmed working during setup (persisted by setFirebaseVariables / HomePage). */
export function getActiveGeminiModel(): string {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage?.getItem(ACTIVE_MODEL_STORAGE_KEY) : null;
    if (stored && isChatCapableModel(stored)) return stored;
  } catch {
    // storage unavailable
  }
  return DEFAULT_GEMINI_MODEL;
}

export function setActiveGeminiModel(model: string): void {
  try {
    window.localStorage?.setItem(ACTIVE_MODEL_STORAGE_KEY, model);
  } catch {
    // storage unavailable
  }
}
