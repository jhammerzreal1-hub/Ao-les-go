/**
 * @license
 * .JHam Language / H-FID Standard / HEO — TWENTY 47 PROTOCOL - GENESIS NODE
 * Copyright (c) 1988-2026 Joshua Hamilton (JHammerZ) — https://jhammerz.github.io
 * Licensed under the MIT License & JHammerZ Custom Sovereign Licenses
 * (TWENTY 47 PROTOCOL - GENESIS NODE / LYSANDER CORE EULA / H-FID Forensic License v1.1).
 */

import { pushContinuitySettingsPatch } from './continuityClient';

export type MediaKind = 'microphone' | 'camera';
export type ResolvedBrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

export interface PersistedMediaPermissionsRecord {
  micGranted: boolean;
  micGrantedAt: string | null;
  cameraGranted: boolean;
  cameraGrantedAt: string | null;
  lastMicDeviceId?: string;
  lastMicLabel?: string;
}

export interface MediaPermissionProbe {
  kind: MediaKind;
  browserState: ResolvedBrowserPermissionState;
  hasLabeledHardwareDevice: boolean;
  rememberedGrant: boolean;
  canAcquireSilently: boolean;
}

const STORAGE_KEY = 'sovereign_media_permissions_v1';
const LEGACY_MIC_KEY = 'sovereign_voice_mic_permission_granted';
const LEGACY_CAM_KEY = 'sovereign_voice_camera_permission_granted';
const LEGACY_MIC_LABEL_KEY = 'sovereign_voice_mic_label';
const LEGACY_MIC_ID_KEY = 'sovereign_voice_mic_device_id';
const CONTINUITY_TS_KEY = 'sovereign_continuity_local_updated_at_v1';

let lastUserGestureAt = 0;
let gestureListenersInstalled = false;
let continuityListenerInstalled = false;
let micAcquireInFlight: Promise<{
  stream: MediaStream | null;
  status: 'granted' | 'needs-gesture' | 'denied' | 'unavailable';
  error?: any;
}> | null = null;
let cameraAcquireInFlight: Promise<{
  stream: MediaStream | null;
  status: 'granted' | 'needs-gesture' | 'denied' | 'unavailable';
  error?: any;
}> | null = null;

function installGlobalListenersOnce() {
  if (typeof window === 'undefined') return;

  if (!gestureListenersInstalled) {
    gestureListenersInstalled = true;
    const recordInteraction = (ev: Event) => {
      if ((ev as any).isTrusted !== false) {
        lastUserGestureAt = Date.now();
      }
    };
    window.addEventListener('pointerdown', recordInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', recordInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', recordInteraction, { capture: true, passive: true });
  }

  if (!continuityListenerInstalled) {
    continuityListenerInstalled = true;
    window.addEventListener('sovereign_continuity_hydrated', (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      const vd = detail?.settings?.voiceDock;
      if (!vd || typeof vd !== 'object') return;
      const cur = loadPersistedMediaPermissions();
      let changed = false;
      if (vd.micPermissionGranted === true && !cur.micGranted) {
        cur.micGranted = true;
        cur.micGrantedAt = vd.micPermissionGrantedAt || new Date().toISOString();
        changed = true;
      }
      if (vd.cameraPermissionGranted === true && !cur.cameraGranted) {
        cur.cameraGranted = true;
        cur.cameraGrantedAt = vd.cameraPermissionGrantedAt || new Date().toISOString();
        changed = true;
      }
      if (typeof vd.selectedMicId === 'string' && vd.selectedMicId && !cur.lastMicDeviceId) {
        cur.lastMicDeviceId = vd.selectedMicId;
        changed = true;
      }
      if (typeof vd.micLabel === 'string' && vd.micLabel && !cur.lastMicLabel) {
        cur.lastMicLabel = vd.micLabel;
        changed = true;
      }
      if (changed) {
        savePersistedMediaPermissions(cur, false);
      }
    });
  }
}

installGlobalListenersOnce();

export function markVoiceUserGesture(): void {
  lastUserGestureAt = Date.now();
}

export function hasRecentUserActivation(maxAgeMs = 3000): boolean {
  installGlobalListenersOnce();
  if (typeof navigator !== 'undefined' && (navigator as any).userActivation?.isActive) {
    return true;
  }
  return lastUserGestureAt > 0 && Date.now() - lastUserGestureAt <= maxAgeMs;
}

export function loadPersistedMediaPermissions(): PersistedMediaPermissionsRecord {
  const fallback: PersistedMediaPermissionsRecord = {
    micGranted: false,
    micGrantedAt: null,
    cameraGranted: false,
    cameraGrantedAt: null
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        fallback.micGranted = Boolean(parsed.micGranted);
        fallback.micGrantedAt = typeof parsed.micGrantedAt === 'string' ? parsed.micGrantedAt : null;
        fallback.cameraGranted = Boolean(parsed.cameraGranted);
        fallback.cameraGrantedAt = typeof parsed.cameraGrantedAt === 'string' ? parsed.cameraGrantedAt : null;
        if (typeof parsed.lastMicDeviceId === 'string') fallback.lastMicDeviceId = parsed.lastMicDeviceId;
        if (typeof parsed.lastMicLabel === 'string') fallback.lastMicLabel = parsed.lastMicLabel;
      }
    }
    if (!fallback.micGranted && localStorage.getItem(LEGACY_MIC_KEY) === '1') {
      fallback.micGranted = true;
      fallback.micGrantedAt = fallback.micGrantedAt || new Date().toISOString();
    }
    if (!fallback.cameraGranted && localStorage.getItem(LEGACY_CAM_KEY) === '1') {
      fallback.cameraGranted = true;
      fallback.cameraGrantedAt = fallback.cameraGrantedAt || new Date().toISOString();
    }
    if (!fallback.lastMicLabel) {
      const lbl = localStorage.getItem(LEGACY_MIC_LABEL_KEY);
      if (lbl) fallback.lastMicLabel = lbl;
    }
    if (!fallback.lastMicDeviceId) {
      const id = localStorage.getItem(LEGACY_MIC_ID_KEY);
      if (id) fallback.lastMicDeviceId = id;
    }
  } catch {}

  return fallback;
}

function savePersistedMediaPermissions(record: PersistedMediaPermissionsRecord, syncRemote = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    if (record.micGranted) {
      localStorage.setItem(LEGACY_MIC_KEY, '1');
    } else {
      localStorage.removeItem(LEGACY_MIC_KEY);
    }
    if (record.cameraGranted) {
      localStorage.setItem(LEGACY_CAM_KEY, '1');
    } else {
      localStorage.removeItem(LEGACY_CAM_KEY);
    }
    if (record.lastMicLabel) {
      localStorage.setItem(LEGACY_MIC_LABEL_KEY, record.lastMicLabel);
    }
    if (record.lastMicDeviceId) {
      localStorage.setItem(LEGACY_MIC_ID_KEY, record.lastMicDeviceId);
    }
    if (syncRemote) {
      localStorage.setItem(CONTINUITY_TS_KEY, new Date().toISOString());
    }
  } catch {}

  if (syncRemote) {
    pushContinuitySettingsPatch(
      {
        voiceDock: {
          micPermissionGranted: record.micGranted,
          micPermissionGrantedAt: record.micGrantedAt || undefined,
          cameraPermissionGranted: record.cameraGranted,
          cameraPermissionGrantedAt: record.cameraGrantedAt || undefined,
          ...(record.lastMicDeviceId ? { selectedMicId: record.lastMicDeviceId } : {}),
          ...(record.lastMicLabel ? { micLabel: record.lastMicLabel } : {})
        }
      },
      true
    );
  }
}

export function markMediaPermissionGranted(
  kind: MediaKind,
  meta?: { deviceId?: string; label?: string }
): PersistedMediaPermissionsRecord {
  const cur = loadPersistedMediaPermissions();
  const now = new Date().toISOString();
  let changed = false;

  if (kind === 'microphone') {
    if (!cur.micGranted) {
      cur.micGranted = true;
      cur.micGrantedAt = now;
      changed = true;
    }
    if (meta?.deviceId && meta.deviceId !== cur.lastMicDeviceId) {
      cur.lastMicDeviceId = meta.deviceId;
      changed = true;
    }
    if (meta?.label && meta.label !== cur.lastMicLabel) {
      cur.lastMicLabel = meta.label;
      changed = true;
    }
  } else {
    if (!cur.cameraGranted) {
      cur.cameraGranted = true;
      cur.cameraGrantedAt = now;
      changed = true;
    }
  }

  if (changed) {
    savePersistedMediaPermissions(cur, true);
  }
  return cur;
}

export function clearMediaPermissionGrant(kind: MediaKind): void {
  const cur = loadPersistedMediaPermissions();
  if (kind === 'microphone') {
    if (!cur.micGranted) return;
    cur.micGranted = false;
    cur.micGrantedAt = null;
  } else {
    if (!cur.cameraGranted) return;
    cur.cameraGranted = false;
    cur.cameraGrantedAt = null;
  }
  savePersistedMediaPermissions(cur, true);
}

/**
 * Safely checks whether the browser ALREADY grants microphone or camera permission
 * WITHOUT triggering any getUserMedia() prompt dialog.
 */
export async function probeMediaPermission(kind: MediaKind): Promise<MediaPermissionProbe> {
  const persisted = loadPersistedMediaPermissions();
  const rememberedGrant = kind === 'microphone' ? persisted.micGranted : persisted.cameraGranted;
  const targetDeviceKind = kind === 'microphone' ? 'audioinput' : 'videoinput';

  let browserState: ResolvedBrowserPermissionState = 'unknown';
  let hasLabeledHardwareDevice = false;

  if (typeof navigator === 'undefined') {
    return {
      kind,
      browserState: 'unknown',
      hasLabeledHardwareDevice: false,
      rememberedGrant,
      canAcquireSilently: false
    };
  }

  if (navigator.permissions?.query) {
    try {
      const status = await Promise.race([
        navigator.permissions.query({ name: kind as PermissionName }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 650))
      ]);
      if (status && (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied')) {
        browserState = status.state;
      }
    } catch {}
  }

  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await Promise.race([
        navigator.mediaDevices.enumerateDevices(),
        new Promise<MediaDeviceInfo[]>((resolve) => setTimeout(() => resolve([]), 650))
      ]);
      hasLabeledHardwareDevice = devices.some(
        (d) => d.kind === targetDeviceKind && typeof d.label === 'string' && d.label.trim().length > 0
      );
      if (hasLabeledHardwareDevice && browserState === 'unknown') {
        browserState = 'granted';
      }
    } catch {}
  }

  if (browserState === 'granted' || hasLabeledHardwareDevice) {
    if (!rememberedGrant) {
      markMediaPermissionGranted(kind);
    }
  } else if (browserState === 'denied' && rememberedGrant) {
    clearMediaPermissionGrant(kind);
  }

  // Only acquire silently on boot when Chromium/browser actively confirms permission is granted
  // (never trigger an unprompted native Allow dialog if browserState is 'prompt' or 'unknown').
  const canAcquireSilently = browserState === 'granted' || hasLabeledHardwareDevice;

  return {
    kind,
    browserState,
    hasLabeledHardwareDevice,
    rememberedGrant: canAcquireSilently ? true : rememberedGrant,
    canAcquireSilently
  };
}

export async function requestMicrophoneStream(options?: {
  allowPrompt?: boolean;
  constraintsList?: MediaStreamConstraints[];
}): Promise<{
  stream: MediaStream | null;
  status: 'granted' | 'needs-gesture' | 'denied' | 'unavailable';
  error?: any;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, status: 'unavailable' };
  }

  if (micAcquireInFlight) {
    return micAcquireInFlight;
  }

  const run = (async () => {
    const allowPrompt = Boolean(options?.allowPrompt);
    const probe = await probeMediaPermission('microphone');

    if (probe.browserState === 'denied') {
      return { stream: null, status: 'denied' as const };
    }

    if (!probe.canAcquireSilently && !allowPrompt) {
      return { stream: null, status: 'needs-gesture' as const };
    }

    const attempts: MediaStreamConstraints[] =
      options?.constraintsList && options.constraintsList.length > 0
        ? options.constraintsList
        : [
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            },
            { audio: true }
          ];

    let lastErr: any = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.enabled = true;
          const resolvedId = track.getSettings?.().deviceId;
          markMediaPermissionGranted('microphone', {
            deviceId: resolvedId || undefined,
            label: track.label || undefined
          });
        } else {
          markMediaPermissionGranted('microphone');
        }
        return { stream, status: 'granted' as const };
      } catch (err: any) {
        lastErr = err;
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          const postProbe = await probeMediaPermission('microphone').catch(() => null);
          if (postProbe?.browserState === 'denied') {
            clearMediaPermissionGrant('microphone');
            return { stream: null, status: 'denied' as const, error: err };
          }
          return { stream: null, status: 'needs-gesture' as const, error: err };
        }
      }
    }

    const errName = String(lastErr?.name || '');
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      return { stream: null, status: 'denied' as const, error: lastErr };
    }
    return { stream: null, status: 'unavailable' as const, error: lastErr };
  })();

  micAcquireInFlight = run;
  try {
    return await run;
  } finally {
    if (micAcquireInFlight === run) {
      micAcquireInFlight = null;
    }
  }
}

export async function requestCameraStream(options?: {
  allowPrompt?: boolean;
  constraints?: MediaStreamConstraints;
}): Promise<{
  stream: MediaStream | null;
  status: 'granted' | 'needs-gesture' | 'denied' | 'unavailable';
  error?: any;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, status: 'unavailable' };
  }

  if (cameraAcquireInFlight) {
    return cameraAcquireInFlight;
  }

  const run = (async () => {
    const allowPrompt = Boolean(options?.allowPrompt);
    const probe = await probeMediaPermission('camera');

    if (probe.browserState === 'denied') {
      return { stream: null, status: 'denied' as const };
    }

    if (!probe.canAcquireSilently && !allowPrompt) {
      return { stream: null, status: 'needs-gesture' as const };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        options?.constraints || { video: { facingMode: 'environment' } }
      );
      markMediaPermissionGranted('camera');
      return { stream, status: 'granted' as const };
    } catch (err: any) {
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        const postProbe = await probeMediaPermission('camera').catch(() => null);
        if (postProbe?.browserState === 'denied') {
          clearMediaPermissionGrant('camera');
          return { stream: null, status: 'denied' as const, error: err };
        }
        return { stream: null, status: 'needs-gesture' as const, error: err };
      }
      return { stream: null, status: 'unavailable' as const, error: err };
    }
  })();

  cameraAcquireInFlight = run;
  try {
    return await run;
  } finally {
    if (cameraAcquireInFlight === run) {
      cameraAcquireInFlight = null;
    }
  }
}
