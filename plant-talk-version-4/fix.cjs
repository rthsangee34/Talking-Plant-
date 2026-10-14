const fs = require('fs');
['server/whatsapp/command-handler.ts', 'server/whatsapp/formatter.ts'].forEach(file => {
  let code = fs.readFileSync(file, 'utf-8');
  code = code.replace(/lang === 'ta'/g, "lang === 'ta-LK'");
  code = code.replace(/lang === 'ta-LK' \|\| lang === 'ta-LK'/g, "lang === 'ta-LK'"); // Fix duplicate created by multi_replace_file_content earlier
  fs.writeFileSync(file, code);
});
