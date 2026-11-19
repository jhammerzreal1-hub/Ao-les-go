/**
 * @license
 * .JHam Language / H-FID Standard / HEO — TWENTY 47 PROTOCOL - GENESIS NODE
 * Copyright (c) 1988-2026 Joshua Hamilton (JHammerZ) — https://jhammerz.github.io
 * Licensed under the MIT License & JHammerZ Custom Sovereign Licenses
 * (TWENTY 47 PROTOCOL - GENESIS NODE / LYSANDER CORE EULA / H-FID Forensic License v1.1).
 * Zenodo DOI: https://doi.org/10.5281/zenodo.20778079 | ORCID: https://orcid.org/0009-0004-5273-7028
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  PhoneOff,
  Compass,
  Wrench,
  Send,
  RefreshCw,
  GripHorizontal,
  Brain,
  BookmarkPlus,
  Check
} from 'lucide-react';
import type { ModuleType } from '../types';
import { ALL_MODULES } from './Navigation';
import { selectBestSystemVoice } from '../utils/voiceEngine';

export type LiveVoicePersona = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
export type NativeEnglishAccent = 'en-US' | 'en-GB';
export type MicCaptureMode = 'hybrid' | 'vad' | 'browser-stt';
export type MicHardwareStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable';

export interface TalkTranscriptEntry {
  id: string;
  role: 'user' | 'model' | 'thought' | 'tool';
  text: string;
  timestamp: string;
}

export interface PersistentTalkDockProps {
  isActive: boolean;
  onDeactivate: () => void;
  activeModule: ModuleType;
  openModules: ModuleType[];
  onSelectModule: (mod: ModuleType) => void;
  onNavigateBrowserUrl?: (url: string) => void;
  onSaveToVault?: (title: string, content: string, model: string, metadataJson?: string) => void;
  onStatusChange?: (status: {
    connected: boolean;
    connecting: boolean;
    muted: boolean;
    speaking: boolean;
    exploringTool: string | null;
  }) => void;
}

const VOICE_OPTIONS: Array<{ id: LiveVoicePersona; label: string; style: string }> = [
  { id: 'Zephyr', label: 'Zephyr', style: 'Natural Peer' },
  { id: 'Puck', label: 'Puck', style: 'Quick & Sharp' },
  { id: 'Charon', label: 'Charon', style: 'Calm Analytical' },
  { id: 'Kore', label: 'Kore', style: 'Clear Studio' },
  { id: 'Fenrir', label: 'Fenrir', style: 'Deep Direct' }
];

function downsampleTo16k(float32: Float32Array, inputSampleRate: number): Float32Array {
  if (!inputSampleRate || inputSampleRate === 16000) return float32;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.max(1, Math.round(float32.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i * ratio;
    const low = Math.floor(srcIdx);
    const high = Math.min(float32.length - 1, low + 1);
    const frac = srcIdx - low;
    out[i] = float32[low] * (1 - frac) + float32[high] * frac;
  }
  return out;
}

function pcmFloatToBase64(float32: Float32Array, inputSampleRate = 16000): string {
  const resampled = downsampleTo16k(float32, inputSampleRate);
  const pcm16 = new Int16Array(resampled.length);
  for (let i = 0; i < resampled.length; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    pcm16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/[^\s)]+/gi, ' ')
    .replace(/[*_~#|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBestRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {}
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio clip'));
    reader.readAsDataURL(blob);
  });
}

export const PersistentTalkDock: React.FC<PersistentTalkDockProps> = ({
  isActive,
  onDeactivate,
  activeModule,
  openModules,
  onSelectModule,
  onNavigateBrowserUrl,
  onSaveToVault,
  onStatusChange
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [peerExploreEnabled, setPeerExploreEnabled] = useState(true);
  const [autoArchiveVault, setAutoArchiveVault] = useState(true);
  const [vaultSavedFlash, setVaultSavedFlash] = useState(false);
  const [transportMode, setTransportMode] = useState<'gemini-live-pcm' | 'sovereign-duplex-relay'>('gemini-live-pcm');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [micStatus, setMicStatus] = useState<MicHardwareStatus>('idle');
  const [micLabel, setMicLabel] = useState<string>('');
  const [micDevices, setMicDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    try {
      return localStorage.getItem('sovereign_voice_mic_device_id') || '';
    } catch {
      return '';
    }
  });
  const [captureMode, setCaptureMode] = useState<MicCaptureMode>(() => {
    try {
      const saved = localStorage.getItem('sovereign_voice_capture_mode') as MicCaptureMode | null;
      if (saved === 'hybrid' || saved === 'vad' || saved === 'browser-stt') return saved;
    } catch {}
    return 'hybrid';
  });
  const [vadRecording, setVadRecording] = useState(false);
  const [vadTranscribing, setVadTranscribing] = useState(false);

  const [voiceName, setVoiceName] = useState<LiveVoicePersona>(() => {
    try {
      const saved = localStorage.getItem('sovereign_persistent_talk_voice_v1') as LiveVoicePersona | null;
      if (saved && VOICE_OPTIONS.some((v) => v.id === saved)) return saved;
    } catch {}
    return 'Zephyr';
  });
  const [voiceAccent, setVoiceAccent] = useState<NativeEnglishAccent>(() => {
    try {
      const saved = localStorage.getItem('sovereign_persistent_talk_accent_v1') as NativeEnglishAccent | null;
      if (saved === 'en-US' || saved === 'en-GB') return saved;
    } catch {}
    return 'en-US';
  });
  const [expanded, setExpanded] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [interactionStatus, setInteractionStatus] = useState<'IDLE' | 'IN_PROGRESS'>('IDLE');
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TalkTranscriptEntry[]>([]);
  const transcriptsRef = useRef<TalkTranscriptEntry[]>([]);
  const liveSessionIdRef = useRef<string>(`live-${Date.now()}`);
  const [quickNudge, setQuickNudge] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  // Draggable dock offset so user can move it anywhere out of the way
  const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(null);
  const dragDockRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const dockElRef = useRef<HTMLDivElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const vadRecorderRef = useRef<MediaRecorder | null>(null);
  const vadChunksRef = useRef<Blob[]>([]);
  const vadSpeechStartRef = useRef<number>(0);
  const vadLastVoiceRef = useRef<number>(0);
  const vadInFlightRef = useRef<boolean>(false);
  const sttHandledAtRef = useRef<number>(0);
  const sttBrokenRef = useRef<boolean>(false);
  const noiseFloorRef = useRef<number>(0.008);
  const vadAboveCountRef = useRef<number>(0);

  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const relayModeRef = useRef<boolean>(false);
  const isConnectedRef = useRef(false);
  const isMutedRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const isModelSpeakingRef = useRef(false);
  const peerExploreRef = useRef(true);
  const activeModuleRef = useRef<ModuleType>(activeModule);
  const openModulesRef = useRef<ModuleType[]>(openModules);
  const voiceNameRef = useRef<LiveVoicePersona>(voiceName);
  const voiceAccentRef = useRef<NativeEnglishAccent>(voiceAccent);
  const selectedMicIdRef = useRef<string>(selectedMicId);
  const captureModeRef = useRef<MicCaptureMode>(captureMode);
  const lastModuleSentRef = useRef<string>('');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const speakingMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeModuleRef.current = activeModule;
    openModulesRef.current = openModules;
  }, [activeModule, openModules]);

  useEffect(() => {
    voiceNameRef.current = voiceName;
  }, [voiceName]);

  useEffect(() => {
    voiceAccentRef.current = voiceAccent;
    try {
      localStorage.setItem('sovereign_persistent_talk_accent_v1', voiceAccent);
    } catch {}
  }, [voiceAccent]);

  useEffect(() => {
    selectedMicIdRef.current = selectedMicId;
    try {
      localStorage.setItem('sovereign_voice_mic_device_id', selectedMicId);
    } catch {}
  }, [selectedMicId]);

  useEffect(() => {
    captureModeRef.current = captureMode;
    try {
      localStorage.setItem('sovereign_voice_capture_mode', captureMode);
    } catch {}
  }, [captureMode]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    isModelSpeakingRef.current = isModelSpeaking;
  }, [isModelSpeaking]);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`
        }));
      setMicDevices(inputs);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    refreshMicDevices();
    const onDeviceChange = () => refreshMicDevices();
    try {
      navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange);
    } catch {}
    return () => {
      try {
        navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
      } catch {}
    };
  }, [refreshMicDevices]);

  const flushPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    activeSourcesRef.current.clear();

    if (activeAudioElRef.current) {
      try {
        activeAudioElRef.current.pause();
        activeAudioElRef.current.currentTime = 0;
      } catch {}
      activeAudioElRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    speakingMessageIdRef.current = null;
    isModelSpeakingRef.current = false;
    setIsModelSpeaking(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: null, id: null } }));
    }

    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    if (speakerMuted) {
      flushPlaybackQueue();
    }
  }, [speakerMuted, flushPlaybackQueue]);

  useEffect(() => {
    peerExploreRef.current = peerExploreEnabled;
  }, [peerExploreEnabled]);

  useEffect(() => {
    onStatusChange?.({
      connected: isConnected,
      connecting: isConnecting,
      muted: isMuted,
      speaking: isModelSpeaking,
      exploringTool: activeToolName
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sovereign_persistent_talk_state', {
          detail: {
            active: isActive,
            connected: isConnected,
            connecting: isConnecting,
            muted: isMuted,
            speakerMuted,
            speaking: isModelSpeaking,
            transport: transportMode,
            voiceName,
            micStatus,
            micLabel,
            captureMode,
            activeToolName,
            autoArchiveVault,
            peerExploreEnabled
          }
        })
      );
    }
  }, [
    isActive,
    isConnected,
    isConnecting,
    isMuted,
    speakerMuted,
    isModelSpeaking,
    transportMode,
    voiceName,
    micStatus,
    micLabel,
    captureMode,
    activeToolName,
    autoArchiveVault,
    peerExploreEnabled,
    onStatusChange
  ]);

  useEffect(() => {
    if (expanded) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, expanded]);

  const speakBrowserFallback = useCallback(
    (text: string, messageId?: string) => {
      if (speakerMutedRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const clean = cleanTextForSpeech(text);
      if (!clean) return;
      try {
        const voices = window.speechSynthesis.getVoices();
        const preferredGender = voiceNameRef.current === 'Charon' || voiceNameRef.current === 'Fenrir' ? 'male' : 'female';
        // STRICT NATIVE ENGLISH ONLY (US / British / CA / AU / NZ / IE) — NEVER speak with a foreign or foreign-accented voice
        const preferred = selectBestSystemVoice(voices, voiceNameRef.current, preferredGender, voiceAccentRef.current);
        if (!preferred) {
          return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clean.slice(0, 1200));
        utter.voice = preferred;
        utter.lang = preferred.lang || voiceAccentRef.current;
        utter.rate = 1.02;
        speakingMessageIdRef.current = messageId || 'live';
        isModelSpeakingRef.current = true;
        setIsModelSpeaking(true);
        window.dispatchEvent(
          new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: messageId || null, id: messageId || null } })
        );
        utter.onend = () => {
          speakingMessageIdRef.current = null;
          isModelSpeakingRef.current = false;
          setIsModelSpeaking(false);
          window.dispatchEvent(new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: null, id: null } }));
        };
        utter.onerror = () => {
          speakingMessageIdRef.current = null;
          isModelSpeakingRef.current = false;
          setIsModelSpeaking(false);
          window.dispatchEvent(new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: null, id: null } }));
        };
        window.speechSynthesis.speak(utter);
      } catch {}
    },
    []
  );

  const playNeuralAudioUrl = useCallback(
    async (audioUrl: string, fallbackText?: string, messageId?: string) => {
      if (speakerMutedRef.current) return;
      flushPlaybackQueue();

      // Primary: decode & play through the already-unlocked Web Audio outputCtx (100% immune to Chrome async autoplay blocks!)
      const outCtx = outputCtxRef.current;
      if (outCtx) {
        try {
          if (outCtx.state === 'suspended') {
            await outCtx.resume().catch(() => {});
          }
          const resp = await fetch(audioUrl);
          const arrBuf = await resp.arrayBuffer();
          const audioBuf = await outCtx.decodeAudioData(arrBuf.slice(0));
          const src = outCtx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(outCtx.destination);
          activeSourcesRef.current.add(src);
          speakingMessageIdRef.current = messageId || 'live';
          isModelSpeakingRef.current = true;
          setIsModelSpeaking(true);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: messageId || null, id: messageId || null } })
            );
          }
          src.onended = () => {
            activeSourcesRef.current.delete(src);
            if (activeSourcesRef.current.size === 0) {
              speakingMessageIdRef.current = null;
              isModelSpeakingRef.current = false;
              setIsModelSpeaking(false);
              window.dispatchEvent(new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: null, id: null } }));
            }
          };
          src.start(0);
          return;
        } catch {
          // Fall through cleanly to HTMLAudioElement
        }
      }

      try {
        const audio = new Audio(audioUrl);
        activeAudioElRef.current = audio;
        speakingMessageIdRef.current = messageId || 'live';
        isModelSpeakingRef.current = true;
        setIsModelSpeaking(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: messageId || null, id: messageId || null } })
          );
        }
        audio.onended = () => {
          if (activeAudioElRef.current === audio) {
            activeAudioElRef.current = null;
            speakingMessageIdRef.current = null;
            isModelSpeakingRef.current = false;
            setIsModelSpeaking(false);
            window.dispatchEvent(new CustomEvent('sovereign_voice_speaking_id', { detail: { speakingId: null, id: null } }));
          }
        };
        audio.onerror = () => {
          if (activeAudioElRef.current === audio) {
            activeAudioElRef.current = null;
            isModelSpeakingRef.current = false;
            setIsModelSpeaking(false);
          }
          if (fallbackText) speakBrowserFallback(fallbackText, messageId);
        };
        audio.play().catch(() => {
          if (fallbackText) speakBrowserFallback(fallbackText, messageId);
        });
      } catch {
        if (fallbackText) speakBrowserFallback(fallbackText, messageId);
      }
    },
    [flushPlaybackQueue, speakBrowserFallback]
  );

  const schedulePcmPlayback = useCallback((base64Pcm: string) => {
    if (speakerMutedRef.current) return;
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }

    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = outCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const src = outCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(outCtx.destination);

    const now = outCtx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now;
    }
    src.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    activeSourcesRef.current.add(src);
    isModelSpeakingRef.current = true;
    setIsModelSpeaking(true);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
      if (activeSourcesRef.current.size === 0) {
        isModelSpeakingRef.current = false;
        setIsModelSpeaking(false);
      }
    };
  }, []);

  const appendTranscript = useCallback((role: TalkTranscriptEntry['role'], text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Mirror live speech, agent Chain-of-Thought, and autonomous tool logs directly into ChatModule
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sovereign_chat_live_transcript', {
          detail: {
            sessionId: liveSessionIdRef.current,
            voiceName: voiceNameRef.current,
            role,
            text: cleaned,
            timestamp
          }
        })
      );
    }

    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      let next: TalkTranscriptEntry[];
      if (last && last.role === role && role !== 'tool') {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: `${last.text} ${cleaned}`.replace(/\s+/g, ' ')
        };
        next = updated.slice(-80);
      } else {
        next = [
          ...prev.slice(-79),
          {
            id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role,
            text: cleaned,
            timestamp
          }
        ];
      }
      transcriptsRef.current = next;
      return next;
    });
  }, []);

  const archiveSessionToVault = useCallback(
    (entries: TalkTranscriptEntry[] = transcriptsRef.current) => {
      if (!onSaveToVault || entries.length === 0) return false;
      const thoughtCount = entries.filter((e) => e.role === 'thought').length;
      const toolCount = entries.filter((e) => e.role === 'tool').length;
      const startedAt = new Date().toLocaleString();
      const lines: string[] = [
        `# Live Peer Conversation & Chain-of-Thought Log (${voiceNameRef.current})`,
        `Recorded: ${startedAt} · Turns: ${entries.length} · Thought Blocks: ${thoughtCount} · Autonomous Tools: ${toolCount}`,
        ''
      ];
      for (const entry of entries) {
        if (entry.role === 'user') {
          lines.push(`### [${entry.timestamp}] You (Voice Transcript)\n${entry.text}\n`);
        } else if (entry.role === 'thought') {
          lines.push(`### [${entry.timestamp}] ${voiceNameRef.current} — Chain-of-Thought Reasoning\n> ${entry.text.replace(/\n/g, '\n> ')}\n`);
        } else if (entry.role === 'tool') {
          lines.push(`- \`[${entry.timestamp}] AUTONOMOUS TOOL:\` ${entry.text}`);
        } else {
          lines.push(`### [${entry.timestamp}] ${voiceNameRef.current} (Spoken Response)\n${entry.text}\n`);
        }
      }
      onSaveToVault(
        `Voice Chat + CoT Log (${voiceNameRef.current} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        lines.join('\n'),
        relayModeRef.current ? 'lyrailius-omega-voice-duplex' : 'gemini-3.8-live',
        JSON.stringify({
          kind: 'live_peer_transcript_with_cot',
          voiceName: voiceNameRef.current,
          entryCount: entries.length,
          thoughtCount,
          toolCount,
          archivedAt: new Date().toISOString()
        })
      );
      setVaultSavedFlash(true);
      setTimeout(() => setVaultSavedFlash(false), 2400);
      return true;
    },
    [onSaveToVault]
  );

  const stopContinuousRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimSpeech('');
  }, []);

  const stopActiveVadRecorder = useCallback((discard = true) => {
    const rec = vadRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      if (discard) {
        rec.onstop = null;
      }
      try {
        rec.stop();
      } catch {}
    }
    if (discard) {
      vadRecorderRef.current = null;
      vadChunksRef.current = [];
      vadSpeechStartRef.current = 0;
      vadLastVoiceRef.current = 0;
      setVadRecording(false);
    }
  }, []);

  const sendRelayUtterance = useCallback(
    (spokenText: string) => {
      const cleaned = spokenText.trim();
      if (!cleaned || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      flushPlaybackQueue();
      appendTranscript('user', cleaned);
      const activeMeta = ALL_MODULES.find((m) => m.id === activeModuleRef.current);
      wsRef.current.send(
        JSON.stringify({
          relayTurn: {
            text: cleaned,
            activeModule: activeModuleRef.current,
            activeLabel: activeMeta?.label || activeModuleRef.current,
            openModules: openModulesRef.current
          }
        })
      );
    },
    [appendTranscript, flushPlaybackQueue]
  );

  const transcribeVadBlobAndSend = useCallback(
    async (blob: Blob, mimeType: string, utteranceStartedAt: number) => {
      if (blob.size < 1400) return;
      // Avoid duplicate sends if browser SpeechRecognition already captured this exact phrase
      if (sttHandledAtRef.current >= utteranceStartedAt - 300) return;
      if (vadInFlightRef.current) return;
      vadInFlightRef.current = true;
      setVadTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await fetch('/api/audio/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || 'audio/webm',
            prompt:
              'Transcribe the spoken words accurately in plain text without commentary. If the clip contains only silence or noise, return an empty string.'
          })
        });
        const data = await res.json().catch(() => ({}));
        const transcript = String(data?.transcription || '').trim();
        if (transcript && sttHandledAtRef.current < utteranceStartedAt - 300) {
          sendRelayUtterance(transcript);
        }
      } catch (err) {
        console.warn('[PersistentTalkDock] Direct mic VAD transcribe notice:', err);
      } finally {
        vadInFlightRef.current = false;
        setVadTranscribing(false);
      }
    },
    [sendRelayUtterance]
  );

  const beginVadUtteranceCapture = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') return;

    try {
      const mimeType = pickBestRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      vadChunksRef.current = [];
      const startedAt = Date.now();
      vadSpeechStartRef.current = startedAt;
      vadLastVoiceRef.current = startedAt;
      vadRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          vadChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const chunks = vadChunksRef.current;
        vadChunksRef.current = [];
        vadRecorderRef.current = null;
        setVadRecording(false);
        const durationMs = Date.now() - startedAt;
        if (chunks.length === 0 || durationMs < 260) return;
        const resolvedMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: resolvedMime });
        // Give browser STT 180ms grace to emit its final result before sending to /api/audio/transcribe
        setTimeout(() => {
          transcribeVadBlobAndSend(blob, resolvedMime, startedAt);
        }, 180);
      };

      recorder.start(250);
      setVadRecording(true);
    } catch {
      vadRecorderRef.current = null;
      setVadRecording(false);
    }
  }, [transcribeVadBlobAndSend]);

  const startContinuousRecognition = useCallback(() => {
    if (typeof window === 'undefined' || isMutedRef.current) return;
    if (captureModeRef.current === 'vad') return;
    // If user explicitly picked a non-default hardware mic, rely on Direct Mic VAD so their chosen mic is used
    if (selectedMicIdRef.current && selectedMicIdRef.current !== 'default') return;
    if (sttBrokenRef.current && captureModeRef.current !== 'browser-stt') return;

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      sttBrokenRef.current = true;
      return;
    }
    if (recognitionRef.current) return;

    try {
      const rec = new SpeechRecognitionCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = voiceAccentRef.current;
      recognitionRef.current = rec;

      rec.onresult = (event: any) => {
        sttBrokenRef.current = false;
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalText += ` ${text}`;
          } else {
            interim += ` ${text}`;
          }
        }
        // Natural barge-in when user speaks clearly
        if ((interim.trim().length > 3 || finalText.trim().length > 1) && isModelSpeakingRef.current) {
          flushPlaybackQueue();
        }
        setInterimSpeech(interim.trim());
        if (finalText.trim()) {
          sttHandledAtRef.current = Date.now();
          stopActiveVadRecorder(true);
          setInterimSpeech('');
          sendRelayUtterance(finalText.trim());
        }
      };

      rec.onerror = (ev: any) => {
        const code = String(ev?.error || '');
        // If browser STT is blocked by iframe/network/audio-capture, fall back seamlessly to Direct Mic VAD
        if (
          code === 'not-allowed' ||
          code === 'service-not-allowed' ||
          code === 'audio-capture' ||
          code === 'network'
        ) {
          sttBrokenRef.current = true;
          recognitionRef.current = null;
        }
      };

      rec.onend = () => {
        recognitionRef.current = null;
        if (
          isConnectedRef.current &&
          relayModeRef.current &&
          !isMutedRef.current &&
          captureModeRef.current !== 'vad' &&
          !sttBrokenRef.current
        ) {
          setTimeout(() => {
            if (
              isConnectedRef.current &&
              relayModeRef.current &&
              !isMutedRef.current &&
              captureModeRef.current !== 'vad' &&
              !sttBrokenRef.current
            ) {
              startContinuousRecognition();
            }
          }, 300);
        }
      };

      rec.start();
    } catch {
      sttBrokenRef.current = true;
      recognitionRef.current = null;
    }
  }, [flushPlaybackQueue, sendRelayUtterance, stopActiveVadRecorder]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      stopContinuousRecognition();
      stopActiveVadRecorder(true);
      setMicLevel(0);
    } else if (isConnectedRef.current && relayModeRef.current) {
      startContinuousRecognition();
    }
  }, [isMuted, startContinuousRecognition, stopContinuousRecognition, stopActiveVadRecorder]);

  const stopMeterLoop = useCallback(() => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
  }, []);

  const teardownSession = useCallback(() => {
    isConnectedRef.current = false;
    relayModeRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setInteractionStatus('IDLE');
    setActiveToolName(null);
    setMicLevel(0);
    setInterimSpeech('');
    setVadRecording(false);
    setVadTranscribing(false);

    stopMeterLoop();
    stopContinuousRecognition();
    stopActiveVadRecorder(true);
    flushPlaybackQueue();

    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    try {
      sourceNodeRef.current?.disconnect();
    } catch {}
    sourceNodeRef.current = null;
    try {
      silentGainRef.current?.disconnect();
    } catch {}
    silentGainRef.current = null;
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      inputCtxRef.current?.close();
    } catch {}
    inputCtxRef.current = null;

    try {
      outputCtxRef.current?.close();
    } catch {}
    outputCtxRef.current = null;

    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
  }, [flushPlaybackQueue, stopActiveVadRecorder, stopContinuousRecognition, stopMeterLoop]);

  const acquireMicrophoneStream = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unavailable');
      setMicLabel('');
      setErrorMessage('Browser microphone API unavailable in this context. Use text input below or open in Chrome/Edge.');
      return null;
    }

    setMicStatus('requesting');
    const chosenId = selectedMicIdRef.current;

    const attempts: MediaStreamConstraints[] = [];
    if (chosenId && chosenId !== 'default') {
      attempts.push({
        audio: {
          deviceId: { exact: chosenId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      attempts.push({ audio: { deviceId: { ideal: chosenId } } });
    }
    attempts.push({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    attempts.push({ audio: true });

    let lastErr: any = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          setMicLabel(audioTrack.label || 'Device Microphone');
        }
        setMicStatus('active');
        setErrorMessage(null);
        refreshMicDevices();
        return stream;
      } catch (err: any) {
        lastErr = err;
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    const errName = String(lastErr?.name || '');
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      setMicStatus('denied');
      setErrorMessage('Microphone permission blocked — allow microphone access in your browser bar, then click Retry Mic.');
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      setMicStatus('unavailable');
      setErrorMessage('No device microphone detected — plug in or select a mic, then click Retry Mic.');
    } else {
      setMicStatus('unavailable');
      setErrorMessage(`Microphone notice: ${lastErr?.message || 'Unable to capture audio input.'}`);
    }
    return null;
  }, [refreshMicDevices]);

  const startAnalyserAndVadLoop = useCallback(
    (stream: MediaStream, inputCtx: AudioContext) => {
      stopMeterLoop();
      const source = inputCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Keep ScriptProcessor ONLY for native Gemini Live 16kHz PCM streaming (zero noise gate, continuous full-duplex!)
      try {
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        const silentGain = inputCtx.createGain();
        silentGain.gain.value = 0;
        silentGainRef.current = silentGain;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(inputCtx.destination);

        processor.onaudioprocess = (ev) => {
          if (!isConnectedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
          if (isMutedRef.current || relayModeRef.current) return;
          const channel = ev.inputBuffer.getChannelData(0);
          const base64 = pcmFloatToBase64(channel, inputCtx.sampleRate || 16000);
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        };
      } catch {
        processorRef.current = null;
      }

      const timeBuf = new Float32Array(analyser.fftSize);
      const VAD_SILENCE_MS = 850;
      const VAD_MAX_UTTERANCE_MS = 14000;
      noiseFloorRef.current = 0.006;
      vadAboveCountRef.current = 0;

      let frameTick = 0;
      let lastReportedLevel = -1;
      const tick = () => {
        if (!analyserRef.current) return;
        meterRafRef.current = requestAnimationFrame(tick);

        if (inputCtx.state === 'suspended') {
          inputCtx.resume().catch(() => {});
        }

        if (isMutedRef.current) {
          if (lastReportedLevel !== 0) {
            lastReportedLevel = 0;
            setMicLevel(0);
          }
          return;
        }

        analyser.getFloatTimeDomainData(timeBuf);
        let sumSq = 0;
        for (let i = 0; i < timeBuf.length; i += 2) {
          sumSq += timeBuf[i] * timeBuf[i];
        }
        const rms = Math.sqrt(sumSq / (timeBuf.length / 2));

        if (frameTick++ % 8 === 0) {
          const nextLevel = Math.round(Math.min(1, rms * 10) * 20) / 20;
          if (Math.abs(nextLevel - lastReportedLevel) >= 0.05) {
            lastReportedLevel = nextLevel;
            setMicLevel(nextLevel);
          }
        }

        // Direct hardware microphone Adaptive Noise-Floor VAD (only used in sovereign-duplex-relay fallback;
        // native gemini-live-pcm streams 100% raw 16kHz PCM continuously with zero client noise gate!)
        if (!isConnectedRef.current || !relayModeRef.current) return;
        if (captureModeRef.current === 'browser-stt') return;

        const now = Date.now();
        const isRec = Boolean(vadRecorderRef.current && vadRecorderRef.current.state === 'recording');

        // Adapt ambient noise floor continuously when idle (or slowly down if quieter) so room fan/hum NEVER traps the gate
        if (!isRec) {
          const alpha = rms < noiseFloorRef.current ? 0.12 : 0.03;
          noiseFloorRef.current = Math.max(0.002, Math.min(0.06, noiseFloorRef.current * (1 - alpha) + rms * alpha));
        } else if (rms < noiseFloorRef.current) {
          noiseFloorRef.current = noiseFloorRef.current * 0.96 + rms * 0.04;
        }

        const speaking = isModelSpeakingRef.current;
        const startThreshold = speaking
          ? Math.max(0.032, noiseFloorRef.current * 3.0 + 0.015)
          : Math.max(0.011, noiseFloorRef.current * 2.1 + 0.006);
        const holdThreshold = Math.max(0.007, noiseFloorRef.current * 1.45 + 0.003);

        if (!isRec) {
          if (rms >= startThreshold) {
            vadAboveCountRef.current += 1;
            if (vadAboveCountRef.current >= 3) {
              vadAboveCountRef.current = 0;
              if (speaking) {
                flushPlaybackQueue();
              }
              vadLastVoiceRef.current = now;
              beginVadUtteranceCapture();
            }
          } else {
            vadAboveCountRef.current = 0;
          }
        } else {
          if (rms >= holdThreshold) {
            vadLastVoiceRef.current = now;
          }
          const silentFor = now - vadLastVoiceRef.current;
          const totalFor = now - vadSpeechStartRef.current;
          if (silentFor >= VAD_SILENCE_MS || totalFor >= VAD_MAX_UTTERANCE_MS) {
            try {
              vadRecorderRef.current?.stop();
            } catch {}
          }
        }
      };

      meterRafRef.current = requestAnimationFrame(tick);
    },
    [beginVadUtteranceCapture, flushPlaybackQueue, stopMeterLoop]
  );

  const connectSession = useCallback(async () => {
    if (isConnectedRef.current) return;
    setErrorMessage(null);
    setIsConnecting(true);
    sttBrokenRef.current = false;

    try {
      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;

      // Create output AudioContext BEFORE awaiting getUserMedia so it captures browser user-activation cleanly
      let outputCtx: AudioContext | null = null;
      if (AudioCtxCtor) {
        try {
          outputCtx = new AudioCtxCtor({ sampleRate: 24000 });
        } catch {
          outputCtx = new AudioCtxCtor();
        }
        if (outputCtx.state === 'suspended') {
          outputCtx.resume().catch(() => {});
        }
      }
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx ? outputCtx.currentTime : 0;

      const micStream = await acquireMicrophoneStream();
      streamRef.current = micStream;

      let inputCtx: AudioContext | null = null;
      if (micStream && AudioCtxCtor) {
        try {
          inputCtx = new AudioCtxCtor();
          if (inputCtx.state === 'suspended') {
            await inputCtx.resume().catch(() => {});
          }
        } catch {
          inputCtx = null;
        }
      }

      inputCtxRef.current = inputCtx;
      if (outputCtx && outputCtx.state === 'suspended') {
        outputCtx.resume().catch(() => {});
      }

      if (micStream && inputCtx) {
        startAnalyserAndVadLoop(micStream, inputCtx);
      }

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${location.host}/live?voice=${encodeURIComponent(voiceNameRef.current)}&accent=${encodeURIComponent(voiceAccentRef.current)}&mode=autonomous&peer=1&proactive=${peerExploreRef.current ? '1' : '0'}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let lastSpokenReply = '';

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.ready) {
            const isRelay = msg.transport === 'sovereign-duplex-relay';
            relayModeRef.current = isRelay;
            setTransportMode(isRelay ? 'sovereign-duplex-relay' : 'gemini-live-pcm');
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);

            if (isRelay && !isMutedRef.current) {
              startContinuousRecognition();
            }

            const activeMeta = ALL_MODULES.find((m) => m.id === activeModuleRef.current);
            ws.send(
              JSON.stringify({
                workspaceContext: {
                  activeModule: activeModuleRef.current,
                  activeLabel: activeMeta?.label || activeModuleRef.current,
                  openModules: openModulesRef.current,
                  proactive: peerExploreRef.current,
                  initial: true
                }
              })
            );
            lastModuleSentRef.current = activeModuleRef.current;
            return;
          }

          if (msg.transportSwitch === 'sovereign-duplex-relay') {
            relayModeRef.current = true;
            setTransportMode('sovereign-duplex-relay');
            if (!isMutedRef.current) {
              startContinuousRecognition();
            }
            return;
          }

          if (msg.audio) {
            schedulePcmPlayback(msg.audio);
          }
          if (msg.audioUrl) {
            playNeuralAudioUrl(String(msg.audioUrl), lastSpokenReply, msg.speakOnlyId);
          }
          if (msg.speakOnlyFallback?.text) {
            speakBrowserFallback(String(msg.speakOnlyFallback.text), msg.speakOnlyFallback.id);
          }
          if (msg.thought) {
            appendTranscript('thought', msg.thought);
          }
          if (msg.inputTranscript) {
            appendTranscript('user', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            lastSpokenReply = String(msg.outputTranscript);
            appendTranscript('model', msg.outputTranscript);
          }
          if (msg.text) {
            lastSpokenReply = String(msg.text);
            appendTranscript('model', msg.text);
          }
          if (msg.interrupted) {
            flushPlaybackQueue();
          }
          if (msg.interactionStatus) {
            setInteractionStatus(msg.interactionStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'IDLE');
          }
          if (msg.toolEvent) {
            if (msg.toolEvent.status === 'RUNNING') {
              setActiveToolName(msg.toolEvent.name);
              const argPreview = Object.entries(msg.toolEvent.args || {})
                .slice(0, 2)
                .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 48) : JSON.stringify(v).slice(0, 48)}`)
                .join(', ');
              appendTranscript(
                'tool',
                `Running ${msg.toolEvent.name.replace(/_/g, ' ')}${argPreview ? ` (${argPreview})` : ''}`
              );
            } else {
              setActiveToolName(null);
              if (msg.toolEvent.summary) {
                appendTranscript(
                  'tool',
                  `${msg.toolEvent.success === false ? 'Failed' : 'Done'} · ${msg.toolEvent.name.replace(/_/g, ' ')}: ${String(msg.toolEvent.summary).slice(0, 140)}`
                );
              }
            }
          }
          if (msg.osCommand && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sovereign_os_command', { detail: msg.osCommand }));
          }
          if (msg.navigateModule) {
            onSelectModule(msg.navigateModule as ModuleType);
          }
          if (msg.openBrowserUrl && onNavigateBrowserUrl) {
            onNavigateBrowserUrl(String(msg.openBrowserUrl));
          }
          if (msg.spatialCommand && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aurelius_spatial_command', { detail: msg.spatialCommand }));
          }
        } catch (err) {
          console.warn('[PersistentTalkDock] WS parse note:', err);
        }
      };

      ws.onerror = () => {
        setErrorMessage('Voice channel interrupted — click Reconnect to resume.');
        teardownSession();
      };

      ws.onclose = () => {
        if (isConnectedRef.current) {
          teardownSession();
        } else {
          setIsConnecting(false);
        }
      };
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to initialize audio hardware.');
      teardownSession();
    }
  }, [
    acquireMicrophoneStream,
    startAnalyserAndVadLoop,
    onSelectModule,
    onNavigateBrowserUrl,
    appendTranscript,
    schedulePcmPlayback,
    playNeuralAudioUrl,
    speakBrowserFallback,
    startContinuousRecognition,
    flushPlaybackQueue,
    teardownSession
  ]);

  const handleRetryMicrophone = async () => {
    stopMeterLoop();
    stopActiveVadRecorder(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const micStream = await acquireMicrophoneStream();
    if (!micStream) return;
    streamRef.current = micStream;

    const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxCtor) {
      try {
        inputCtxRef.current?.close();
      } catch {}
      const inputCtx = new AudioCtxCtor();
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume().catch(() => {});
      }
      inputCtxRef.current = inputCtx;
      startAnalyserAndVadLoop(micStream, inputCtx);
    }

    if (isConnectedRef.current && relayModeRef.current && !isMutedRef.current) {
      stopContinuousRecognition();
      sttBrokenRef.current = false;
      startContinuousRecognition();
    }
  };

  // Unified Read-Aloud / Speak-Text listener so ALL TTS actions across Chat use ONE single voice engine
  useEffect(() => {
    const onSpeakRequest = async (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail) return;
      const reqId = String(detail.id || 'msg');
      if (detail.stop || (speakingMessageIdRef.current && speakingMessageIdRef.current === reqId)) {
        flushPlaybackQueue();
        return;
      }
      const clean = cleanTextForSpeech(String(detail.text || ''));
      if (!clean) return;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            speakOnly: { id: reqId, text: clean, voice: voiceNameRef.current, accent: voiceAccentRef.current }
          })
        );
        return;
      }
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean.slice(0, 1400), voice: voiceNameRef.current, accent: voiceAccentRef.current })
        });
        const data = await res.json();
        if (res.ok && data?.audioUrl) {
          playNeuralAudioUrl(data.audioUrl, clean, reqId);
        } else {
          speakBrowserFallback(clean, reqId);
        }
      } catch {
        speakBrowserFallback(clean, reqId);
      }
    };

    const onControl = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.action === 'mute') setIsMuted((m) => (typeof detail.value === 'boolean' ? detail.value : !m));
      if (detail.action === 'speakerMute') setSpeakerMuted((s) => (typeof detail.value === 'boolean' ? detail.value : !s));
      if (detail.action === 'voice' && VOICE_OPTIONS.some((v) => v.id === detail.voice)) {
        setVoiceName(detail.voice);
        try {
          localStorage.setItem('sovereign_persistent_talk_voice_v1', detail.voice);
        } catch {}
      }
      if (detail.action === 'expand') setExpanded(typeof detail.value === 'boolean' ? detail.value : true);
      if (detail.action === 'archive') archiveSessionToVault();
      if (detail.action === 'nudge' && typeof detail.text === 'string' && detail.text.trim()) {
        sendRelayUtterance(detail.text.trim());
      }
      if (detail.action === 'query') {
        window.dispatchEvent(
          new CustomEvent('sovereign_persistent_talk_state', {
            detail: {
              active: isActive,
              connected: isConnectedRef.current,
              connecting: isConnecting,
              muted: isMutedRef.current,
              speakerMuted: speakerMutedRef.current,
              speaking: isModelSpeakingRef.current,
              transport: transportMode,
              voiceName: voiceNameRef.current,
              micStatus,
              micLabel,
              captureMode: captureModeRef.current,
              activeToolName,
              autoArchiveVault,
              peerExploreEnabled: peerExploreRef.current,
              transcripts: transcriptsRef.current
            }
          })
        );
      }
    };

    window.addEventListener('sovereign_voice_speak_text', onSpeakRequest);
    window.addEventListener('sovereign_persistent_talk_control', onControl);
    return () => {
      window.removeEventListener('sovereign_voice_speak_text', onSpeakRequest);
      window.removeEventListener('sovereign_persistent_talk_control', onControl);
    };
  }, [
    isActive,
    isConnecting,
    transportMode,
    micStatus,
    micLabel,
    activeToolName,
    autoArchiveVault,
    flushPlaybackQueue,
    playNeuralAudioUrl,
    speakBrowserFallback,
    archiveSessionToVault,
    sendRelayUtterance
  ]);

  // Connect automatically when toggled active; teardown when deactivated
  useEffect(() => {
    if (isActive) {
      liveSessionIdRef.current = `live-${Date.now()}`;
      connectSession();
    } else {
      teardownSession();
    }
    return () => {
      teardownSession();
    };
  }, [isActive, voiceName, voiceAccent]);

  // Keep Web Audio input & output contexts unlocked on any user interaction in Chrome/iframes
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    const unlockAudioContexts = () => {
      if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
        inputCtxRef.current.resume().catch(() => {});
      }
      if (outputCtxRef.current && outputCtxRef.current.state === 'suspended') {
        outputCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudioContexts, { passive: true });
    window.addEventListener('keydown', unlockAudioContexts, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioContexts);
      window.removeEventListener('keydown', unlockAudioContexts);
    };
  }, [isActive]);

  // Switch microphone immediately when user picks a different device while active
  const prevMicIdRef = useRef<string>(selectedMicId);
  useEffect(() => {
    if (prevMicIdRef.current !== selectedMicId) {
      prevMicIdRef.current = selectedMicId;
      if (isActive) {
        handleRetryMicrophone();
      }
    }
  }, [selectedMicId, isActive]);

  // Apply capture mode change live
  useEffect(() => {
    if (!isConnectedRef.current || !relayModeRef.current || isMutedRef.current) return;
    if (captureMode === 'vad') {
      stopContinuousRecognition();
    } else {
      sttBrokenRef.current = false;
      startContinuousRecognition();
    }
  }, [captureMode, startContinuousRecognition, stopContinuousRecognition]);

  // Stream lightweight workspace context when user switches active windows during hands-free talk
  useEffect(() => {
    if (!isConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (lastModuleSentRef.current === activeModule) return;
    lastModuleSentRef.current = activeModule;

    const timer = setTimeout(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const activeMeta = ALL_MODULES.find((m) => m.id === activeModule);
      wsRef.current.send(
        JSON.stringify({
          workspaceContext: {
            activeModule,
            activeLabel: activeMeta?.label || activeModule,
            openModules,
            proactive: peerExploreRef.current
          }
        })
      );
    }, 900);

    return () => clearTimeout(timer);
  }, [activeModule, openModules, isConnected]);

  const handleEndTalk = () => {
    if (autoArchiveVault && transcriptsRef.current.length > 0) {
      archiveSessionToVault(transcriptsRef.current);
    }
    onDeactivate();
  };

  const triggerPeerExploration = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const activeMeta = ALL_MODULES.find((m) => m.id === activeModule);
    const cue = `I'm actively working in ${activeMeta?.label || activeModule} (open windows: ${openModules.join(', ')}). Inspect what's relevant in the workspace and share a quick, natural peer suggestion.`;
    if (relayModeRef.current) {
      sendRelayUtterance(cue);
    } else {
      wsRef.current.send(JSON.stringify({ text: `[PEER EXPLORATION CUE] ${cue}` }));
      appendTranscript('tool', `Peer exploring context around ${activeMeta?.label || activeModule}...`);
    }
  };

  const handleSendNudge = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickNudge.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (relayModeRef.current) {
      sendRelayUtterance(trimmed);
    } else {
      wsRef.current.send(JSON.stringify({ text: trimmed }));
      appendTranscript('user', trimmed);
    }
    setQuickNudge('');
  };

  const handleManualFinishUtterance = () => {
    if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') {
      try {
        vadRecorderRef.current.stop();
      } catch {}
    } else if (streamRef.current && !isMutedRef.current) {
      beginVadUtteranceCapture();
    }
  };

  const startDockDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, select, input')) return;
    e.preventDefault();
    const rect = dockElRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragDockRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top
    };

    const onMove = (ev: PointerEvent) => {
      const s = dragDockRef.current;
      if (!s) return;
      const w = dockElRef.current?.offsetWidth || 340;
      const h = dockElRef.current?.offsetHeight || 56;
      const nx = Math.max(8, Math.min(window.innerWidth - w - 8, s.origX + (ev.clientX - s.startX)));
      const ny = Math.max(40, Math.min(window.innerHeight - h - 52, s.origY + (ev.clientY - s.startY)));
      setDockPos({ x: Math.round(nx), y: Math.round(ny) });
    };

    const onUp = () => {
      dragDockRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  if (!isActive) return null;

  const latestLine = transcripts[transcripts.length - 1];
  const barHeights = [0.45, 0.85, 1, 0.72, 0.5].map((scale) =>
    isMuted || micStatus === 'denied' || micStatus === 'unavailable'
      ? 3
      : isModelSpeaking
      ? Math.max(5, Math.round(6 + scale * 12))
      : Math.max(3, Math.round(3 + micLevel * scale * 18))
  );

  const micBlocked = micStatus === 'denied' || micStatus === 'unavailable';

  return (
    <div
      ref={dockElRef}
      style={
        dockPos
          ? { left: dockPos.x, top: dockPos.y, bottom: 'auto', right: 'auto' }
          : undefined
      }
      className={`fixed z-50 w-[405px] max-w-[calc(100vw-1.25rem)] rounded-2xl bg-zinc-950/95 border shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-colors ${
        !dockPos ? 'bottom-14 left-3 sm:left-4' : ''
      } ${
        micBlocked
          ? 'border-amber-500/70'
          : isModelSpeaking
          ? 'border-sky-400/70'
          : vadRecording
          ? 'border-emerald-300/80'
          : isConnected
          ? 'border-emerald-500/55'
          : 'border-zinc-700'
      }`}
    >
      {/* Compact Always-Accessible Hands-Free Control Bar (Draggable) */}
      <div
        onPointerDown={startDockDrag}
        className="px-3 py-2 flex items-center justify-between gap-2 select-none cursor-grab active:cursor-grabbing"
        title="Drag to reposition Persistent Voice Chat Dock anywhere on your desktop"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <GripHorizontal className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden="true" />

          {/* Live Compact Acoustic Level Bars */}
          <div className="flex items-center gap-0.5 h-5 w-6 justify-center shrink-0" aria-hidden="true">
            {barHeights.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className={`w-[3px] rounded-full transition-all duration-75 ${
                  isMuted || micBlocked
                    ? 'bg-zinc-600'
                    : isModelSpeaking
                    ? 'bg-sky-400'
                    : vadRecording
                    ? 'bg-emerald-300'
                    : isConnected
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
              />
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100 leading-tight">
              <span className="truncate">
                {isConnecting
                  ? 'Connecting Voice Chat...'
                  : !isConnected
                  ? 'Voice Chat Paused'
                  : activeToolName
                  ? `Autonomy: ${activeToolName.replace(/_/g, ' ')}`
                  : isModelSpeaking
                  ? `${voiceName} Speaking`
                  : vadTranscribing
                  ? 'Transcribing Voice...'
                  : vadRecording
                  ? 'Listening (Voice Detected)...'
                  : isMuted
                  ? 'Mic Muted · Listening Paused'
                  : micBlocked
                  ? 'Mic Permission Needed'
                  : `Voice Chat · ${voiceName}`}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
              {interimSpeech
                ? `Hearing: "${interimSpeech}"`
                : isConnected
                ? micBlocked
                  ? 'Click Enable Mic or select your audio input'
                  : isModelSpeaking
                  ? 'Speak anytime to interrupt naturally'
                  : interactionStatus === 'IN_PROGRESS'
                  ? 'Thinking & executing autonomously...'
                  : vadTranscribing
                  ? 'Converting device mic audio to turn...'
                  : micLabel
                  ? `Mic: ${micLabel}`
                  : transportMode === 'sovereign-duplex-relay'
                  ? 'Hands-free Sovereign Voice · Full Autonomy'
                  : 'Hands-free Live Audio · Full Autonomy'
                : errorMessage || 'Unified Persistent Voice Chat'}
            </div>
          </div>
        </div>

        {/* Well-Spaced Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {micBlocked ? (
            <button
              type="button"
              onClick={handleRetryMicrophone}
              className="h-8 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
              title="Request device microphone permission and bind audio input"
            >
              <Mic className="w-3 h-3" />
              <span>Enable Mic</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              disabled={!isConnected}
              className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : vadRecording
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-emerald-300'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSpeakerMuted((s) => !s)}
            disabled={!isConnected}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
              speakerMuted
                ? 'bg-zinc-800 border-zinc-600 text-zinc-400'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-sky-300'
            }`}
            title={speakerMuted ? 'Unmute Voice Output' : 'Mute Voice Output'}
            aria-label={speakerMuted ? 'Unmute Voice Output' : 'Mute Voice Output'}
          >
            {speakerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
            title={expanded ? 'Collapse Transcript & Mic Controls' : 'Expand Transcript, Mic Selector & Options'}
            aria-label={expanded ? 'Collapse Talk Drawer' : 'Expand Talk Drawer'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <div className="h-5 w-px bg-zinc-700/80 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={handleEndTalk}
            className="h-8 w-8 rounded-lg bg-rose-950/60 hover:bg-rose-600 border border-rose-500/45 text-rose-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="End Voice Chat (Auto-Archives Transcript + CoT to Vault)"
            aria-label="End Voice Chat"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtle Single-Line Live Caption When Collapsed */}
      {!expanded && latestLine && (
        <div className="px-3 pb-2 pt-0.5 border-t border-zinc-800/70 text-[11px] text-zinc-300 truncate flex items-center gap-1.5">
          <span
            className={`font-mono text-[10px] font-semibold shrink-0 ${
              latestLine.role === 'user'
                ? 'text-zinc-400'
                : latestLine.role === 'thought'
                ? 'text-cyan-400'
                : latestLine.role === 'tool'
                ? 'text-sky-400'
                : 'text-emerald-400'
            }`}
          >
            {latestLine.role === 'user'
              ? 'You:'
              : latestLine.role === 'thought'
              ? 'CoT:'
              : latestLine.role === 'tool'
              ? 'Tool:'
              : `${voiceName}:`}
          </span>
          <span className="truncate">{latestLine.text}</span>
        </div>
      )}

      {/* Recovery / Mic Permission Strip */}
      {errorMessage && (
        <div className="px-3 py-2 border-t border-amber-500/30 bg-amber-950/35 flex items-center justify-between gap-2 text-[11px] text-amber-200">
          <span className="truncate">{errorMessage}</span>
          <button
            type="button"
            onClick={micBlocked ? handleRetryMicrophone : connectSession}
            className="px-2 py-1 rounded bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-100 font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{micBlocked ? 'Retry Mic' : 'Reconnect'}</span>
          </button>
        </div>
      )}

      {/* Expandable Live Peer Drawer */}
      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2.5 text-xs">
          {/* Device Microphone Picker & Capture Mode */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-zinc-800/70">
            <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              aria-label="Select Device Microphone"
              className="flex-1 min-w-[140px] bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="">System Default Microphone</option>
              {micDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as MicCaptureMode)}
              aria-label="Voice Capture Engine"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              title="Auto Hybrid combines instant browser STT with Direct Hardware Mic VAD transcription"
            >
              <option value="hybrid">Auto Hybrid Mic</option>
              <option value="vad">Direct Mic (VAD)</option>
              <option value="browser-stt">Browser STT Only</option>
            </select>

            <button
              type="button"
              onClick={handleManualFinishUtterance}
              disabled={!isConnected || isMuted || micBlocked}
              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer disabled:opacity-40 ${
                vadRecording
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
              }`}
              title={vadRecording ? 'Finish & send spoken clip now' : 'Start manual voice clip capture'}
            >
              {vadRecording ? 'Send Clip' : 'Tap Talk'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={voiceName}
                onChange={(e) => {
                  const nextVoice = e.target.value as LiveVoicePersona;
                  setVoiceName(nextVoice);
                  try {
                    localStorage.setItem('sovereign_persistent_talk_voice_v1', nextVoice);
                  } catch {}
                }}
                aria-label="Voice Persona"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} · {v.style}
                  </option>
                ))}
              </select>

              <select
                value={voiceAccent}
                onChange={(e) => setVoiceAccent(e.target.value as NativeEnglishAccent)}
                aria-label="Native English Accent"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-emerald-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                title="Lock voice strictly to clear Native American or Native British English"
              >
                <option value="en-US">US English</option>
                <option value="en-GB">British English</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPeerExploreEnabled((v) => !v)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  peerExploreEnabled
                    ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
                title="Allow autonomous workspace exploration while talking"
              >
                <Compass className="w-3 h-3" />
                <span>Explore: {peerExploreEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoArchiveVault((v) => !v)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                  autoArchiveVault
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
                title="Automatically archive full voice transcript + Chain-of-Thought to Memory Vault on end"
              >
                Auto-Vault: {autoArchiveVault ? 'ON' : 'OFF'}
              </button>

              {onSaveToVault && (
                <button
                  type="button"
                  onClick={() => archiveSessionToVault()}
                  disabled={transcripts.length === 0}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-cyan-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Save conversation + Chain-of-Thought directly to Persistent Memory Vault"
                >
                  {vaultSavedFlash ? <Check className="w-3 h-3 text-emerald-400" /> : <BookmarkPlus className="w-3 h-3" />}
                  <span>{vaultSavedFlash ? 'Saved' : 'Vault'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={triggerPeerExploration}
                disabled={!isConnected}
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-amber-300 cursor-pointer disabled:opacity-40"
                title="Have the orchestrator inspect your current window right now"
              >
                Check View
              </button>
            </div>
          </div>

          {/* Live Transcript + Chain-of-Thought Stream (Synced to Chat & Memory Vault) */}
          <div className="h-44 overflow-y-auto rounded-xl bg-zinc-900/80 border border-zinc-800 p-2.5 space-y-2">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-[11px] text-zinc-500 px-3">
                {transportMode === 'gemini-live-pcm'
                  ? 'Full-duplex Live Audio active — talk freely with zero noise gate, interrupt naturally anytime, and live turns + Chain-of-Thought mirror directly into Chat and Memory Vault.'
                  : 'Hands-free Sovereign Voice active — speak naturally (Auto Hybrid STT + Direct Mic VAD) and live turns + Chain-of-Thought mirror into Chat and Memory Vault.'}
              </div>
            ) : (
              transcripts.map((item) => (
                <div
                  key={item.id}
                  className={`p-2 rounded-lg text-[11px] leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-zinc-800/80 text-zinc-100'
                      : item.role === 'thought'
                      ? 'bg-cyan-950/35 border border-cyan-500/30 text-cyan-200 font-mono text-[10px]'
                      : item.role === 'tool'
                      ? 'bg-sky-950/35 border border-sky-500/25 text-sky-300 font-mono text-[10px]'
                      : 'bg-emerald-950/25 border border-emerald-500/20 text-emerald-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                    <span className="flex items-center gap-1 font-semibold">
                      {item.role === 'thought' && <Brain className="w-2.5 h-2.5 text-cyan-400" />}
                      {item.role === 'tool' && <Wrench className="w-2.5 h-2.5 text-sky-400" />}
                      {item.role === 'user'
                        ? 'You'
                        : item.role === 'thought'
                        ? `${voiceName} · Chain-of-Thought`
                        : item.role === 'tool'
                        ? 'Autonomous Tool'
                        : voiceName}
                    </span>
                    <span className="tabular-nums">{item.timestamp}</span>
                  </div>
                  <div>{item.text}</div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Optional Text Input Into Voice Stream */}
          <form onSubmit={handleSendNudge} className="flex items-center gap-1.5">
            <input
              type="text"
              value={quickNudge}
              onChange={(e) => setQuickNudge(e.target.value)}
              disabled={!isConnected}
              placeholder="Optional: type or paste into the live voice conversation..."
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-sky-500/60 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!isConnected || !quickNudge.trim()}
              className="h-7 w-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center disabled:opacity-40 cursor-pointer"
              title="Send message into live voice conversation"
              aria-label="Send message into voice chat"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
