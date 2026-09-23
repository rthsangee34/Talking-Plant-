import { useSensorsStore } from '../../stores/plant/sensors-store';
import { PlantSensorReadings } from '../../types';

let currentPort: SerialPort | null = null;
let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let isReading = false;

let waitingTimer: ReturnType<typeof setTimeout> | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;

export function checkIsEmbeddedPreview(): boolean {
  try {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;

    return isIframe || !hasSerial || !isSecure;
  } catch {
    return true;
  }
}

export function parseAndValidateSensorPacket(line: string): Partial<PlantSensorReadings> | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const hasMoisture = typeof parsed.moisture === 'number';
    const hasLight = typeof parsed.light === 'number';
    const hasTemp = typeof parsed.temperature === 'number' || parsed.temperature === null;
    const hasHum = typeof parsed.humidity === 'number' || parsed.humidity === null;
    const hasCo2 = typeof parsed.co2 === 'number' || parsed.co2 === null;

    if (!hasMoisture && !hasLight && !hasTemp && !hasHum && !hasCo2) {
      return null;
    }

    return {
      moisture: typeof parsed.moisture === 'number' ? parsed.moisture : undefined,
      light: typeof parsed.light === 'number' ? parsed.light : undefined,
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : (parsed.temperature === null ? null : undefined),
      humidity: typeof parsed.humidity === 'number' ? parsed.humidity : (parsed.humidity === null ? null : undefined),
      co2: typeof parsed.co2 === 'number' ? parsed.co2 : (parsed.co2 === null ? null : undefined),
    };
  } catch {
    return null;
  }
}

function clearTimers() {
  if (waitingTimer) {
    clearTimeout(waitingTimer);
    waitingTimer = null;
  }
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
}

function resetStaleTimer() {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    const { isEspConnected } = useSensorsStore.getState();
    if (isEspConnected) {
      useSensorsStore.getState().setConnectionStatus('stale');
    }
  }, 7000);
}

export async function disconnectESP32() {
  isReading = false;
  clearTimers();

  if (currentReader) {
    try {
      await currentReader.cancel();
    } catch {
      // ignore stream cancellation errors
    }
    try {
      currentReader.releaseLock();
    } catch {
      // ignore lock release errors
    }
    currentReader = null;
  }

  if (currentPort) {
    try {
      await currentPort.close();
    } catch (err) {
      console.warn('ESP32 Serial close warning:', err);
    }
    currentPort = null;
  }

  useSensorsStore.getState().resetConnectionInfo();
}

export async function connectESP32() {
  const store = useSensorsStore.getState();

  if (typeof navigator === 'undefined' || !('serial' in navigator) || !navigator.serial) {
    store.setConnectionStatus('unsupported');
    store.setConnectionError(
      'Use desktop Google Chrome or Microsoft Edge.',
      'navigator.serial is undefined in this browser environment.'
    );
    return;
  }

  // Clean up any existing connection first
  await disconnectESP32();

  try {
    store.setConnectionStatus('selecting');
    store.setConnectionError(null);

    // Prompt user to select COM port (no vendor filters to allow CP210x, CH340, FTDI, native USB)
    const port = await navigator.serial.requestPort();
    currentPort = port;

    store.setConnectionStatus('connecting');

    // Open port with standard 115200 8N1 parameters
    await port.open({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });

    store.setConnectionStatus('waiting_data');
    store.setEspConnected(true);

    // Handle physical USB disconnection
    const onDisconnect = () => {
      console.warn('ESP32 Serial port physically disconnected');
      disconnectESP32();
      useSensorsStore.getState().setConnectionError(
        'ESP32 USB cable was disconnected.',
        'Physical USB disconnect event received.'
      );
    };

    port.addEventListener('disconnect', onDisconnect, { once: true });

    // Set 7-second waiting timer for initial packet check
    waitingTimer = setTimeout(() => {
      const currentState = useSensorsStore.getState();
      if (currentState.isEspConnected && currentState.validPacketCount === 0) {
        currentState.setConnectionError(
          'ESP32 is connected, but no valid sensor data was received. Check the firmware output and confirm that both sides use 115200 baud.',
          'Timeout waiting for first JSON packet'
        );
      }
    }, 7000);

    // Start background reading loop
    startReadingLoop(port);
  } catch (err: unknown) {
    await disconnectESP32();

    let friendlyMsg = 'Failed to connect to ESP32 serial port.';
    let techMsg = String(err);

    if (err && typeof err === 'object' && 'name' in err) {
      const errName = (err as { name: string }).name;
      if (errName === 'NotFoundError') {
        friendlyMsg = 'No serial port was selected.';
      } else if (errName === 'SecurityError') {
        friendlyMsg = 'Serial access is blocked in this browser or embedded preview.';
      } else if (errName === 'NetworkError') {
        friendlyMsg = 'The COM port may already be in use. Close Arduino Serial Monitor and try again.';
      } else if (errName === 'InvalidStateError') {
        friendlyMsg = 'The selected serial port is already open.';
      }
    }

    useSensorsStore.getState().setConnectionStatus('error');
    useSensorsStore.getState().setConnectionError(friendlyMsg, techMsg);
  }
}

export async function reconnectESP32() {
  await disconnectESP32();
  await connectESP32();
}

async function startReadingLoop(port: SerialPort) {
  isReading = true;
  const textDecoder = new TextDecoder();
  let buffer = '';

  while (isReading && port.readable) {
    try {
      currentReader = port.readable.getReader();

      while (isReading) {
        const { value, done } = await currentReader.read();

        if (done) {
          break; // Stream ended
        }

        if (value) {
          const chunk = textDecoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep remaining incomplete string

          for (let line of lines) {
            line = line.replace('\r', '').trim();
            if (!line) continue;

            useSensorsStore.getState().setLastRawLine(line);

            const parsedPacket = parseAndValidateSensorPacket(line);
            if (parsedPacket) {
              if (waitingTimer) {
                clearTimeout(waitingTimer);
                waitingTimer = null;
              }
              useSensorsStore.getState().recordValidPacket(line, parsedPacket);
              resetStaleTimer();
            }
          }
        }
      }
    } catch (err) {
      if (isReading) {
        console.warn('ESP32 Serial read error:', err);
      }
    } finally {
      if (currentReader) {
        try {
          currentReader.releaseLock();
        } catch {
          // ignore
        }
        currentReader = null;
      }
    }
  }
}
