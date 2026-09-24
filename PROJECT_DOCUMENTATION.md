# PlantTalk v4.0 — Complete Technical & Architectural Specification Document 🌱

---

## 1. Executive Summary

**PlantTalk v4.0** is an enterprise-grade, multimodal botanical intelligence system that bridges physical hardware telemetry, advanced artificial intelligence, computer vision, and ubiquitous mobile messaging into an integrated companion ecosystem. 

Rather than acting as a sterile telemetry dashboard or generic diagnostic chatbot, PlantTalk embodies the **living plant's first-person persona**. The plant perceives its environment through physical ESP32 sensors and webcams, evaluates its biological state (including an environmental Photosynthesis Intelligence Engine), protects its physical boundaries using client-side edge machine learning, speaks natively in **English** and **Sri Lankan Tamil (தமிழ்)** via **Gemini Live 2-way Voice Streaming**, and autonomously alerts its human caregiver via the official **Meta WhatsApp Cloud API**.

---

## 2. Core Value Proposition & System Highlights

| Feature | Technical Implementation | Practical Benefit |
| :--- | :--- | :--- |
| **Multimodal Telemetry** | ESP32 DevKit microcontrollers + Web Serial API / WebSockets | Direct, real-time sensing of Soil Moisture, Light (LDR), Temp/Humidity (DHT11), and CO₂ (MQ-135). |
| **Gemini 3.6 Multimodal Vision** | Google Gemini Vision Models (`gemini-2.5-flash` / `gemini-3.6-flash`) | Automatic multi-plant detection, species identification, petal/bud inspection, pest detection, and structural damage tracking. |
| **Edge Touch Protection** | TensorFlow.js Hand Pose Detection (`@tensorflow-models/hand-pose-detection` with WebGL backend) | Detects human hands hovering over or touching the plant; escalates vocal warnings and triggers an emergency WhatsApp alert if harassment persists. |
| **Bidirectional Live Voice** | Gemini Live WebSocket Audio Streaming (`/api/live`) | Sub-second voice conversation with the plant at 16kHz PCM audio; plant responds naturally with a distinct botanical voice. |
| **Photosynthesis Engine** | Liebig’s Law of the Minimum deterministic physiological algorithm | Calculates real-time photosynthesis efficiency, identifies primary limiting factors, and explains plant food production. |
| **Proactive WhatsApp Alerts** | Meta Graph API v21.0 + WhatsApp Business Webhooks | Automated notifications for extreme drought, frost/heat stress, pest outbreaks, and unauthorized physical interference. |
| **Bilingual Support** | Natural Sri Lankan Tamil & English natural language engines | Native, authentic spoken Tamil and English across voice interactions, visual observations, and WhatsApp communications. |
| **Enterprise Security** | Server-side key isolation, HMAC-SHA256 signature verification, timing attack mitigation | Zero API key leakage to browser bundles; constant-time crypto comparison for webhooks; owner phone number whitelisting. |

---

## 3. High-Level Architecture

```
                                  ┌──────────────────────────────────────────────────────────┐
                                  │                  PHYSICAL ENVIRONMENT                    │
                                  └────────────┬─────────────────────────────┬───────────────┘
                                               │                             │
                                        Webcam Video Feed             Physical Sensors
                                               │                             │
                                               ▼                             ▼
                                   ┌──────────────────────┐      ┌──────────────────────┐
                                   │   Computer Webcam    │      │    ESP32 DevKit      │
                                   │  (720p / 1080p RGB)  │      │  Moisture/LDR/DHT/CO2│
                                   └───────────┬──────────┘      └───────────┬──────────┘
                                               │                             │
                                               │                      Serial / USB
                                               │                             │
┌──────────────────────────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────┐
│ CLIENT BROWSER (React 19 + Tailwind v4)      │                             ▼                                             │
│                                              ▼                   ┌───────────────────────┐                               │
│                                   ┌──────────────────────┐       │  Web Serial Manager   │                               │
│                                   │   Camera Pipeline    │       │   (esp32-serial.ts)   │                               │
│                                   └──────────┬───────────┘       └───────────┬───────────┘                               │
│                                              │                               │                                           │
│                       ┌──────────────────────┴──────────────────────┐        │                                           │
│                       ▼                                             ▼        ▼                                           │
│           ┌──────────────────────┐                    ┌───────────────────────────────┐                                  │
│           │   TensorFlow.js      │                    │     Zustand State Stores      │                                  │
│           │   Hand Pose Tracker  │                    │  (Sensors, Camera, Observer)  │                                  │
│           └──────────┬───────────┘                    └──────────────┬────────────────┘                                  │
│                      │                                               │                                                   │
│             Touch Escalation Engine                                  │                                                   │
│             (1-5 Touches Vocal Guard)                                │                                                   │
│                      │                                               │                                                   │
│                      ▼                                               ▼                                                   │
│        ┌───────────────────────────┐                   ┌───────────────────────────┐                                     │
│        │  Browser Speech Synthesis │                   │ Photosynthesis Engine     │                                     │
│        │      (Tamil Voice)        │                   │ (Liebig Factor Algorithm) │                                     │
│        └───────────────────────────┘                   └─────────────┬─────────────┘                                     │
│                                                                      │                                                   │
│      Bidirectional Audio (PCM 16kHz)                                 │ HTTP REST / NDJSON Telemetry                      │
│                                                                      │                                                   │
└──────────────────────┬───────────────────────────────────────────────┼───────────────────────────────────────────────────┘
                       │                                               │
                       ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BACKEND SERVER (Node.js + Express + TypeScript)                                                                          │
│                                                                                                                          │
│   ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐                    │
│   │   Gemini Live Proxy       │      │   Vision & Observation    │      │  Server Plant State       │                    │
│   │   (/api/live WebSockets)  │      │   (/api/analyze, /observe)│      │  (plant-state.ts)         │                    │
│   └─────────────┬─────────────┘      └─────────────┬─────────────┘      └─────────────┬─────────────┘                    │
│                 │                                  │                                  │                                  │
│                 │                                  │                                  ▼                                  │
│                 │                                  │                    ┌───────────────────────────┐                    │
│                 │                                  │                    │ WhatsApp Alert Engine     │                    │
│                 │                                  │                    │ (Thresholds & Cooldowns)  │                    │
│                 │                                  │                    └─────────────┬─────────────┘                    │
│                 │                                  │                                  │                                  │
└─────────────────┼──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┘
                  │                                  │                                  │
                  ▼                                  ▼                                  ▼
      ┌───────────────────────┐          ┌───────────────────────┐          ┌───────────────────────┐
      │   Google Gemini Live  │          │   Google Gemini 3.6   │          │   Meta WhatsApp       │
      │   WebSocket API       │          │   Flash Vision API    │          │   Cloud Graph API     │
      └───────────────────────┘          └───────────────────────┘          └───────────────────────┘
```

---

## 4. Hardware Telemetry & Sensor Integration

### 4.1 ESP32 Microcontroller Firmware (`PlantSensors.ino`)
The hardware firmware is written in C++ for the ESP32 DevKit. It queries physical sensors every 2 seconds, performs analog-to-digital conversions, normalizes values into standard units, and outputs a single-line, clean JSON payload over USB Serial (Baud Rate: `115200`).

```cpp
/* Pin Configuration */
#define MOISTURE_PIN 34  // Analog ADC1_CH6 (Capacitive/Resistive Soil Sensor)
#define LIGHT_PIN    35  // Analog ADC1_CH7 (Light Dependent Resistor - LDR)
#define DHT_PIN      23  // Digital GPIO23   (DHT11 Ambient Temperature & Humidity)
#define CO2_PIN      32  // Analog ADC1_CH4 (MQ-135 Air Quality / CO2 Gas Sensor)
```

#### Sensor Calibration & Mathematical Normalization:
1. **Soil Moisture**: ESP32 ADC reads 12-bit values (0–4095). High resistance indicates dry soil (approx. 4095), while submerged moisture reads low (approx. 1200). The firmware applies inverted mapping:
   $$\text{Moisture \%} = \text{constrain}\left(\text{map}(\text{raw}, 4095, 1200, 0, 100), 0, 100\right)$$
2. **Light Intensity**: Direct linear normalization from 0 (pitch dark) to 4095 (bright direct light):
   $$\text{Light \%} = \text{constrain}\left(\text{map}(\text{raw}, 0, 4095, 0, 100), 0, 100\right)$$
3. **CO₂ Concentration**: Estimated using empirical logarithmic curve mapping against baseline atmospheric concentrations:
   $$\text{CO}_2 \text{ (ppm)} = \text{constrain}\left(\text{map}(\text{raw}, 0, 4095, 350, 2000), 350, 2000\right)$$
4. **Serial Payload Format**:
   ```json
   {"moisture": 45, "light": 68, "temperature": 28.4, "humidity": 72, "co2": 620}
   ```

### 4.2 Web Serial API Client Driver (`esp32-serial.ts`)
The frontend communicates directly with the ESP32 using the browser's native **Web Serial API** (`navigator.serial`):
- Line-buffered chunk decoder using `TransformStream` and `TextDecoderStream`.
- Resilient auto-reconnection and stream closure handling.
- Real-time dispatching to Zustand `sensors-store.ts`.
- **Manual Simulation Fallback**: If physical hardware is unavailable, caregivers can toggle manual slider overrides for all five parameters.

---

## 5. Computer Vision & Visual Intelligence Layer

### 5.1 Multi-Plant Detection & Botanical Structured Analysis (`/api/analyze`)
Powered by `gemini-3.6-flash` (or `gemini-2.5-flash`), the vision pipeline accepts single captures or multi-frame bursts (up to 3 consecutive frames) to inspect plants.

#### Processing Pipeline:
1. **Multi-Frame Validation**: Base64 data URLs are validated for MIME type (`image/jpeg`, `image/png`, `image/webp`) and byte length.
2. **System Instruction**: Loaded from `PLANT_ANALYSIS_SYSTEM_PROMPT`.
3. **JSON Schema Enforcement**: Responses are validated via structured schema output (`responseMimeType: "application/json"`):
   - `totalPlantsDetected`: Number of distinct plants in the frame.
   - `sceneSummary`: Visual reasoning and environmental summary.
   - `plants[]`: Array of identified plants:
     - `role`: Designated as `'main'` (central/largest) or `'friend'` (neighboring plants).
     - `commonName` & `scientificName`: (e.g., *Crepe Jasmine*, *Tabernaemontana divaricata*).
     - `identificationConfidence`: Confidence grade.
     - `visibleCondition`: Physical condition description.
     - `leaves`: Overall condition and list of issues (yellowing, curling, wilting, tearing).
     - `flowers`: Status (`confirmed`, `likely`, `uncertain`, `not-visible`), count, and descriptions.
     - `buds`: Status and count estimates.
     - `pests`: Detection flag and detailed description of insect activity.
     - `damage`: Broken stems, cuts, leaf punctures, or crushed tissue.
     - `recommendation`: Contextual botanical advice.
     - `plantMessage`: Friendly first-person statement from that specific plant in Sri Lankan Tamil.
   - `conversation[]`: A multi-plant conversational exchange where each plant speaks in turn.
   - `imageQuality`: Sharpness, lighting, framing, and whether camera placement needs adjustment.

### 5.2 Live Streaming Observation (`/api/observe`)
- Emits real-time progress via **NDJSON** (`application/x-ndjson`):
  1. `{"type": "status", "message": "Capturing sensor telemetry..."}`
  2. `{"type": "status", "message": "Analyzing visual evidence..."}`
  3. `{"type": "final", "data": PlantObservation}`
- Correlates visual appearance with active ESP32 sensor telemetry.
- Updates the server-side singleton state (`plant-state.ts`) with latest readings and image buffers.

---

## 6. Physical Boundary Defense & Edge Hand Tracking

PlantTalk v4.0 implements an intelligent physical touch guard using client-side Edge Machine Learning:

### 6.1 Hand Pose Detection Engine (`camera-panel.tsx`)
- Utilizes `@tensorflow-models/hand-pose-detection` backed by `@tensorflow/tfjs-backend-webgl`.
- Continuously tracks hand landmarks at 30 FPS against the video canvas.
- Detects proximity, entry into the plant's bounding box, and duration of contact.

### 6.2 Progressive Vocal Escalation Hierarchy (Sri Lankan Tamil)
When a human repeatedly touches or crowds the plant without giving it space, the plant defends its physical boundaries through audible browser speech synthesis (`ta-IN`):

| Touch Event | Plant Reaction (Spoken Sri Lankan Tamil) | Behavioral Meaning |
| :---: | :--- | :--- |
| **Touch 1** | *"ஐயோ… என்னை மெதுவாக விடுங்கள் தயவுசெய்து. என் இலைகள் மிகவும் மென்மையானவை; முதலில் அனுமதி கேளுங்கள்!"* | Polite boundary setting; gentle reminder of leaf fragility. |
| **Touch 2** | *"நான் ஏற்கனவே சொன்னேனே! அனுமதி இல்லாமல் என்னைத் தொடுவது நல்ல பழக்கம் இல்லை. தயவுசெய்து கைகளை விலக்குங்கள்!"* | Firm reminder that consent is required before touching. |
| **Touch 3** | *"ஏய்! எத்தனை முறை சொல்வது? நான் அலங்காரப் பொருள் இல்லை! என்னைத் தொடாதீர்கள் என்று தெளிவாகச் சொன்னேனே!"* | Heightened irritation; declares itself a living organism, not decor. |
| **Touch 4** | *"போதும்! இது வேடிக்கை இல்லை! மீண்டும் என்னைத் தொட்டால் உரிமையாளரிடம் உடனே புகார் சொல்வேன்!"* | Final ultimatum; warns of escalating to the plant owner. |
| **Touch 5** | *"உரிமையாளருக்கு உடனே செய்தி அனுப்பிவிட்டேன்! யாரோ என்னை மீண்டும் மீண்டும் தொந்தரவு செய்கிறார்கள். காப்பாற்றுங்கள்!"* | **Triggers Emergency WhatsApp Alert** to owner's phone. |
| **Held >3s** | *"கையை விலக்குங்கள்! நான் உங்களிடம் மிகவும் தெளிவாகச் சொல்கிறேன்—என்னைத் தொந்தரவு செய்யாதீர்கள்!"* | Urgent warning against prolonged grasping. |
| **Held >6s** | *"இது சரியில்லை! என் இலைகளை நசுக்காதீர்கள். தயவுசெய்து உடனே கைகளை விலக்குங்கள்!"* | Severe distress; defense against leaf crushing. |

### 6.3 Automated Protection Alert Dispatch
On the 5th confirmed harassment event, the client triggers `POST /api/whatsapp/protection-alert`. 
- Incorporates a **15-minute strict cooldown** to prevent spamming.
- In production, sends an approved Meta WhatsApp template.
- In test/development mode, dispatches an immediate text alert with timestamp and location details in Tamil.

---

## 7. Gemini Live Bidirectional Voice Streaming

PlantTalk v4.0 features native voice streaming through **Gemini Live WebSockets**:

### 7.1 WebSocket Architecture (`server/realtime.ts`)
- The browser establishes a WebSocket connection with the local proxy at `/api/live`.
- The server initializes an authenticated session with Google's Gemini Live API (`GEMINI_LIVE_MODEL = 'gemini-2.0-flash-exp'`).
- The session configures:
  - **Modality**: `Modality.AUDIO`
  - **Speech Configuration**: `voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }` (warm female plant voice)
  - **System Instruction**: `PLANT_LIVE_SYSTEM_INSTRUCTION` (enforcing the botanical first-person persona and Plant-World Rule).
  - **Tools**: Dynamic function declarations for plant introspection.

### 7.2 The "Plant-World Rule"
The AI model is strictly prohibited from speaking like a computer or referencing technology:
- **Forbidden Vocabulary**: *camera, sensor, AI, Gemini, algorithm, software, database, API, ESP32, percentages, pixels, detection, confidence score*.
- **Translating Telemetry into Somatic Plant Experience**:
  - Low Moisture $\rightarrow$ *"My roots are parched; I feel so thirsty."*
  - Excess Moisture $\rightarrow$ *"The soil feels heavy and soaked; my roots cannot breathe."*
  - Low Light $\rightarrow$ *"I am reaching out and longing for gentle sunlight."*
  - Extreme Heat $\rightarrow$ *"My leaves feel tired and scorching hot."*
  - Cold Temperature $\rightarrow$ *"The air is chilly; my leaves are shivering."*
  - Insects/Pests $\rightarrow$ *"Something tiny is tickling and nibbling at my stems."*

### 7.3 Real-Time Live Function Tools (`PLANT_LIVE_TOOLS`)
When the user speaks to the plant, Gemini Live invokes server-executed client tools:
1. `get_sensor_readings`: Queries active moisture, light, temp, humidity, and CO₂.
2. `get_latest_observation`: Retrieves visual evidence from the latest camera capture.
3. `get_latest_plant_analysis`: Fetches botanical diagnosis, flower statuses, and bud counts.
4. `get_plant_history`: Returns multi-session observation trends.
5. `get_hardware_status`: Informs whether physical ESP32 or camera devices are connected.
6. `get_plant_profile`: Species preferences, ideal moisture, and light thresholds.
7. `get_photosynthesis_analysis`: Returns current photosynthetic rate and limiting factors.

---

## 8. Photosynthesis Intelligence Engine

Located in `src/lib/plantAnalysis/photosynthesisEngine.ts`, this engine models plant physiology based on **Liebig’s Law of the Minimum** (growth is dictated not by total resources, but by the scarcest resource):

$$\text{Photosynthetic Capacity} = \min(F_{\text{light}}, F_{\text{water}}, F_{\text{CO}_2}, F_{\text{temperature}}, F_{\text{leafHealth}})$$

### 8.1 Factor Evaluation Matrix

| Factor | Sensor Source | Optimal Range | Mathematical Evaluation |
| :--- | :--- | :--- | :--- |
| **Light Energy ($F_{\text{light}}$)** | LDR Analog | 30% – 75% | Evaluates light-dependent reactions; penalizes below 15% (darkness) and above 85% (photoinhibition/chlorophyll stress). |
| **Water Availability ($F_{\text{water}}$)** | Soil Moisture | 35% – 70% | Assesses xylem water transport; penalizes drought ($<20\%$) and waterlogging/hypoxia ($>85\%$). |
| **$\text{CO}_2$ Carbon Substrate ($F_{\text{CO}_2}$)** | MQ-135 Gas | 400 – 1200 ppm | Evaluates Calvin cycle substrate availability; standard baseline ambient: 420 ppm. |
| **Temperature Kinetics ($F_{\text{temperature}}$)** | DHT11 Digital | 20°C – 28°C | Models Rubisco enzyme kinetics; penalizes cold enzyme inactivity ($<12^\circ\text{C}$) and heat denaturation ($>36^\circ\text{C}$). |
| **Leaf Integrity ($F_{\text{leafHealth}}$)** | Gemini Vision | No damage/pests | Modulates total active photosynthetic leaf surface area based on visual leaf inspection. |

### 8.2 Limiting Factor & Confidence Score
- The engine calculates a weighted composite score and identifies the **primary limiting factor**.
- Computes an empirical **confidence score** based on sensor availability (1 sensor = Low, 2–3 sensors = Moderate, 4+ sensors + vision = High).
- Generates bilingual explanations in **Simple**, **Child**, or **Scientific** modes in both English and Tamil (`knowledge.ts`).

---

## 9. WhatsApp Cloud API & Proactive Alerting System

The backend features an enterprise-grade WhatsApp integration built on the official **Meta Graph API v21.0**.

### 9.1 Core Architectural Components (`server/whatsapp/`)

```
server/whatsapp/
├── alert-engine.ts        # Automated periodic evaluation against botanical thresholds
├── automated-alerts.ts    # Background loop polling sensor telemetry every 60s
├── alert-store.ts         # Cooldown tracking, rate limiting, and persistence
├── client.ts              # Resilient HTTP client with retry backoff & error parser
├── formatter.ts           # Bilingual message generation (EN/TA)
├── routes.ts              # Express router for admin actions & webhook callbacks
├── signature.ts           # HMAC-SHA256 verification with timingSafeEqual
├── tamil-templates.ts     # Pre-rendered natural Tamil message templates
└── types.ts               # Strict TypeScript definitions and configuration contracts
```

### 9.2 Cryptographic Webhook Security (`signature.ts`)
All incoming webhooks from Meta are cryptographically verified:
- Calculates the SHA-256 HMAC of the raw request buffer using `WHATSAPP_APP_SECRET`.
- Validates the `X-Hub-Signature-256` header.
- Compares hashes using `crypto.timingSafeEqual` to eliminate timing attack vectors.

### 9.3 Inbound Bot Commands
Authorized plant owners can text commands to their plant's WhatsApp number:

| Command | Response Content |
| :--- | :--- |
| `STATUS` | Comprehensive plant status: health score, condition, latest readings, and Sri Lankan timestamp. |
| `HEALTH` | Deep-dive botanical explanation of leaves, roots, and recommended care actions. |
| `SENSORS` | Live telemetry table: Moisture, Temperature, Humidity, Light, and CO₂ values. |
| `FLOWER` | Bloom status, open flower counts, budding progress, and flower health. |
| `PESTS` | Visual insect inspection summary and evidence logs. |
| `MUTE` / `UNMUTE` | Suppress or enable non-critical automated notifications. |
| `LANG EN` / `LANG TA` | Dynamically toggles owner's preferred language between English and Tamil. |

### 9.4 Automated Alerts & Botanical Thresholds

```typescript
const THRESHOLDS = {
  moistureCriticalLow: 15,    // Extreme drought risk
  moistureWarningLow: 25,     // Under-watering notice
  moistureCriticalHigh: 85,   // Root rot / overwatering risk
  temperatureLow: 12,         // Frost / chilling stress
  temperatureHigh: 36,        // Heat stress
  co2Low: 350,                // Stale air warning
  co2High: 1800,              // Stagnant air warning
};
```

- **Alert Cooldown System**: Alerts for identical conditions enforce an automatic 60-minute suppression cooldown to prevent message fatigue.
- **Owner Whitelisting**: Unauthorized phone numbers attempting to control the plant are rejected with a rate-limited courteous error message (max 5 requests/min).

---

## 10. Frontend Architecture & Design System

The client interface is built with **React 19**, **Tailwind CSS v4**, **Lucide Icons**, and **Zustand**.

### 10.1 UI Dashboard Layout (`plant-dashboard.tsx`)
Organized into a dual-column responsive grid:

1. **Left Column (Vision, Telemetry & Environment)**:
   - **`CameraPanel`**: WebRTC video stream, camera switcher, torch/zoom controls, multi-frame burst capture, hand tracking overlays, and touch escalation indicator.
   - **`PlantUploadPanel`**: File dropzone supporting manual image uploads for analysis.
   - **`SensorsPanel`**: Five interactive telemetry gauges (Moisture, Light, Temp, Humidity, CO₂) with ESP32 connection badge and manual slider overrides.
   - **`PhotosynthesisStatusCard`**: Photosynthesis capacity gauge, factor breakdown bars, limiting factor callout, and bilingual modal explanations.
   - **`WhatsAppStatusPanel`**: Real-time status of Meta Graph connection, mute toggle, test message triggers, and simulated touch alert dispatchers.

2. **Right Column (AI Intelligence, Voice & Diagnosis)**:
   - **`VoiceConversationPanel`**: Gemini Live voice streaming controls, live audio visualizer, conversation transcript bubbles (Tamil/English), and voice settings.
   - **`PlantAnalysisPanel`**: Deep botanical diagnosis card detailing species confidence, petal/bud detection, pest alerts, and structural wounds.
   - **`ObservationPanel`**: Real-time sensor-vision synthesis stream with historical observation cards.
   - **`HistoryPanel`**: Chronological trend chart of plant health conditions across sessions.
   - **`DebugPanel`**: Raw telemetry inspector, Gemini model diagnostic logs, and internal state debugger.

### 10.2 State Management (`src/stores/plant/`)
Built with modular Zustand stores:
- `sensors-store.ts`: Raw readings, connection states, and manual override flags.
- `camera-store.ts`: Video streams, device IDs, hand pose states, touch counts, and alert cooldowns.
- `conversation-store.ts`: Voice and text chat transcript items.
- `observer-store.ts`: Latest structured plant analysis, observation stream, and historical logs.
- `settings-store.ts`: User Gemini API key, preferred language, and voice configurations.
- `ui-mode-store.ts`: Layout modes and diagnostics visibility.

---

## 11. Backend API Specification

| Endpoint | Method | Payload / Headers | Description |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | — | System health, API key presence, model names, and server uptime. |
| `/api/analyze` | `POST` | `{ images: string[] }` or `{ imageUrl: string }` | Executes comprehensive multi-plant botanical vision analysis. |
| `/api/observe` | `POST` | `{ imageUrl, moisture, light, temp, ... }` | Streams observation synthesis via `application/x-ndjson`. |
| `/api/live-token` | `POST` | Header/Query: API Key | Returns WebSocket connection path (`/api/live`) and readiness state. |
| `/api/live` | `WS` | Binary PCM 16kHz audio frames | Gemini Live bidirectional voice streaming proxy. |
| `/api/whatsapp/status` | `GET` | — | Diagnostic status of WhatsApp Cloud API connection. |
| `/api/whatsapp/test-message` | `POST` | Header: `X-Admin-Secret` | Dispatches Meta `hello_world` template to verify connectivity. |
| `/api/whatsapp/test-alert` | `POST` | Header: `X-Admin-Secret` | Triggers immediate check of alert thresholds against current state. |
| `/api/whatsapp/protection-alert`| `POST`| — | Dispatches physical boundary violation alert to plant owner. |
| `/api/whatsapp/mute` | `POST` | Header: `X-Admin-Secret` | Mutes non-critical automated notifications. |
| `/api/whatsapp/unmute` | `POST` | Header: `X-Admin-Secret` | Resumes automated threshold notifications. |

---

## 12. Security, Privacy & Reliability Matrix

1. **Server-Side API Key Isolation**:
   - `GEMINI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_APP_SECRET` reside solely in backend Node.js memory.
   - Vite client bundles contain zero private credentials.
2. **Cryptographic Protection Against Timing Attacks**:
   - Webhook validation uses `crypto.timingSafeEqual` to resist side-channel timing analysis.
3. **Resilient Rate Limiting & Cooldowns**:
   - Unauthorized phone numbers are strictly rate-limited (5 attempts/min).
   - Automated plant alerts enforce a 60-minute cooldown per issue type.
   - Hand harassment alerts enforce a 15-minute cooldown.
4. **Exponential Backoff & Network Recovery**:
   - Meta Graph API client includes automated exponential backoff retries (`[1000ms, 2000ms, 4000ms]`) on `429` (rate limit) or `5xx` responses.
   - Gemini API calls include timeout guards (30s) and fallback recovery.

---

## 13. File & Directory Taxonomy

```
plant-talk-version-4/
├── arduino/
│   └── PlantSensors/
│       └── PlantSensors.ino           # ESP32 C++ firmware (ADC mapping & JSON serial streaming)
├── server/
│   ├── index.ts                       # Express HTTP & WebSocket server entry point
│   ├── env.ts                         # Validated environment configuration builder
│   ├── gemini.ts                      # Gemini SDK initialization & model configuration
│   ├── plant-state.ts                 # Shared server-side plant telemetry singleton
│   ├── analyze.ts                     # Multi-plant botanical vision analysis handler
│   ├── observe.ts                     # Streaming NDJSON observation handler
│   ├── realtime.ts                    # Gemini Live bidirectional WebSocket proxy
│   └── whatsapp/                      # WhatsApp Cloud API & alerting subsystem
│       ├── alert-engine.ts            # Botanical threshold evaluator
│       ├── alert-store.ts             # Cooldowns, mute state & message history
│       ├── automated-alerts.ts        # Periodic telemetry monitoring loop
│       ├── client.ts                  # Meta Graph API HTTP client
│       ├── command-handler.ts         # Inbound text command execution engine
│       ├── formatter.ts               # Bilingual message template renderer
│       ├── routes.ts                  # WhatsApp Express router
│       ├── signature.ts               # HMAC-SHA256 signature verification
│       ├── tamil-templates.ts         # Natural Sri Lankan Tamil message templates
│       └── types.ts                   # WhatsApp type interfaces
├── src/
│   ├── App.tsx                        # Root React layout & global navigation header
│   ├── main.tsx                       # React DOM root mounting
│   ├── index.css                      # Tailwind CSS v4 styling & animations
│   ├── types.ts                       # Frontend shared data models
│   ├── components/
│   │   └── dashboard/
│   │       ├── camera-panel.tsx       # WebRTC video, hand tracking & touch escalation
│   │       ├── debug-panel.tsx        # Telemetry & system diagnostics
│   │       ├── history-panel.tsx      # Observation chronological trends
│   │       ├── observation-panel.tsx  # Vision + telemetry synthesis stream
│   │       ├── photosynthesis-status-card.tsx # Photosynthesis capacity & limiting factor UI
│   │       ├── plant-analysis-panel.tsx # Structured botanical diagnostic card
│   │       ├── plant-dashboard.tsx    # Responsive dashboard container
│   │       ├── plant-upload-panel.tsx # Image file drag-and-drop uploader
│   │       ├── sensors-panel.tsx      # Real-time hardware telemetry gauges
│   │       ├── voice-conversation-panel.tsx # Gemini Live voice chat UI & visualizer
│   │       └── whatsapp-status-panel.tsx # WhatsApp integration control panel
│   ├── lib/
│   │   ├── api/                       # API client helpers and logging utilities
│   │   ├── plant/
│   │   │   ├── camera-capture.ts      # Multi-frame image capture and validation
│   │   │   ├── camera-manager.ts      # WebRTC camera enumeration and streams
│   │   │   ├── esp32-serial.ts        # Web Serial API driver for ESP32
│   │   │   ├── personality.ts         # Plant voice tones and persona models
│   │   │   ├── prompts.ts             # System instructions (Analysis, Observer, Live)
│   │   │   ├── realtime-config.ts     # Gemini Live tools and function declarations
│   │   │   ├── realtime-connection.ts # Client WebSocket connection controller
│   │   │   ├── realtime-tools.ts      # Client tool execution logic
│   │   │   ├── schemas.ts             # Zod validation schemas
│   │   │   ├── vision-tracker.ts      # Hand pose tracking bridge
│   │   │   └── voice-translator.ts    # Bilingual speech sanitizer and translator
│   │   └── plantAnalysis/
│   │       ├── knowledge.ts           # Botanical formulas, vocabularies & Tamil dialogs
│   │       ├── photosynthesisEngine.ts # Liebig factor modeling algorithm
│   │       └── types.ts               # Photosynthesis engine type definitions
│   └── stores/
│       └── plant/                     # Zustand state management stores
├── package.json                       # Dependencies, scripts, and build tasks
├── tsconfig.json                      # TypeScript strict compiler configuration
└── vite.config.ts                     # Vite build and plugin setup
```

---

## 14. Installation, Configuration & Run Guide

### 14.1 Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: npm or bun
- **Hardware (Optional)**: ESP32 DevKit with Soil Moisture, LDR, DHT11, and MQ-135 sensors
- **Google AI Studio**: Gemini API key
- **Meta Developers (Optional)**: WhatsApp Cloud API app credentials

### 14.2 Environment Configuration (`.env.local`)
Create `.env.local` in the project root:

```env
# Gemini AI Configuration (Required)
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# Meta WhatsApp Cloud API (Optional - required for WhatsApp features)
WHATSAPP_ACCESS_TOKEN="EAAxxxxxxx"
WHATSAPP_PHONE_NUMBER_ID="1006xxxxxxx"
WHATSAPP_VERIFY_TOKEN="your_custom_webhook_secret"
WHATSAPP_APP_SECRET="your_meta_app_secret"
WHATSAPP_OWNER_NUMBER="9477XXXXXXX"   # International format without '+' or '00'
WHATSAPP_ADMIN_SECRET="your_internal_admin_secret"
```

### 14.3 Execution Commands

```bash
# Install dependencies
npm install

# Start full-stack development server (Express backend + Vite HMR on http://localhost:3000)
npm run dev

# Run test suite (Vitest)
npm run test

# Type check TypeScript
npm run lint

# Production build (Vite bundle + Esbuild server bundle)
npm run build

# Start production server
npm start
```

---
*PlantTalk v4.0 — Bridging Botany, Embedded Systems, Computer Vision, and Artificial Intelligence.*
