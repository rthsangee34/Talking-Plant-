/**
 * Firebase Cloud Functions v2 Entry Point for TalkingPlant.
 * Securely binds GEMINI_API_KEY through Firebase Secret Manager.
 */
export {
  geminiApiKey,
  api,
  analyzePlant,
  chatPlant,
  observePlant,
  protectionAlert,
  plantVariation,
  healthExplanation,
} from '../../server/functions';
