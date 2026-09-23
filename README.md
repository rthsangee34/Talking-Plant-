# PlantChat v4.0 🌱

> Multimodal Botanical Telemetry, Gemini AI Conversational Assistant, and WhatsApp Cloud API Proactive Alerting System.

PlantChat v4.0 integrates real-time ESP32 plant sensor telemetry, webcam image analysis via Google Gemini Vision, Gemini Live audio WebSocket streaming, and proactive WhatsApp Cloud API messaging into a single production-ready node application.

---

## 🌟 Key Features

- **Multimodal Sensor & Vision Telemetry**: Real-time monitoring of soil moisture, ambient temperature, humidity, light levels, and CO₂ with physical ESP32 sensor integration and visual plant analysis.
- **Proactive WhatsApp Cloud API Alerts**: Automated, threshold-driven notifications sent directly to the plant owner's WhatsApp number for critical environmental conditions (dry soil, heat/frost risk, pest detection).
- **Interactive WhatsApp Bot Commands**: Control and query your plant system via WhatsApp:
  - `STATUS` — Full plant status report
  - `HEALTH` — AI botanical health explanation (multilingual)
  - `SENSORS` — ESP32 hardware and sensor readings
  - `FLOWER` — Flower detection and bloom state
  - `PESTS` — Pest inspection and visual evidence summary
  - `MUTE` / `UNMUTE` — Control alert notifications
  - `LANG EN` / `LANG TA` — Switch between English and Sri Lankan Tamil
- **Gemini 3.6 & Live Voice API**: Real-time voice interaction with your plant using Gemini Live WebSockets (`/api/live`).
- **Bilingual Interface**: Native support for English and Sri Lankan Tamil across AI responses and WhatsApp messaging.
- **Enterprise Security**: Server-side API key isolation, Meta X-Hub-Signature-256 HMAC webhook verification, constant-time comparison timing attack protection, and owner-only command authorization.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ & npm
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
- Meta WhatsApp Business App credentials (optional for WhatsApp functionality)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Configuration (`.env.local`)

```env
# Required
GEMINI_API_KEY="your-gemini-api-key"

# WhatsApp Cloud API (Optional — Required to enable WhatsApp alerts)
WHATSAPP_ACCESS_TOKEN="your-meta-access-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_VERIFY_TOKEN="your-custom-webhook-verify-token"
WHATSAPP_APP_SECRET="your-meta-app-secret"
WHATSAPP_OWNER_NUMBER="9477XXXXXXX" # Owner phone number in international format
```

### Development Server

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

```bash
# Type check & linting
npm run lint

# Unit & Integration Tests (Vitest)
npm run test

# Production Build
npm run build
```

---

## 🏗 Architecture

```
PlantChat v4.0
├── server/
│   ├── index.ts                # Express entry point & WhatsApp route mounting
│   ├── env.ts                  # Safe environment variable parsing & config builder
│   ├── plant-state.ts          # Server-side shared plant state singleton
│   ├── observe.ts              # Gemini vision observation handler
│   ├── analyze.ts              # Structured plant analysis handler
│   ├── realtime.ts             # Gemini Live WebSocket proxy server
│   └── whatsapp/               # WhatsApp Cloud API Module
│       ├── client.ts           # Meta Graph API HTTP client (resilient fetch + backoff)
│       ├── signature.ts        # HMAC-SHA256 signature verification & timing safety
│       ├── message-parser.ts   # Defensive webhook payload parser & phone normalizer
│       ├── formatter.ts        # Bilingual message templates (EN/TA)
│       ├── alert-store.ts      # Cooldown, rate limits, and JSON persistence
│       ├── alert-engine.ts     # Deterministic plant problem detection engine
│       ├── command-handler.ts  # Inbound command execution engine
│       ├── webhook.ts          # Express handlers for GET (verification) & POST (events)
│       └── routes.ts           # Express router factory & status endpoints
└── src/                        # React Frontend
    └── components/dashboard/
        └── whatsapp-status-panel.tsx  # Real-time WhatsApp connection health panel
```

---

## 🔒 Security & Privacy

- `GEMINI_API_KEY` and Meta credentials never leak to the client bundle.
- Incoming WhatsApp webhooks validate `X-Hub-Signature-256` headers using `crypto.timingSafeEqual`.
- Direct inbound commands are restricted strictly to `WHATSAPP_OWNER_NUMBER`.
- Unauthorized numbers receive a polite error rate-limited to 5 requests per minute.
