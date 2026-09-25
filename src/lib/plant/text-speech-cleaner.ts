/**
 * Text Cleaner for Voice & Speech Synthesis
 *
 * Ensures Gemini and SpeechSynthesis voices sound like natural, expressive
 * living speakers rather than reading out punctuation, symbols, emojis, or markdown.
 */

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove emojis (covers all major emoji Unicode blocks)
  cleaned = cleaned.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu,
    ''
  );

  // 2. Remove markdown asterisks, hashes, backticks, blockquotes, bullets
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1'); // bold/italic
  cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');   // underline/italic
  cleaned = cleaned.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');   // inline code
  cleaned = cleaned.replace(/^#+\s+/gm, '');                   // headings
  cleaned = cleaned.replace(/^>\s+/gm, '');                    // blockquotes
  cleaned = cleaned.replace(/^[-*+]\s+/gm, '');                // unordered lists
  cleaned = cleaned.replace(/^\d+\.\s+/gm, '');                // numbered lists

  // 3. Remove parenthetical technical notes, e.g. "(58%)", "(ஈரப்பதம்: 58%)", "(moisture: 58%)"
  cleaned = cleaned.replace(/\s*\([^)]*(?:%|moisture|humidity|temperature|ஈரப்பதம்|வெப்பநிலை)[^)]*\)/gi, '');
  // Remove generic parenthetical asides that sound like reading annotations
  cleaned = cleaned.replace(/\s*\([^)]{1,40}\)/g, '');

  // 4. Convert technical symbols to spoken phrasing or remove
  cleaned = cleaned.replace(/°C/g, ' degrees');
  cleaned = cleaned.replace(/%/g, ' percent');
  cleaned = cleaned.replace(/&/g, ' and ');
  cleaned = cleaned.replace(/@/g, ' at ');
  cleaned = cleaned.replace(/~/g, '');

  // 5. Clean up multiple punctuation, e.g. "!!", "???", "..", and stray dashes/slashes
  cleaned = cleaned.replace(/([!?.,])\1+/g, '$1');
  cleaned = cleaned.replace(/[\/\\]/g, ' ');
  cleaned = cleaned.replace(/\s*-\s*/g, ' - ');

  // 6. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
