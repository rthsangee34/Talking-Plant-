const http = require('http');

const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    id: "890819387425300",
    changes: [{
      value: {
        messaging_product: "whatsapp",
        metadata: {
          display_phone_number: "123456789",
          phone_number_id: "1193750973826258"
        },
        contacts: [{
          profile: { name: "Test User" },
          wa_id: "94713251160"
        }],
        messages: [{
          from: "94713251160",
          id: "wamid.test.123",
          timestamp: "1710000000",
          text: {
            body: process.argv[2] || "STATUS"
          },
          type: "text"
        }]
      },
      field: "messages"
    }]
  }]
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/whatsapp/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, res => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', console.error);
req.write(payload);
req.end();
