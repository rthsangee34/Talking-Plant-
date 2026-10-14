const fs = require('fs');

const appendCode = `
// ─── CONVERSATIONAL HANDLER (TAMIL ONLY) ────────────────────────────────────

async function handleConversationalQuery(config: import('./types').WhatsAppConfig, to: string, query: string, state: import('../plant-state').PlantChatState, lang: import('./types').OwnerLanguage): Promise<void> {
  if (!isApiKeyConfigured()) {
    await sendTextMessage(config, to, getTamilTemplate('fallback_error'));
    return;
  }

  const ai = getGemini();
  const s = state.sensors;
  
  // Create token-efficient compact payload
  const conditions = [];
  if (s.soilMoisture !== null) {
    if (s.soilMoisture < 20) conditions.push('very_low_soil_moisture');
    else if (s.soilMoisture < 30) conditions.push('low_soil_moisture');
    else if (s.soilMoisture > 85) conditions.push('high_soil_moisture');
    else conditions.push('healthy_moisture');
  }
  
  if (s.temperature !== null) {
    if (s.temperature > 35) conditions.push('high_temperature');
    else if (s.temperature < 15) conditions.push('low_temperature');
  }
  
  if (s.humidity !== null) {
    if (s.humidity > 80) conditions.push('high_humidity');
    else if (s.humidity < 30) conditions.push('dry_air');
  }
  
  if (s.light !== null) {
    if (s.light > 80) conditions.push('excessive_light');
    else if (s.light < 20) conditions.push('low_light');
    else conditions.push('healthy_light');
  }

  if (state.observation?.pestsDetected) conditions.push('possible_pest');
  if (state.observation?.flowersDetected) conditions.push('flower_detected');

  const payload = {
    plant: state.plantName || state.species || 'Plant',
    language: lang,
    conditions,
    query,
    requestedStyle: 'warm, clear, lightly witty',
    maxSentences: 2
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      systemInstruction: { parts: [{ text: PLANT_WHATSAPP_TAMIL_SYSTEM_PROMPT }] },
      contents: { parts: [{ text: JSON.stringify(payload) }] },
      config: {
        temperature: 0.6,
        maxOutputTokens: 100,
        candidateCount: 1
      }
    });

    clearTimeout(timeout);

    const text = response.text?.trim();
    if (text && text.length > 5 && text.length < 500) {
      await sendTextMessage(config, to, text);
      return;
    }
    
    // Empty/invalid AI response fallback
    await sendTextMessage(config, to, getTamilTemplate('fallback_error'));
  } catch (err) {
    clearTimeout(timeout);
    logServerError('command-handler:tamil-ai', err);
    await sendTextMessage(config, to, getTamilTemplate('fallback_error'));
  }
}
`;

fs.appendFileSync('server/whatsapp/command-handler.ts', appendCode);
console.log('Appended');
