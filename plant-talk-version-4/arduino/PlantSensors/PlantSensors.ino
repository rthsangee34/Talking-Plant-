/*
 * PlantTalk ESP32 Hardware Telemetry Firmware
 *
 * Connects sensors to ESP32 DevKit and streams JSON telemetry over Serial:
 * - Soil Moisture Sensor (Analog)
 * - LDR Light Sensor (Analog)
 * - DHT11 Temperature & Humidity Sensor (Digital)
 * - CO2 Sensor / MQ-135 (Analog)
 *
 * Output format:
 * {"moisture": 45, "light": 68, "temperature": 28.4, "humidity": 72, "co2": 620}
 */

#include <DHT.h>

// User Configurable Pin Assignments
#define MOISTURE_PIN 34  // ADC1_CH6
#define LIGHT_PIN 35     // ADC1_CH7
#define DHT_PIN 23       // Digital GPIO23
#define CO2_PIN 32       // ADC1_CH4

#define DHTTYPE DHT11

DHT dht(DHT_PIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  pinMode(MOISTURE_PIN, INPUT);
  pinMode(LIGHT_PIN, INPUT);
  pinMode(CO2_PIN, INPUT);
  dht.begin();
}

void loop() {
  // Read raw analog values
  int rawMoisture = analogRead(MOISTURE_PIN);
  int rawLight = analogRead(LIGHT_PIN);
  int rawCO2 = analogRead(CO2_PIN);

  // Read DHT11 sensor
  float tempC = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Normalize moisture (ESP32 ADC is 0-4095; inverted dry/wet scaling)
  int moisturePct = map(rawMoisture, 4095, 1200, 0, 100);
  moisturePct = constrain(moisturePct, 0, 100);

  // Normalize light
  int lightPct = map(rawLight, 0, 4095, 0, 100);
  lightPct = constrain(lightPct, 0, 100);

  // Estimate CO2 in ppm
  int co2Ppm = map(rawCO2, 0, 4095, 350, 2000);
  co2Ppm = constrain(co2Ppm, 350, 2000);

  // Format JSON payload safely (never outputs NaN)
  Serial.print("{\"moisture\":");
  Serial.print(moisturePct);
  Serial.print(",\"light\":");
  Serial.print(lightPct);
  Serial.print(",\"temperature\":");
  if (isnan(tempC)) {
    Serial.print("null");
  } else {
    Serial.print(tempC, 1);
  }
  Serial.print(",\"humidity\":");
  if (isnan(humidity)) {
    Serial.print("null");
  } else {
    Serial.print(humidity, 1);
  }
  Serial.print(",\"co2\":");
  Serial.print(co2Ppm);
  Serial.println("}");

  delay(2000);
}
