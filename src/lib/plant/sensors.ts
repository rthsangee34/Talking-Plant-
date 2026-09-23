import { PlantSensorReadings } from '../../types';

export function normalizeSensorReadings(raw: Partial<PlantSensorReadings>): PlantSensorReadings {
  const moisture = typeof raw.moisture === 'number' && !isNaN(raw.moisture)
    ? Math.max(0, Math.min(100, Math.round(raw.moisture)))
    : 50;

  const light = typeof raw.light === 'number' && !isNaN(raw.light)
    ? Math.max(0, Math.min(100, Math.round(raw.light)))
    : 65;

  const temperature = typeof raw.temperature === 'number' && !isNaN(raw.temperature)
    ? Math.round(raw.temperature * 10) / 10
    : null;

  const humidity = typeof raw.humidity === 'number' && !isNaN(raw.humidity)
    ? Math.max(0, Math.min(100, Math.round(raw.humidity)))
    : null;

  const co2 = typeof raw.co2 === 'number' && !isNaN(raw.co2)
    ? Math.max(0, Math.min(10000, Math.round(raw.co2)))
    : null;

  return {
    moisture,
    light,
    temperature,
    humidity,
    co2,
  };
}

export function formatSensorSummary(sensors: PlantSensorReadings): string {
  const parts = [
    `Soil Moisture: ${sensors.moisture}%`,
    `Light Level: ${sensors.light}%`,
  ];

  if (sensors.temperature !== null && sensors.temperature !== undefined) {
    parts.push(`Temperature: ${sensors.temperature}°C`);
  } else {
    parts.push(`Temperature: N/A`);
  }

  if (sensors.humidity !== null && sensors.humidity !== undefined) {
    parts.push(`Humidity: ${sensors.humidity}%`);
  } else {
    parts.push(`Humidity: N/A`);
  }

  if (sensors.co2 !== null && sensors.co2 !== undefined) {
    parts.push(`CO2 Level: ${sensors.co2} ppm`);
  } else {
    parts.push(`CO2: N/A`);
  }

  return parts.join(' | ');
}
