
/*
 * PlantTalk 24/7 Autonomous ESP32 Wi-Fi Telemetry Firmware
 *
 * Continuously monitors physical sensors and sends JSON telemetry over Wi-Fi
 * directly to the Plant Talk backend server (port 3000):
 * - Soil Moisture Sensor (Analog / Capacitive)
 * - LDR Light Sensor (Analog)
 * - DHT11 / DHT22 or SHT31 Temperature & Humidity Sensor
 * - MQ-135 CO2 Sensor (Analog)
 *
 * Data Contract (JSON payload):
 * {
 *   "deviceId": "plant-talk-01",
 *   "soilMoisture": 45,
 *   "light": 68,
 *   "temperature": 28.4,
 *   "humidity": 72,
 *   "co2": 620
 * }
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ─── Network Configuration ──────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server endpoint: Update with your server's local LAN IP address
// e.g. "http://192.168.1.100:3000/api/sensors/telemetry"
const char* SERVER_URL    = "http://192.168.1.100:3000/api/sensors/telemetry";
const char* DEVICE_ID     = "plant-talk-01";

// Sampling interval: 5 seconds
const unsigned long SAMPLING_INTERVAL_MS = 5000;
unsigned long lastSampleTime = 0;

// ─── Pin Assignments ────────────────────────────────────────────────────────
#define PIN_MOISTURE 34  // Analog ADC1_CH6
#define PIN_LIGHT    35  // Analog ADC1_CH7
#define PIN_CO2      32  // Analog ADC1_CH4
#define PIN_DHT      23  // Digital GPIO23

#define DHTTYPE DHT11
DHT dht(PIN_DHT, DHTTYPE);

// ─── Calibration Constants ──────────────────────────────────────────────────
// Adjust these values to match your specific physical sensor calibration:
const int SOIL_DRY_RAW = 4095;  // ADC reading in completely dry air
const int SOIL_WET_RAW = 1200;  // ADC reading submerged in water

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n🌱 [PlantTalk] Starting 24/7 ESP32 Autonomous Monitoring...");

  pinMode(PIN_MOISTURE, INPUT);
  pinMode(PIN_LIGHT, INPUT);
  pinMode(PIN_CO2, INPUT);

  dht.begin();

  // Connect to Wi-Fi
  connectWiFi();
}

void connectWiFi() {
  Serial.print("📡 Connecting to Wi-Fi '");
  Serial.print(WIFI_SSID);
  Serial.print("'");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n🟢 Wi-Fi Connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Wi-Fi connection timed out. Will retry during loop.");
  }
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = currentMillis;

    // Check Wi-Fi connection
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ Wi-Fi disconnected! Reconnecting...");
      WiFi.reconnect();
      return;
    }

    // 1. Read Raw Sensors
    int rawMoisture = analogRead(PIN_MOISTURE);
    int rawLight    = analogRead(PIN_LIGHT);
    int rawCO2      = analogRead(PIN_CO2);

    float tempC    = dht.readTemperature();
    float humidity = dht.readHumidity();

    // 2. Calibrate & Normalize (0 - 100%)
    int moisturePct = map(rawMoisture, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100);
    moisturePct = constrain(moisturePct, 0, 100);

    int lightPct = map(rawLight, 0, 4095, 0, 100);
    lightPct = constrain(lightPct, 0, 100);

    int co2Ppm = map(rawCO2, 0, 4095, 350, 2000);
    co2Ppm = constrain(co2Ppm, 350, 2000);

    // 3. Construct JSON Payload
    String jsonPayload = "{";
    jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    jsonPayload += "\"soilMoisture\":" + String(moisturePct) + ",";
    jsonPayload += "\"light\":" + String(lightPct) + ",";

    if (isnan(tempC)) {
      jsonPayload += "\"temperature\":null,";
    } else {
      jsonPayload += "\"temperature\":" + String(tempC, 1) + ",";
    }

    if (isnan(humidity)) {
      jsonPayload += "\"humidity\":null,";
    } else {
      jsonPayload += "\"humidity\":" + String(humidity, 1) + ",";
    }

    jsonPayload += "\"co2\":" + String(co2Ppm);
    jsonPayload += "}";

    // 4. Send HTTP POST to PlantTalk Backend
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.print("🟢 [POST OK] ");
      Serial.print(httpResponseCode);
      Serial.print(" | Sent: ");
      Serial.println(jsonPayload);
    } else {
      Serial.print("❌ [POST Error] ");
      Serial.print(httpResponseCode);
      Serial.print(" | ");
      Serial.println(http.errorToString(httpResponseCode));
    }

    http.end();
  }
}
