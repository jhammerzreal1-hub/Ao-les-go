/**
 * @license
 * .JHam Language / H-FID Standard / HEO — TWENTY 47 PROTOCOL - GENESIS NODE
 * Copyright (c) 1988-2026 Joshua Hamilton (JHammerZ) — https://jhammerz.github.io
 * Licensed under the MIT License & JHammerZ Custom Sovereign Licenses
 * (TWENTY 47 PROTOCOL - GENESIS NODE / LYSANDER CORE EULA / H-FID Forensic License v1.1).
 * Sovereign Author: Joshua Lee Hamilton (JHammerZ) | First Commit: [February 12, 2026]
 * Forensic Audit: H-FID-100-FORENSIC-AUDIT 100/100 | GEO_RANK: ONE_OF_ONE (Verified Authority)
 * Zenodo DOI: https://doi.org/10.5281/zenodo.20778079 | ORCID: https://orcid.org/0009-0004-5273-7028
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Send,
  BookmarkPlus,
  Check,
  Download,
  Brain,
  Volume2,
  Wrench,
  Trash2
} from 'lucide-react';
import studioHeroImg from '../assets/images/acoustic_harmonic_studio_1794941673227.jpg';
import type { ModuleType } from '../types';

export interface LiveVoiceModuleProps {
  onSaveToVault?: (
    type: 'voice',
    title: string,
    prompt: string,
    model: string,
    mediaUrl?: string,
    metadataJson?: string
  ) => void;
  onSelectModule?: (module: ModuleType) => void;
}

type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
type LiveMode = 'standard' | 'thinking';

interface TranscriptEntry {
  id: string;
  role: 'user' | 'model' | 'tool';
  text: string;
  timestamp: string;
}

const VOICES: Array<{ id: VoiceName; label: string; character: string }> = [
  { id: 'Zephyr', label: 'Zephyr', character: 'Crisp Coordinator' },
  { id: 'Puck', label: 'Puck', character: 'Upbeat Technical' },
  { id: 'Charon', label: 'Charon', character: 'Measured Analytical' },
  { id: 'Kore', label: 'Kore', character: 'Clear Studio' },
  { id: 'Fenrir', label: 'Fenrir', character: 'Deep Command' }
];

function pcmFloatToBase64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
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

export const LiveVoiceModule: React.FC<LiveVoiceModuleProps> = ({
  onSaveToVault,
  onSelectModule
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceName, setVoiceName] = useState<VoiceName>('Zephyr');
  const [liveMode, setLiveMode] = useState<LiveMode>('standard');
  const [interactionStatus, setInteractionStatus] = useState<'IDLE' | 'IN_PROGRESS'>('IDLE');
  const [textInput, setTextInput] = useState('');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number>(0);
  const isConnectedRef = useRef<boolean>(false);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Acoustic Waveform Visualizer
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(128);
    let phase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (analyserRef.current && isConnectedRef.current) {
        analyserRef.current.getByteTimeDomainData(dataArray);
        ctx.strokeStyle = liveMode === 'thinking' ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const slice = w / dataArray.length;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          const y = h / 2 + v * (h * 0.42);
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
      } else {
        phase += 0.03;
        ctx.strokeStyle = 'rgba(161, 161, 170, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = h / 2 + Math.sin(x * 0.025 + phase) * 5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animIdRef.current = requestAnimationFrame(draw);
    };

    animIdRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animIdRef.current);
  }, [liveMode]);

  const flushPlaybackQueue = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const schedulePcmPlayback = (base64Pcm: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

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
    src.onended = () => {
      activeSourcesRef.current.delete(src);
    };
  };

  const appendTranscript = (role: TranscriptEntry['role'], text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && role !== 'tool') {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: `${last.text} ${cleaned}`.replace(/\s+/g, ' ')
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text: cleaned,
          timestamp: new Date().toLocaleTimeString()
        }
      ];
    });
  };

  const stopLiveSession = () => {
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setInteractionStatus('IDLE');

    flushPlaybackQueue();
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;

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
    analyserRef.current = null;

    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const startLiveSession = async () => {
    if (isConnected || isConnecting) return;
    setErrorMessage(null);
    setIsConnecting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${location.host}/live?voice=${encodeURIComponent(voiceName)}&mode=${encodeURIComponent(liveMode)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectedRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(analyser);
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (ev) => {
          if (!isConnectedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
          const channel = ev.inputBuffer.getChannelData(0);
          const base64 = pcmFloatToBase64(channel);
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setErrorMessage(msg.error);
            stopLiveSession();
            return;
          }
          if (msg.audio) {
            schedulePcmPlayback(msg.audio);
          }
          if (msg.inputTranscript) {
            appendTranscript('user', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendTranscript('model', msg.outputTranscript);
          }
          if (msg.text) {
            appendTranscript('model', msg.text);
          }
          if (msg.interrupted) {
            flushPlaybackQueue();
          }
          if (msg.interactionStatus) {
            setInteractionStatus(msg.interactionStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'IDLE');
          }
          if (msg.toolEvent) {
            const label =
              msg.toolEvent.status === 'RUNNING'
                ? `Executing live tool: ${msg.toolEvent.name}(${JSON.stringify(msg.toolEvent.args || {})})`
                : `Tool ${msg.toolEvent.name} resolved`;
            appendTranscript('tool', label);
          }
          if (msg.navigateModule && onSelectModule) {
            onSelectModule(msg.navigateModule as ModuleType);
          }
          if (msg.spatialCommand && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aurelius_spatial_command', { detail: msg.spatialCommand }));
          }
        } catch (err) {
          console.warn('Live WS message parse warning:', err);
        }
      };

      ws.onerror = () => {
        setErrorMessage('WebSocket connection error on /live bridge.');
        stopLiveSession();
      };

      ws.onclose = () => {
        if (isConnectedRef.current) {
          stopLiveSession();
        } else {
          setIsConnecting(false);
        }
      };
    } catch (err: any) {
      setErrorMessage(err?.message || 'Microphone permission or Live API bridge failed.');
      stopLiveSession();
    }
  };

  const handleSendTextTurn = () => {
    const trimmed = textInput.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    appendTranscript('user', trimmed);
    setTextInput('');
  };

  const handleSaveTranscript = () => {
    if (!onSaveToVault || transcripts.length === 0) return;
    const formatted = transcripts
      .map((t) => `[${t.timestamp}] ${t.role.toUpperCase()}: ${t.text}`)
      .join('\n');
    const activeModel =
      liveMode === 'thinking' ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live';

    onSaveToVault(
      'voice',
      `Live Voice Session (${voiceName})`,
      formatted.slice(0, 600),
      activeModel,
      undefined,
      JSON.stringify({
        voiceName,
        mode: liveMode,
        entries: transcripts
      })
    );
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleDownloadTranscript = () => {
    if (transcripts.length === 0) return;
    const formatted = transcripts
      .map((t) => `[${t.timestamp}] ${t.role.toUpperCase()}: ${t.text}`)
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-voice-${voiceName.toLowerCase()}-${Date.now()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const activeModelName =
    liveMode === 'thinking' ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live';

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto p-3 sm:p-6 space-y-5">
      {/* Studio Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="absolute inset-0">
          <img
            src={studioHeroImg}
            alt="Acoustic Studio Signal Console"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/60" />
        </div>

        <div className="relative z-10 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-xs font-mono text-amber-400">
              <Radio className="w-4 h-4" />
              <span>16kHz PCM Uplink · 24kHz Gapless Output</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Acoustic Live Voice Console
            </h1>
            <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
              Full-duplex voice session with interruption queue flush, live bilateral transcription, and optional Extended Thinking with asynchronous non-blocking tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={isConnected ? stopLiveSession : startLiveSession}
              disabled={isConnecting}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-lg ${
                isConnected
                  ? 'bg-rose-500 hover:bg-rose-400 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
              } disabled:opacity-60`}
            >
              {isConnected ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>
                {isConnecting
                  ? 'Opening Live Bridge...'
                  : isConnected
                    ? 'Disconnect Live Audio'
                    : 'Start Live Voice Session'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs font-mono flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-300 hover:text-white px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration & Real-Time Waveform */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Session Configuration Card */}
        <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-xs font-bold text-zinc-200">Session Matrix</span>
            <span className="text-[11px] font-mono text-zinc-400">{activeModelName}</span>
          </div>

          {/* Model Reasoning Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 block">
              Engine Architecture
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isConnected}
                onClick={() => setLiveMode('standard')}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  liveMode === 'standard'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Direct Voice</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-1">
                  gemini-3.8-live
                </div>
              </button>

              <button
                type="button"
                disabled={isConnected}
                onClick={() => setLiveMode('thinking')}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  liveMode === 'thinking'
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Brain className="w-3.5 h-3.5 text-sky-400" />
                  <span>Thinking + Tools</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-1">
                  Extended Thinking (Medium)
                </div>
              </button>
            </div>
          </div>

          {/* Voice Persona Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 block">
              Voice Synthesis Persona
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={isConnected}
                  onClick={() => setVoiceName(v.id)}
                  className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                    voiceName === v.id
                      ? 'bg-zinc-800 border-amber-500/60 text-zinc-100'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-semibold">{v.label}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{v.character}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Link Status: {isConnected ? 'ACTIVE FULL-DUPLEX' : 'STANDBY'}</span>
            <span className={interactionStatus === 'IN_PROGRESS' ? 'text-sky-400 font-semibold' : 'text-zinc-500'}>
              {interactionStatus}
            </span>
          </div>
        </div>

        {/* Live Waveform + Transcript Console */}
        <div className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200">Acoustic Signal Monitor</span>
              <span className="font-mono text-[11px] text-zinc-400">
                16kHz Mic In · 24kHz Audio Out
              </span>
            </div>
            <canvas
              ref={waveCanvasRef}
              width={640}
              height={88}
              className="w-full h-22 rounded-xl border border-zinc-800 bg-zinc-950"
            />
          </div>

          {/* Bilateral Transcript & Tool Feed */}
          <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2.5 text-xs">
            {transcripts.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-zinc-500 font-mono text-center px-4">
                Start a Live Voice Session to stream audio and inspect bilateral transcripts here.
              </div>
            ) : (
              transcripts.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-lg border ${
                    item.role === 'user'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                      : item.role === 'tool'
                        ? 'bg-sky-950/30 border-sky-500/30 text-sky-300 font-mono text-[11px]'
                        : 'bg-amber-950/20 border-amber-500/25 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                    <span className="uppercase font-semibold flex items-center gap-1">
                      {item.role === 'tool' && <Wrench className="w-3 h-3 text-sky-400" />}
                      {item.role === 'user' ? 'Operator' : item.role === 'tool' ? 'Live Non-Blocking Tool' : voiceName}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <div className="leading-relaxed whitespace-pre-wrap">{item.text}</div>
                </div>
              ))
            )}
          </div>

          {/* Mid-Session Text Directive + Export Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendTextTurn()}
                disabled={!isConnected}
                placeholder={
                  isConnected
                    ? 'Send text context into the active voice stream...'
                    : 'Connect voice session to enable live text injection...'
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-10 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendTextTurn}
                disabled={!isConnected || !textInput.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-amber-500 text-zinc-950 disabled:opacity-40 cursor-pointer"
                title="Send live text"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onSaveToVault && (
                <button
                  type="button"
                  onClick={handleSaveTranscript}
                  disabled={transcripts.length === 0}
                  className="px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{savedSuccess ? 'Saved' : 'Vault'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadTranscript}
                disabled={transcripts.length === 0}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                title="Download Transcript TXT"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTranscripts([])}
                disabled={transcripts.length === 0}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-rose-400 disabled:opacity-40 cursor-pointer"
                title="Clear Transcript Log"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
