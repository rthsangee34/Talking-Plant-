/**
 * Interactive Mock Sensor & Real-Time Simulation Engine
 *
 * Allows full verification of real-time 24/7 monitoring, anomaly detection,
 * deterministic health scoring, and alert cooldowns without physical hardware.
 * Clearly flags all data as `isMock: true` to prevent confusing mock and real data.
 */

import { sensorService } from './sensorService';
import { useMonitoringStore } from '../stores/plant/monitoring-store';
import type { PlantTelemetryPayload } from '../types/plantMonitoring';

export type MockScenario = 'normal' | 'dry_soil' | 'heatwave' | 'sudden_drop' | 'watering' | 'demo_flow';

interface ScenarioPreset {
  id: MockScenario;
  label: string;
  description: string;
  data: PlantTelemetryPayload;
}

export const MOCK_SCENARIOS: ScenarioPreset[] = [
  {
    id: 'normal',
    label: 'Normal / Healthy',
    description: 'Optimal moisture, mild temperature, balanced humidity.',
    data: {
      soilMoisture: 56,
      temperature: 24.5,
      humidity: 62,
      light: 68,
      co2: 560,
    },
  },
  {
    id: 'dry_soil',
    label: 'Dry Soil (Critical)',
    description: 'Soil drops to 14%, triggering critical dryness alert.',
    data: {
      soilMoisture: 14,
      temperature: 27.2,
      humidity: 38,
      light: 75,
      co2: 610,
    },
  },
  {
    id: 'heatwave',
    label: 'Heatwave Stress',
    description: 'High temperature (38.4°C) with low humidity.',
    data: {
      soilMoisture: 32,
      temperature: 38.4,
      humidity: 22,
      light: 92,
      co2: 650,
    },
  },
  {
    id: 'sudden_drop',
    label: 'Sudden Anomaly',
    description: 'Simulates rapid moisture drop from 60% to 16%.',
    data: {
      soilMoisture: 16,
      temperature: 25.1,
      humidity: 55,
      light: 65,
      co2: 580,
    },
  },
  {
    id: 'watering',
    label: 'Watering Recovery',
    description: 'Soil moisture restored to 68% after watering.',
    data: {
      soilMoisture: 68,
      temperature: 23.8,
      humidity: 66,
      light: 62,
      co2: 540,
    },
  },
];

class MockSensorService {
  private activeInterval: NodeJS.Timeout | null = null;
  private currentValues: PlantTelemetryPayload = { ...MOCK_SCENARIOS[0].data };
  private isDemoRunning = false;

  public startMockStream(intervalMs = 5000): void {
    if (this.activeInterval) return;

    useMonitoringStore.getState().setMockMode(true);

    this.activeInterval = setInterval(() => {
      if (this.isDemoRunning) return;

      // Add slight organic noise to readings (±0.5% moisture, ±0.2°C temp)
      const noise = (Math.random() - 0.5) * 1.0;
      const noiseTemp = (Math.random() - 0.5) * 0.4;

      const payload: PlantTelemetryPayload = {
        soilMoisture: Math.max(5, Math.min(95, Math.round((this.currentValues.soilMoisture ?? 50) + noise))),
        temperature: this.currentValues.temperature !== null ? Math.round(((this.currentValues.temperature ?? 24) + noiseTemp) * 10) / 10 : 24.5,
        humidity: this.currentValues.humidity,
        light: this.currentValues.light,
        co2: this.currentValues.co2,
        deviceId: 'mock-esp32-sim',
        timestamp: new Date().toISOString(),
        isMock: true,
      };

      sensorService.sendTelemetry(payload);
    }, intervalMs);
  }

  public stopMockStream(): void {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    useMonitoringStore.getState().setMockMode(false);
    useMonitoringStore.getState().setActiveMockScenario(null);
    this.isDemoRunning = false;
  }

  public setScenario(scenarioId: MockScenario): void {
    useMonitoringStore.getState().setMockMode(true);
    useMonitoringStore.getState().setActiveMockScenario(scenarioId);

    if (scenarioId === 'demo_flow') {
      this.runAutomatedDemo();
      return;
    }

    const preset = MOCK_SCENARIOS.find((s) => s.id === scenarioId);
    if (!preset) return;

    this.currentValues = { ...preset.data };

    // Send immediate packet
    const payload: PlantTelemetryPayload = {
      ...this.currentValues,
      deviceId: 'mock-esp32-sim',
      timestamp: new Date().toISOString(),
      isMock: true,
    };

    sensorService.sendTelemetry(payload);

    // If stream not running, start it
    if (!this.activeInterval) {
      this.startMockStream();
    }
  }

  /**
   * Runs an automated 5-step live demonstration:
   * Normal -> Soil drying -> Critical alert -> Watering event -> Healthy recovery
   */
  public async runAutomatedDemo(): Promise<void> {
    if (this.isDemoRunning) return;
    this.isDemoRunning = true;
    useMonitoringStore.getState().setActiveMockScenario('demo_flow');

    console.log('[MOCK-SIM] 🎬 Starting automated demonstration flow...');

    // Step 1: Normal
    await sensorService.sendTelemetry({
      soilMoisture: 58,
      temperature: 24.2,
      humidity: 65,
      light: 70,
      co2: 550,
      deviceId: 'mock-esp32-demo',
      isMock: true,
    });
    await this.delay(4000);

    // Step 2: Soil drying down to 34% (Attention)
    await sensorService.sendTelemetry({
      soilMoisture: 34,
      temperature: 26.5,
      humidity: 50,
      light: 72,
      co2: 580,
      deviceId: 'mock-esp32-demo',
      isMock: true,
    });
    await this.delay(4000);

    // Step 3: Critical Dryness (14% - triggers critical alert)
    await sensorService.sendTelemetry({
      soilMoisture: 14,
      temperature: 28.1,
      humidity: 36,
      light: 75,
      co2: 610,
      deviceId: 'mock-esp32-demo',
      isMock: true,
    });
    await this.delay(5000);

    // Step 4: User waters plant
    await sensorService.recordTimelineEvent('Plant Watered', 'Owner added 250ml water to pot', 'HEALTHY', 'watering');
    await sensorService.sendTelemetry({
      soilMoisture: 68,
      temperature: 23.5,
      humidity: 68,
      light: 65,
      co2: 520,
      deviceId: 'mock-esp32-demo',
      isMock: true,
    });
    await this.delay(4000);

    // Step 5: Stabilized
    this.currentValues = { ...MOCK_SCENARIOS[0].data };
    this.isDemoRunning = false;
    useMonitoringStore.getState().setActiveMockScenario('normal');
    console.log('[MOCK-SIM] 🎬 Automated demonstration completed.');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const mockSensorService = new MockSensorService();
