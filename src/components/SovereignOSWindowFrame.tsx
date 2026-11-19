/**
 * @license
 * .JHam Language / H-FID Standard / HEO — TWENTY 47 PROTOCOL - GENESIS NODE
 * Copyright (c) 1988-2026 Joshua Hamilton (JHammerZ) — https://jhammerz.github.io
 * Licensed under the MIT License & JHammerZ Custom Sovereign Licenses
 * (TWENTY 47 PROTOCOL - GENESIS NODE / LYSANDER CORE EULA / H-FID Forensic License v1.1).
 * Zenodo DOI: https://doi.org/10.5281/zenodo.20778079 | ORCID: https://orcid.org/0009-0004-5273-7028
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Minus,
  Square,
  Copy,
  X,
  PanelLeft,
  PanelRight,
  Layers,
  Grid2x2,
  EyeOff,
  Terminal,
  Folder,
  Globe,
  MessageSquare,
  Cpu,
  Activity,
  Settings,
  Shield,
  Sparkles,
  Briefcase,
  PictureInPicture2,
  Bot,
  LayoutGrid,
  RefreshCw,
  HardDrive,
  Archive,
  ShieldAlert,
  Send,
  Gamepad2,
  Package,
  Video,
  Film,
  Download,
  Wallet,
  BookOpen
} from 'lucide-react';
import { ALL_MODULES } from './Navigation';
import type { ModuleType } from '../types';
import {
  loadOSCustomizationProfile,
  saveOSCustomizationProfile,
  applyOSCustomizationToDOM,
  getActiveThemeWallpaperStyle,
  type SovereignOSCustomizationProfile
} from '../utils/osCustomizationStore';

export interface OSWindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}

export function clampWindowGeometry(
  geom: OSWindowGeometry,
  containerW: number,
  containerH: number
): OSWindowGeometry {
  const safeW = Math.max(containerW, 260);
  const safeH = Math.max(containerH, 200);
  const minW = Math.min(250, safeW - 8);
  const minH = Math.min(180, safeH - 8);
  const width = Math.max(minW, Math.min(geom.width, safeW - 8));
  const height = Math.max(minH, Math.min(geom.height, safeH - 8));
  const maxX = Math.max(0, safeW - width);
  const maxY = Math.max(0, safeH - height);
  return {
    ...geom,
    width,
    height,
    x: Math.max(0, Math.min(geom.x, maxX)),
    y: Math.max(0, Math.min(geom.y, maxY))
  };
}

export function createDefaultWindowGeometry(
  index: number,
  containerW: number,
  containerH: number,
  zIndex: number
): OSWindowGeometry {
  const safeW = Math.max(containerW || 1200, 640);
  const safeH = Math.max(containerH || 700, 420);
  const width = Math.min(820, Math.max(460, Math.round(safeW * 0.6)));
  const height = Math.min(620, Math.max(360, Math.round(safeH * 0.78)));
  const stepX = (index % 6) * 34;
  const stepY = (index % 5) * 28;
  return clampWindowGeometry(
    {
      x: 24 + stepX,
      y: 20 + stepY,
      width,
      height,
      zIndex,
      minimized: false,
      maximized: false
    },
    safeW,
    safeH
  );
}

interface SovereignOSWindowFrameProps {
  moduleId: ModuleType;
  mode: 'floating' | 'tiled' | 'pip';
  visible: boolean;
  tiledClassName?: string;
  geometry?: OSWindowGeometry;
  isFocused?: boolean;
  alwaysOnTop?: boolean;
  isDetached?: boolean;
  pipMinimized?: boolean;
  containerSize?: { width: number; height: number };
  onFocus?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onSnapLeft?: () => void;
  onSnapRight?: () => void;
  onToggleDetach?: () => void;
  onRestorePip?: () => void;
  onClose?: () => void;
  onMoveResize?: (next: Partial<OSWindowGeometry>) => void;
  children: React.ReactNode;
}

type DragAction = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const SovereignOSWindowFrame: React.FC<SovereignOSWindowFrameProps> = ({
  moduleId,
  mode,
  visible,
  tiledClassName = 'flex flex-1 min-w-0 min-h-0 flex-col',
  geometry,
  isFocused = false,
  alwaysOnTop = false,
  isDetached = false,
  pipMinimized = false,
  containerSize = { width: 1280, height: 720 },
  onFocus,
  onMinimize,
  onToggleMaximize,
  onSnapLeft,
  onSnapRight,
  onToggleDetach,
  onRestorePip,
  onClose,
  onMoveResize,
  children
}) => {
  const dragSessionRef = useRef<{
    type: DragAction;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const meta = ALL_MODULES.find((m) => m.id === moduleId);
  const Icon = meta?.icon || Terminal;

  if (mode === 'tiled') {
    return (
      <div className={visible ? tiledClassName : 'hidden'}>
        {children}
      </div>
    );
  }

  // Detached Mobile/Workspace Pill Minimized State (keeps Window alive with 0 unmounts)
  if (mode === 'pip' && pipMinimized) {
    return (
      <>
        <div className="hidden" aria-hidden="true">
          {children}
        </div>
        <button
          type="button"
          onClick={() => onRestorePip?.()}
          className={`fixed z-40 px-3.5 py-2 rounded-2xl bg-zinc-900/95 hover:bg-zinc-800 border border-amber-500/50 shadow-[0_12px_32px_rgba(0,0,0,0.7)] flex items-center gap-2 text-xs font-semibold text-amber-200 cursor-pointer backdrop-blur-md ${
            moduleId === 'chat'
              ? 'right-3 bottom-14'
              : moduleId === 'browser'
              ? 'right-3 bottom-24'
              : 'left-3 bottom-14'
          }`}
          title={`Restore Detached ${meta?.label || moduleId}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Icon className={`w-4 h-4 ${meta?.accentColor || 'text-amber-400'}`} />
          <span>{meta?.shortLabel || meta?.label || moduleId} PiP</span>
        </button>
      </>
    );
  }

  // Floating Desktop Window OR Detached PiP Overlay Mode (Resizable & Movable Everywhere)
  const rawGeom = geometry || createDefaultWindowGeometry(0, containerSize.width, containerSize.height, 45);
  const safeGeom = clampWindowGeometry(rawGeom, containerSize.width, containerSize.height);
  const isHidden = mode === 'floating' ? !visible || safeGeom.minimized : !visible;

  if (isHidden) {
    return (
      <div className="hidden" aria-hidden="true">
        {children}
      </div>
    );
  }

  const effectiveZ = alwaysOnTop ? Math.max(safeGeom.zIndex, 46) : safeGeom.zIndex;

  const startDrag = (e: React.PointerEvent, type: DragAction) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus?.();
    if (type === 'move' && safeGeom.maximized) return;

    dragSessionRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: safeGeom.x,
      origY: safeGeom.y,
      origW: safeGeom.width,
      origH: safeGeom.height
    };
    setIsInteracting(true);

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const sess = dragSessionRef.current;
      if (!sess || !onMoveResize) return;
      const dx = moveEvt.clientX - sess.startX;
      const dy = moveEvt.clientY - sess.startY;
      const minW = Math.min(250, Math.max(200, containerSize.width - 12));
      const minH = Math.min(180, Math.max(160, containerSize.height - 12));

      if (sess.type === 'move') {
        const clamped = clampWindowGeometry(
          {
            ...safeGeom,
            x: sess.origX + dx,
            y: sess.origY + dy,
            width: sess.origW,
            height: sess.origH
          },
          containerSize.width,
          containerSize.height
        );
        onMoveResize({ x: clamped.x, y: clamped.y });
        return;
      }

      let nextX = sess.origX;
      let nextY = sess.origY;
      let nextW = sess.origW;
      let nextH = sess.origH;

      // Horizontal resize
      if (sess.type.includes('e')) {
        const maxW = Math.max(minW, containerSize.width - sess.origX - 4);
        nextW = Math.max(minW, Math.min(maxW, sess.origW + dx));
      } else if (sess.type.includes('w')) {
        const maxDelta = sess.origW - minW;
        const clampedDx = Math.max(-sess.origX + 4, Math.min(maxDelta, dx));
        nextX = sess.origX + clampedDx;
        nextW = sess.origW - clampedDx;
      }

      // Vertical resize
      if (sess.type.includes('s')) {
        const maxH = Math.max(minH, containerSize.height - sess.origY - 4);
        nextH = Math.max(minH, Math.min(maxH, sess.origH + dy));
      } else if (sess.type.includes('n')) {
        const maxDelta = sess.origH - minH;
        const clampedDy = Math.max(-sess.origY + 4, Math.min(maxDelta, dy));
        nextY = sess.origY + clampedDy;
        nextH = sess.origH - clampedDy;
      }

      onMoveResize({
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextW),
        height: Math.round(nextH),
        maximized: false
      });
    };

    const handlePointerUp = () => {
      dragSessionRef.current = null;
      setIsInteracting(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const windowStyle: React.CSSProperties = safeGeom.maximized
    ? {
        top: 4,
        left: 4,
        width: 'calc(100% - 8px)',
        height: 'calc(100% - 8px)',
        zIndex: effectiveZ
      }
    : {
        top: safeGeom.y,
        left: safeGeom.x,
        width: safeGeom.width,
        height: safeGeom.height,
        zIndex: effectiveZ
      };

  return (
    <div
      onPointerDownCapture={() => onFocus?.()}
      style={{
        ...windowStyle,
        borderRadius: 'var(--sovereign-window-radius, 14px)'
      }}
      className={`sovereign-window absolute flex flex-col overflow-hidden bg-zinc-950/95 backdrop-blur-md transition-shadow ${
        isDetached || alwaysOnTop
          ? 'border border-amber-400/75 shadow-[0_24px_70px_rgba(0,0,0,0.88)] ring-1 ring-amber-400/35'
          : isFocused
          ? 'border border-amber-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.75)] ring-1 ring-amber-500/20'
          : 'border border-zinc-800/90 shadow-[0_12px_36px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* Window Title Bar */}
      <div
        onPointerDown={(e) => startDrag(e, 'move')}
        onDoubleClick={() => onToggleMaximize?.()}
        className={`h-9 px-3 flex items-center justify-between gap-2 shrink-0 select-none touch-none border-b ${
          safeGeom.maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        } ${
          isDetached || alwaysOnTop
            ? 'bg-gradient-to-r from-zinc-900 via-amber-950/35 to-zinc-900 border-amber-500/35 text-amber-100'
            : isFocused
            ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100'
            : 'bg-zinc-950/95 border-zinc-900 text-zinc-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${meta?.accentColor || 'text-amber-400'}`} />
          <span className="text-xs font-semibold truncate">{meta?.label || moduleId}</span>
          {isInteracting ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/35 tabular-nums whitespace-nowrap">
              {Math.round(safeGeom.width)}×{Math.round(safeGeom.height)}
            </span>
          ) : isDetached ? (
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
              Detached · Resizable
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500 hidden xl:inline">
              · UID 0
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleDetach && (
            <button
              type="button"
              onClick={onToggleDetach}
              className={`p-1 rounded cursor-pointer ${
                isDetached
                  ? 'bg-amber-500/25 text-amber-200 hover:bg-amber-500/35'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-amber-300'
              }`}
              title={isDetached ? 'Re-Dock Window into OS' : 'Detach Floating Always-On-Top (Resizable)'}
              aria-label={isDetached ? 'Re-Dock Window' : 'Detach Window'}
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onSnapLeft && (
            <button
              type="button"
              onClick={onSnapLeft}
              className="hidden sm:inline-flex p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              title="Snap Left Half"
              aria-label="Snap Left Half"
            >
              <PanelLeft className="w-3 h-3" />
            </button>
          )}
          {onSnapRight && (
            <button
              type="button"
              onClick={onSnapRight}
              className="hidden sm:inline-flex p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              title="Snap Right Half"
              aria-label="Snap Right Half"
            >
              <PanelRight className="w-3 h-3" />
            </button>
          )}
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              title="Minimize Window"
              aria-label="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              title={safeGeom.maximized ? 'Restore Window' : 'Maximize Window'}
              aria-label={safeGeom.maximized ? 'Restore Window' : 'Maximize Window'}
            >
              {safeGeom.maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-rose-500/25 text-zinc-400 hover:text-rose-300 cursor-pointer"
              title={isDetached ? 'Re-Dock / Close Overlay' : 'Close Window'}
              aria-label="Close Window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Window Content Body */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-zinc-950">
        {children}

        {/* Focus shield on background unfocused windows */}
        {!isFocused && !alwaysOnTop && (
          <div
            onPointerDown={() => onFocus?.()}
            className="absolute inset-0 z-10 bg-transparent cursor-pointer"
            title="Click to focus window"
          />
        )}

        {/* Drag/Resize pointer shield so embedded iframes don't swallow pointermove */}
        {isInteracting && (
          <div className="absolute inset-0 z-20 bg-transparent" />
        )}
      </div>

      {/* Full 8-Way Edge & Corner Resize Handles (Active on Floating & Detached Windows) */}
      {!safeGeom.maximized && (
        <>
          {/* Edges */}
          <div
            onPointerDown={(e) => startDrag(e, 'n')}
            className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize touch-none z-30"
            title="Drag top edge to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 's')}
            className="absolute bottom-0 left-3 right-4 h-2 cursor-ns-resize touch-none z-30"
            title="Drag bottom edge to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 'w')}
            className="absolute top-9 bottom-3 left-0 w-2 cursor-ew-resize touch-none z-30"
            title="Drag left edge to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 'e')}
            className="absolute top-9 bottom-4 right-0 w-2 cursor-ew-resize touch-none z-30"
            title="Drag right edge to resize"
          />

          {/* Corners */}
          <div
            onPointerDown={(e) => startDrag(e, 'nw')}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize touch-none z-30"
            title="Drag top-left corner to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 'ne')}
            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize touch-none z-30"
            title="Drag top-right corner to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 'sw')}
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize touch-none z-30"
            title="Drag bottom-left corner to resize"
          />
          <div
            onPointerDown={(e) => startDrag(e, 'se')}
            title="Drag bottom-right corner to resize"
            className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize touch-none z-30 flex items-end justify-end p-0.5 text-zinc-500 hover:text-amber-400"
          >
            <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 fill-current">
              <path d="M11 2L2 11H4.5L11 4.5V2ZM11 7L7 11H9.5L11 9.5V7Z" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
};

interface SovereignDesktopCanvasProps {
  openModules: ModuleType[];
  isChatDetached?: boolean;
  onOpenModule: (mod: ModuleType) => void;
  onToggleDetachChat?: () => void;
  onLaunchChatPrompt?: (prompt: string) => void;
  onOpenStartMenu?: () => void;
  onTileWindows: () => void;
  onCascadeWindows: () => void;
  onMinimizeAll: () => void;
  onSwitchWorkspaceMode: () => void;
}

const DESKTOP_SHORTCUTS: Array<{
  id: ModuleType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { id: 'file-manager', label: 'This PC · Files', subtitle: 'Host Filesystem', icon: HardDrive, accent: 'text-amber-300' },
  { id: 'chat', label: 'Sovereign Chat', subtitle: 'AI Orchestrator', icon: MessageSquare, accent: 'text-amber-400' },
  { id: 'browser', label: 'Google Chrome', subtitle: 'Full Internet', icon: Globe, accent: 'text-sky-400' },
  { id: 'terminal', label: 'Root Terminal', subtitle: 'UID 0 Shell', icon: Terminal, accent: 'text-emerald-400' },
  { id: 'task-manager', label: 'Task Manager', subtitle: 'CPU · RAM · PIDs', icon: Cpu, accent: 'text-cyan-400' },
  { id: 'macro-telemetry', label: 'Macro Telemetry', subtitle: 'Laplace-14 · 99%', icon: Activity, accent: 'text-rose-400' },
  { id: 'crypto-wallet', label: 'Crypto Wallets', subtitle: 'Personal & Agentic', icon: Wallet, accent: 'text-emerald-400' },
  { id: 'ai-genesis-distillery', label: 'AI Distillery', subtitle: 'Model Forging', icon: Sparkles, accent: 'text-purple-400' },
  { id: 'projects', label: 'Unified Projects', subtitle: 'IDE & Builds', icon: Briefcase, accent: 'text-indigo-400' },
  { id: 'vault', label: 'Encrypted Vault', subtitle: 'AES-256 Store', icon: Archive, accent: 'text-emerald-300' },
  { id: 'autonomy-supervisor', label: 'Autonomy HUD', subtitle: '100% Ring -3', icon: ShieldAlert, accent: 'text-orange-400' },
  { id: 'osint', label: 'OSINT Recon', subtitle: 'Intel Suite', icon: Shield, accent: 'text-sky-300' },
  { id: 'universal-installer', label: 'App & Game Store', subtitle: 'Steam · Discord · Pkg', icon: Package, accent: 'text-amber-400' },
  { id: 'swarm-test', label: 'Forensic & Manual', subtitle: 'Audit · Repair · Docs', icon: BookOpen, accent: 'text-amber-300' },
  { id: 'os-settings', label: 'Control Panel', subtitle: 'Win · Mac · Linux', icon: Settings, accent: 'text-zinc-300' }
];

interface DesktopInstalledApp {
  id: string;
  name: string;
  version: string;
  category: string;
  publisher: string;
  iconType: string;
  launchMode: string;
  launchTarget: string;
  desktopShortcut: boolean;
}

export const SovereignDesktopCanvas: React.FC<SovereignDesktopCanvasProps> = ({
  openModules,
  isChatDetached = false,
  onOpenModule,
  onToggleDetachChat,
  onLaunchChatPrompt,
  onOpenStartMenu,
  onTileWindows,
  onCascadeWindows,
  onMinimizeAll,
  onSwitchWorkspaceMode
}) => {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [desktopCommand, setDesktopCommand] = useState('');
  const [installedDesktopApps, setInstalledDesktopApps] = useState<DesktopInstalledApp[]>([]);
  const [customProfile, setCustomProfile] = useState<SovereignOSCustomizationProfile>(() =>
    loadOSCustomizationProfile()
  );
  const [hudMarketQuotes, setHudMarketQuotes] = useState<any[]>([]);
  const [hudCryptoSummary, setHudCryptoSummary] = useState<{
    personalUsd: number;
    agenticUsd: number;
  } | null>(null);
  const [hostInfo, setHostInfo] = useState<{
    hostPlatform: string;
    arch: string;
    cores: number;
    totalMemGb: number;
    hostname: string;
    uid: number;
    ring: number;
  } | null>(null);

  useEffect(() => {
    applyOSCustomizationToDOM(customProfile);
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<SovereignOSCustomizationProfile>;
      if (ce.detail) setCustomProfile(ce.detail);
    };
    window.addEventListener('sovereign_os_customization_changed', onCustom);
    return () => window.removeEventListener('sovereign_os_customization_changed', onCustom);
  }, []);

  useEffect(() => {
    let active = true;
    const loadHudTelemetry = () => {
      fetch('/api/macro/telemetry')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !data?.quotes) return;
          setHudMarketQuotes(data.quotes.slice(0, 4));
        })
        .catch(() => {});

      fetch('/api/crypto/wallets')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !Array.isArray(data?.wallets)) return;
          let pUsd = 0;
          let aUsd = 0;
          for (const w of data.wallets) {
            const holdingsVal = (w.holdings || []).reduce(
              (acc: number, h: any) => acc + (Number(h.marketValueUsd) || 0),
              0
            );
            const total = (Number(w.cashReserveUsd) || 0) + holdingsVal;
            if (w.role === 'AGENTIC_AUTONOMOUS') aUsd += total;
            else pUsd += total;
          }
          setHudCryptoSummary({ personalUsd: pUsd, agenticUsd: aUsd });
        })
        .catch(() => {});
    };
    loadHudTelemetry();
    const timer = setInterval(loadHudTelemetry, 18000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadInstalled = () => {
      fetch('/api/os/packages/registry')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !data?.success || !Array.isArray(data.installed)) return;
          setInstalledDesktopApps(
            data.installed.filter((a: DesktopInstalledApp) => a.desktopShortcut !== false)
          );
        })
        .catch(() => {});
    };
    loadInstalled();
    window.addEventListener('sovereign_apps_updated', loadInstalled);
    return () => {
      active = false;
      window.removeEventListener('sovereign_apps_updated', loadInstalled);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/os/runtime-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.success) return;
        setHostInfo({
          hostPlatform: String(data.hostPlatform || 'linux'),
          arch: String(data.arch || 'x64'),
          cores: Number(data.cpu?.cores || 0),
          totalMemGb: data.memory?.totalBytes
            ? Math.max(1, Math.round(data.memory.totalBytes / 1024 / 1024 / 1024))
            : 0,
          hostname: String(data.hostname || 'sovereign-host'),
          uid: typeof data.authority?.uid === 'number' ? data.authority.uid : 0,
          ring: typeof data.authority?.ring === 'number' ? data.authority.ring : -3
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onDown = () => setContextMenu(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(8, e.clientX - rect.left), Math.max(8, rect.width - 230));
    const y = Math.min(Math.max(8, e.clientY - rect.top), Math.max(8, rect.height - 320));
    setContextMenu({ x, y });
  };

  const handleDesktopCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = desktopCommand.trim();
    if (!q) return;
    setDesktopCommand('');
    if (q.startsWith('$ ') || q.startsWith('> ')) {
      const cmd = q.slice(2).trim();
      if (cmd) {
        onOpenModule('terminal');
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('sovereign_os_command', {
              detail: { action: 'terminal_exec', targetModule: 'terminal', command: cmd }
            })
          );
        }, 80);
        return;
      }
    }
    if (/^https?:\/\//i.test(q)) {
      window.dispatchEvent(
        new CustomEvent('sovereign_os_command', {
          detail: { action: 'browser_navigate', targetModule: 'browser', url: q }
        })
      );
      return;
    }
    if (onLaunchChatPrompt) {
      onLaunchChatPrompt(q);
    } else {
      onOpenModule('chat');
    }
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedIcon(null);
      }}
      style={getActiveThemeWallpaperStyle(customProfile)}
      className="absolute inset-0 overflow-hidden select-none flex flex-col justify-between transition-all duration-300"
    >
      {/* Optional Architectural Tactical Grid */}
      {customProfile.showTacticalGrid && (
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
      )}

      {/* Optional Subtle CRT Scanline Shader */}
      {customProfile.showCrtScanlines && (
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 1px, transparent 1px, transparent 3px)'
          }}
        />
      )}

      {/* Responsive Desktop App Icon Grid + Right-Side Live Desktop HUD Widgets */}
      <div className="relative z-0 flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div
          className={`grid grid-cols-3 sm:grid-cols-none sm:grid-flow-col sm:grid-rows-6 ${
            customProfile.iconSize === 'compact'
              ? 'sm:auto-cols-[90px] gap-1.5'
              : customProfile.iconSize === 'large'
              ? 'sm:auto-cols-[120px] gap-3'
              : 'sm:auto-cols-[106px] gap-2 sm:gap-2.5'
          } w-full sm:w-fit`}
        >
          {DESKTOP_SHORTCUTS.map((item) => {
            const Icon = item.icon;
            const isRunning = openModules.includes(item.id);
            const isSelected = selectedIcon === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedIcon(item.id);
                  onOpenModule(item.id);
                }}
                className={`group p-2 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-400/50'
                    : 'border-transparent hover:bg-white/[0.06] hover:border-white/10 active:bg-white/[0.1]'
                }`}
              >
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-zinc-900/90 border border-zinc-800 group-hover:border-amber-500/40 shadow-lg flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${item.accent}`} />
                  {isRunning && (
                    <span className="absolute -bottom-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-zinc-100 leading-tight drop-shadow line-clamp-1">
                  {item.label}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 leading-none line-clamp-1">
                  {item.subtitle}
                </span>
              </button>
            );
          })}

          {/* Installed Sovereign OS Software & Games Shortcuts (Steam, Discord, Arcade, OBS, custom packages) */}
          {installedDesktopApps.map((app) => {
            const iconKey = `app-${app.id}`;
            const isSelected = selectedIcon === iconKey;
            const AppIcon =
              app.iconType === 'discord'
                ? MessageSquare
                : app.iconType === 'obs'
                ? Video
                : app.iconType === 'vlc'
                ? Film
                : app.iconType === 'steam' ||
                  app.iconType === 'arcade' ||
                  app.iconType === 'mmorpg' ||
                  app.iconType === 'emulator' ||
                  app.iconType === 'heroic'
                ? Gamepad2
                : Download;
            const accentClass =
              app.id === 'steam'
                ? 'text-sky-400'
                : app.id === 'discord'
                ? 'text-indigo-400'
                : app.id === 'sovereign-arcade'
                ? 'text-amber-400'
                : app.id === 'obs-studio'
                ? 'text-rose-400'
                : 'text-emerald-400';

            return (
              <button
                key={iconKey}
                type="button"
                onClick={() => {
                  setSelectedIcon(iconKey);
                  if (app.launchMode === 'os_module') {
                    onOpenModule(app.launchTarget as ModuleType);
                  } else {
                    onOpenModule('universal-installer');
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent('sovereign_launch_installed_app', {
                          detail: { appId: app.id }
                        })
                      );
                    }, 120);
                  }
                }}
                className={`group p-2 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-400/50'
                    : 'border-transparent hover:bg-white/[0.06] hover:border-white/10 active:bg-white/[0.1]'
                }`}
              >
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-zinc-900/90 border border-zinc-800 group-hover:border-emerald-500/50 shadow-lg flex items-center justify-center">
                  <AppIcon className={`w-5 h-5 ${accentClass}`} />
                  <span className="absolute -top-1 -right-1 px-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-[8px] font-bold text-emerald-300">
                    APP
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-zinc-100 leading-tight drop-shadow line-clamp-1">
                  {app.name.replace(' (Sovereign OS Edition)', '').replace(' (WebRTC Edition)', '')}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 leading-none line-clamp-1">
                  {app.publisher}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right-Side Live Desktop Telemetry & Customization HUD Widgets */}
        <div className="hidden lg:flex flex-col gap-2.5 w-72 shrink-0">
          {customProfile.desktopWidgets.showKernelHud && (
            <div className="rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/90 p-3 shadow-xl space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>RING -3 KERNEL & WORKSPACE</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenModule('os-settings')}
                  className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                >
                  Customize
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {([1, 2, 3, 4] as const).map((wsNum) => (
                  <button
                    key={wsNum}
                    type="button"
                    onClick={() => {
                      const next = saveOSCustomizationProfile({ activeWorkspace: wsNum });
                      setCustomProfile(next);
                    }}
                    className={`py-1 rounded text-[10px] font-bold cursor-pointer border ${
                      customProfile.activeWorkspace === wsNum
                        ? 'bg-amber-500 text-zinc-950 border-amber-400'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    WS {wsNum}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-0.5">
                <span>Theme: {customProfile.themeId}</span>
                <span className="text-emerald-400">
                  UID {hostInfo?.uid ?? 0} · {hostInfo?.cores || 8}C
                </span>
              </div>
            </div>
          )}

          {customProfile.desktopWidgets.showMarketTickerHud && hudMarketQuotes.length > 0 && (
            <div className="rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/90 p-3 shadow-xl space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  <span>LAPLACE-14 (h=2s) 5M HUD</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenModule('macro-telemetry')}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                >
                  20 Markets
                </button>
              </div>
              <div className="space-y-1">
                {hudMarketQuotes.map((q: any) => (
                  <div key={q.symbol} className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-zinc-200">{q.symbol}</span>
                    <span className="text-zinc-300">
                      ${Number(q.price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span
                      className={
                        Number(q.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {Number(q.changePercent || 0) >= 0 ? '+' : ''}
                      {Number(q.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customProfile.desktopWidgets.showCryptoVaultHud && hudCryptoSummary && (
            <div className="rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/90 p-3 shadow-xl space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DUAL-VAULT CRYPTO HUD</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenModule('crypto-wallet')}
                  className="text-[10px] text-emerald-300 hover:underline cursor-pointer"
                >
                  Open Vaults
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Personal Vault:</span>
                <span className="font-bold text-emerald-300">
                  ${Math.round(hudCryptoSummary.personalUsd).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">UID 0 Agentic:</span>
                <span className="font-bold text-amber-300">
                  ${Math.round(hudCryptoSummary.agenticUsd).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {customProfile.desktopWidgets.showClipboardHud && (
            <div className="rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/90 p-3 shadow-xl space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-300">OS CLIPBOARD RING</span>
                <button
                  type="button"
                  onClick={() => onOpenModule('os-settings')}
                  className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>
              {customProfile.clipboardHistory.slice(0, 2).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(c.text)}
                  className="w-full text-left p-1.5 rounded bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-zinc-300 truncate cursor-pointer"
                  title="Click to copy"
                >
                  {c.label}: {c.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Orchestrator-Powered OS Command Dock & Live Host Telemetry Strip */}
      <div className="relative z-0 px-3 pb-3 sm:px-5 sm:pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-2.5 shrink-0">
        {/* Central / Primary Autonomous Orchestrator Command Dock */}
        <div className="w-full lg:max-w-2xl rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.75)] p-2.5 sm:p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Lysander Sovereign OS</span>
              <span className="text-amber-300">
                · UID {hostInfo?.uid ?? 0} · Ring {hostInfo?.ring ?? -3} Hypervisor
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-jhammerz-license'))}
              className="text-amber-300/90 hover:text-amber-200 underline cursor-pointer truncate"
              title="Click to inspect official MIT & JHammerZ Custom Sovereign License Charter (jhammerz.github.io)"
            >
              © 1988–2026 Joshua Hamilton (JHammerZ) · MIT & TWENTY 47 / H-FID License · jhammerz.github.io
            </button>
          </div>

          <form onSubmit={handleDesktopCommandSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Bot className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={desktopCommand}
                onChange={(e) => setDesktopCommand(e.target.value)}
                placeholder="Command OS autonomously, open Chrome URL, or run $ host shell command..."
                className="w-full bg-zinc-900/95 border border-zinc-700/80 focus:border-amber-500/60 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Execute</span>
            </button>
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
            <button
              type="button"
              onClick={() => onOpenModule('chat')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-[11px] font-semibold text-amber-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
            >
              <MessageSquare className="w-3 h-3 text-amber-400" />
              <span>Orchestrator Chat</span>
            </button>
            {onToggleDetachChat && (
              <button
                type="button"
                onClick={onToggleDetachChat}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                  isChatDetached
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-amber-300'
                }`}
              >
                <PictureInPicture2 className="w-3 h-3" />
                <span>{isChatDetached ? 'Re-Dock Chat' : 'Float Copilot PiP'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenModule('browser')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-sky-300 flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Globe className="w-3 h-3" />
              <span>Chrome</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenModule('terminal')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-emerald-300 flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Terminal className="w-3 h-3" />
              <span>Root Shell</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenModule('file-manager')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-amber-200 flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
            >
              <HardDrive className="w-3 h-3" />
              <span>Host Files</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenModule('task-manager')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-cyan-300 flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Cpu className="w-3 h-3" />
              <span>Task Manager</span>
            </button>
          </div>
        </div>

        {/* Desktop Right-Bottom Quick Window Manager Bar (sm+) */}
        <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur-md border border-zinc-800 rounded-xl p-1.5 shadow-xl self-end shrink-0">
          <button
            type="button"
            onClick={onTileWindows}
            className="px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-[11px] text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            title="Tile Open Windows"
          >
            <Grid2x2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Tile</span>
          </button>
          <button
            type="button"
            onClick={onCascadeWindows}
            className="px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-[11px] text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            title="Cascade Open Windows"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Cascade</span>
          </button>
          <button
            type="button"
            onClick={onMinimizeAll}
            className="px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-[11px] text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            title="Minimize All (Show Desktop)"
          >
            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={onSwitchWorkspaceMode}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-sky-300 font-semibold cursor-pointer"
            title="Switch to Split Workspace Mode"
          >
            Split Mode
          </button>
        </div>
      </div>

      {/* Windows-Style Desktop Right-Click Context Menu */}
      {contextMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="absolute z-50 w-56 rounded-xl bg-zinc-950/95 backdrop-blur-lg border border-zinc-700/90 shadow-2xl py-1.5 text-xs text-zinc-200"
        >
          {onOpenStartMenu && (
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onOpenStartMenu();
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
              <span>Start Menu · All OS Apps</span>
            </button>
          )}
          {onToggleDetachChat && (
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onToggleDetachChat();
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
            >
              <PictureInPicture2 className="w-3.5 h-3.5 text-amber-300" />
              <span>{isChatDetached ? 'Re-Dock Orchestrator Chat' : 'Detach Floating Chat PiP'}</span>
            </button>
          )}
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onOpenModule('browser');
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Google Chrome</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onOpenModule('file-manager');
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Folder className="w-3.5 h-3.5 text-amber-300" />
            <span>Open This PC (Files)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onOpenModule('terminal');
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Root Terminal (UID 0)</span>
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onTileWindows();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Grid2x2 className="w-3.5 h-3.5 text-sky-300" />
            <span>Tile Open Windows</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onCascadeWindows();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-amber-300" />
            <span>Cascade Windows</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onMinimizeAll();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
            <span>Show Desktop</span>
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onOpenModule('os-settings');
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-300" />
            <span>Personalize & OS Settings</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onSwitchWorkspaceMode();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Switch to Split Workspace</span>
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              window.dispatchEvent(new CustomEvent('open-jhammerz-license'));
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center gap-2.5 text-amber-300 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>MIT & JHammerZ License Charter</span>
          </button>
        </div>
      )}
    </div>
  );
};
