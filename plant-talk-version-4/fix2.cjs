const fs = require('fs');

let voiceTransCode = fs.readFileSync('src/lib/plant/voice-translator.ts', 'utf-8');
voiceTransCode = voiceTransCode.replace(/type VoiceLanguage = 'en' \| 'ta';/, "type VoiceLanguage = 'en' | 'ta' | 'ta-LK';");
fs.writeFileSync('src/lib/plant/voice-translator.ts', voiceTransCode);

let cmdHandlerCode = fs.readFileSync('server/whatsapp/command-handler.ts', 'utf-8');
cmdHandlerCode = cmdHandlerCode.replace(/await handleLangSwitch\(config, from, 'ta'\);/g, "await handleLangSwitch(config, from, 'ta-LK');");
// Wait, is there any en === ta-LK? Let's fix line 191
cmdHandlerCode = cmdHandlerCode.replace(/lang === 'en' \? '(.*?)' : '(.*?)'/g, "lang === 'ta-LK' ? '$2' : '$1'");
fs.writeFileSync('server/whatsapp/command-handler.ts', cmdHandlerCode);

let formatterCode = fs.readFileSync('server/whatsapp/formatter.ts', 'utf-8');
formatterCode = formatterCode.replace(/lang === 'ta-LK' \? 'ta' : 'en'/g, "lang === 'ta-LK' ? 'ta-LK' : 'en'"); // wait
fs.writeFileSync('server/whatsapp/formatter.ts', formatterCode);

console.log('Fixed');
