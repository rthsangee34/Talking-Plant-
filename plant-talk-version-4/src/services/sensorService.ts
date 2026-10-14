/**
 * Client-Side 24/7 Sensor Stream Service
 *
 * Connects to the Express backend SSE endpoint (/api/sensors/stream),
 * receives real-time telemetry, health scores, trend analyses, anomalies,
 * and alerts, and synchronizes with Zustand stores.
 */

import { useSensorsStore } from '../stores/plant/sensors-store';
import { useMonitoringStore } from '../stores/plant/monitoring-store';
import { speakTouchWarning } from '../lib/plant/warning-voice-system';
import type {
  SensorReading,
  HealthScoreBreakdown,
  DeviceConnectionStatus,
  MonitoringAlert,
  TrendAnalysisResult,
  PlantTimelineEvent,
  PlantTelemetryPayload,
} from '../types/plantMonitoring';

class SensorService {
  private eventSource: EventSource | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  public connect(): void {
    if (this.eventSource || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.eventSource = new EventSource('/api/sensors/stream');

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('[SENSOR-SERVICE] 🟢 Connected to 24/7 telemetry SSE stream.');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.handleEvent(parsed.type, parsed.data);
        } catch (err) {
          console.warn('[SENSOR-SERVICE] Failed to parse SSE message:', err);
        }
      };

      this.eventSource.onerror = () => {
        console.warn('[SENSOR-SERVICE] ⚠️ SSE connection lost, reconnecting...');
        this.disconnect();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleEvent(type: string, data: any): void {
    const monitoringStore = useMonitoringStore.getState();
    const sensorsStore = useSensorsStore.getState();

    switch (type) {
      case 'init': {
        if (data.latest) {
          sensorsStore.updateReadings({
            moisture: data.latest.soilMoisture,
            temperature: data.latest.temperature,
            humidity: data.latest.humidity,
            light: data.latest.light,
            co2: data.latest.co2,
          });
        }
        if (data.deviceStatus) {
          monitoringStore.setDeviceStatus(data.deviceStatus);
        }
        if (Array.isArray(data.history)) {
          monitoringStore.setHistoricalPoints(data.history);
        }
        break;
      }

      case 'telemetry': {
        const reading = data as SensorReading;
        // If not in manual slider mode, sync incoming values
        if (!sensorsStore.isManualOverride) {
          sensorsStore.updateReadings({
            moisture: reading.soilMoisture,
            temperature: reading.temperature,
            humidity: reading.humidity,
            light: reading.light,
            co2: reading.co2,
          });
          sensorsStore.setEspConnected(true);
          sensorsStore.setConnectionStatus('connected');
        }
        break;
      }

      case 'device': {
        const devStatus = data as DeviceConnectionStatus;
        monitoringStore.setDeviceStatus(devStatus);
        if (devStatus.isOnline) {
          sensorsStore.setEspConnected(true);
        }
        break;
      }

      case 'health': {
        const health = data as HealthScoreBreakdown;
        monitoringStore.setHealthScore(health);
        break;
      }

      case 'trends': {
        const trends = data as TrendAnalysisResult[];
        monitoringStore.setTrends(trends);
        break;
      }

      case 'alert': {
        const alert = data as MonitoringAlert;
        monitoringStore.addAlert(alert);

        // Announce critical or attention alert if voice is enabled
        if (monitoringStore.isVoiceAlertEnabled && alert.level !== 'INFO') {
          // Announce with plant personality voice
          const phrase = alert.level === 'CRITICAL'
            ? `Attention! ${alert.title}. ${alert.recommendedAction}`
            : `${alert.title}. ${alert.recommendedAction}`;
          speakTouchWarning(phrase, 'en');
        }
        break;
      }

      case 'timeline_event': {
        const timelineEvent = data as PlantTimelineEvent;
        monitoringStore.addTimelineEvent(timelineEvent);
        break;
      }

      case 'history_sample': {
        monitoringStore.fetchHistory();
        break;
      }

      default:
        break;
    }
  }

  /**
   * Submit telemetry directly to backend (used by mock simulator and external bridges)
   */
  public async sendTelemetry(payload: PlantTelemetryPayload): Promise<boolean> {
    try {
      const res = await fetch('/api/sensors/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Post a user activity (e.g. watering, fertilizer, physical check) to timeline
   */
  public async recordTimelineEvent(
    title: string,
    description: string,
    status: string = 'HEALTHY',
    type: string = 'watering'
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/sensors/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status, type }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const sensorService = new SensorService();
