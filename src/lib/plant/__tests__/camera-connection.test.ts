import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCameraStore } from '../../../stores/plant/camera-store';
import { getDeviceLabel, selectPreferredDevice } from '../camera-manager';

describe('Camera Connection & Selection Control', () => {
  beforeEach(() => {
    useCameraStore.setState({
      isActive: false,
      isConnecting: false,
      selectedDeviceId: null,
      devices: [],
      cameraConnectHandler: null,
    });
  });

  it('initializes with disconnected state', () => {
    const state = useCameraStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.selectedDeviceId).toBeNull();
  });

  it('updates connection state when connecting', () => {
    useCameraStore.getState().setIsConnecting(true);
    expect(useCameraStore.getState().isConnecting).toBe(true);

    useCameraStore.getState().setActive(true);
    useCameraStore.getState().setIsConnecting(false);
    expect(useCameraStore.getState().isActive).toBe(true);
    expect(useCameraStore.getState().isConnecting).toBe(false);
  });

  it('generates readable device labels properly', () => {
    const mockDeviceWithLabel = {
      deviceId: 'cam-123',
      groupId: 'group-1',
      kind: 'videoinput' as MediaDeviceKind,
      label: 'Logitech Brio 4K',
      toJSON: () => ({}),
    };

    const mockDeviceWithoutLabel = {
      deviceId: 'cam-456',
      groupId: 'group-1',
      kind: 'videoinput' as MediaDeviceKind,
      label: '',
      toJSON: () => ({}),
    };

    expect(getDeviceLabel(mockDeviceWithLabel, 0)).toBe('Logitech Brio 4K');
    expect(getDeviceLabel(mockDeviceWithoutLabel, 1)).toBe('Camera 2');
  });

  it('selects preferred devices intelligently on desktop and mobile', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'cam-builtin',
        groupId: 'grp',
        kind: 'videoinput',
        label: 'Integrated Webcam',
        toJSON: () => ({}),
      },
      {
        deviceId: 'cam-usb',
        groupId: 'grp',
        kind: 'videoinput',
        label: 'USB Botanical Microscope Cam',
        toJSON: () => ({}),
      },
      {
        deviceId: 'cam-rear',
        groupId: 'grp',
        kind: 'videoinput',
        label: 'Back Camera',
        toJSON: () => ({}),
      },
    ];

    // Mobile prefers rear/environment
    const mobilePreferred = selectPreferredDevice(devices, true, null);
    expect(mobilePreferred).toBe('cam-rear');

    // Desktop prefers external USB camera
    const desktopPreferred = selectPreferredDevice(devices, false, null);
    expect(desktopPreferred).toBe('cam-usb');

    // Desktop honors previously stored camera id
    const storedPreferred = selectPreferredDevice(devices, false, 'cam-builtin');
    expect(storedPreferred).toBe('cam-builtin');
  });

  it('allows registering and invoking camera connect handler for switching cameras', async () => {
    const mockConnectHandler = vi.fn().mockResolvedValue({ success: true });
    useCameraStore.getState().setCameraConnectHandler(mockConnectHandler);

    expect(useCameraStore.getState().cameraConnectHandler).toBe(mockConnectHandler);

    const handler = useCameraStore.getState().cameraConnectHandler;
    const result = await handler!('cam-usb');

    expect(mockConnectHandler).toHaveBeenCalledWith('cam-usb');
    expect(result.success).toBe(true);
  });
});
