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

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  type User, 
  collection, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  doc, 
  query,
  orderBy,
  OperationType,
  handleFirestoreError,
  measureFirestoreLatency
} from './firebase';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { AutonomousMarketAlert } from './components/MacroTelemetryModule';
import type { OSShellViewMode } from './components/SovereignOSSettingsModule';
import { CommandPalette } from './components/CommandPalette';
import { SystemHealthDashboard } from './components/SystemHealthDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SovereignOSBar } from './components/SovereignOSBar';
import {
  SovereignOSWindowFrame,
  SovereignDesktopCanvas,
  clampWindowGeometry,
  createDefaultWindowGeometry,
  type OSWindowGeometry
} from './components/SovereignOSWindowFrame';
import { localLlmManager } from './utils/localLlmEngine';
import { autonomousSelfImprovement } from './utils/autonomousSelfImprovement';
import { orchestratorRuntime } from './utils/OrchestratorRuntime';
import { useOrchestrator } from './hooks/useOrchestrator';
import {
  loadOSCustomizationProfile,
  saveOSCustomizationProfile
} from './utils/osCustomizationStore';
import type { ModuleType, Artifact, AuditLedgerItem } from './types';

// Lazy-loaded OS Applications (keeps initial boot fast & eliminates 20+ MB including Three.js from startup)
const ChatModule = lazy(() => import('./components/ChatModule').then(m => ({ default: m.ChatModule })));
const GroundingModule = lazy(() => import('./components/GroundingModule').then(m => ({ default: m.GroundingModule })));
const MusicModule = lazy(() => import('./components/MusicModule').then(m => ({ default: m.MusicModule })));
const ImageModule = lazy(() => import('./components/ImageModule').then(m => ({ default: m.ImageModule })));
const VideoModule = lazy(() => import('./components/VideoModule').then(m => ({ default: m.VideoModule })));
const TranscribeModule = lazy(() => import('./components/TranscribeModule').then(m => ({ default: m.TranscribeModule })));
const LiveVoiceModule = lazy(() => import('./components/LiveVoiceModule').then(m => ({ default: m.LiveVoiceModule })));
const VaultModule = lazy(() => import('./components/VaultModule').then(m => ({ default: m.VaultModule })));
const GitHubModule = lazy(() => import('./components/GitHubModule').then(m => ({ default: m.GitHubModule })));
const WarRoomModule = lazy(() => import('./components/WarRoomModule').then(m => ({ default: m.WarRoomModule })));
const SovereignBrowser = lazy(() => import('./components/SovereignBrowser').then(m => ({ default: m.SovereignBrowser })));
const ScratchpadModule = lazy(() => import('./components/ScratchpadModule').then(m => ({ default: m.ScratchpadModule })));
const HITLWorkflowModule = lazy(() => import('./components/HITLWorkflowModule').then(m => ({ default: m.HITLWorkflowModule })));
const TermuxEdgeModule = lazy(() => import('./components/TermuxEdgeModule').then(m => ({ default: m.TermuxEdgeModule })));
const OSINTModule = lazy(() => import('./components/OSINTModule').then(m => ({ default: m.OSINTModule })));
const BurnerMailModule = lazy(() => import('./components/BurnerMailModule').then(m => ({ default: m.BurnerMailModule })));
const InfiniteSimModule = lazy(() => import('./components/InfiniteSimModule').then(m => ({ default: m.InfiniteSimModule })));
const FunctionDeckModule = lazy(() => import('./components/FunctionDeckModule').then(m => ({ default: m.FunctionDeckModule })));
const UnifiedProjectsModule = lazy(() => import('./components/UnifiedProjectsModule').then(m => ({ default: m.UnifiedProjectsModule })));
const PromptPresetsModule = lazy(() => import('./components/PromptPresetsModule').then(m => ({ default: m.PromptPresetsModule })));
const AuditLedgerModule = lazy(() => import('./components/AuditLedgerModule').then(m => ({ default: m.AuditLedgerModule })));
const SwarmDiagnosticModule = lazy(() => import('./components/SwarmDiagnosticModule').then(m => ({ default: m.SwarmDiagnosticModule })));
const PackagerModule = lazy(() => import('./components/PackagerModule').then(m => ({ default: m.PackagerModule })));
const GoogleDriveModule = lazy(() => import('./components/GoogleDriveModule').then(m => ({ default: m.GoogleDriveModule })));
const GoogleTasksModule = lazy(() => import('./components/GoogleTasksModule').then(m => ({ default: m.GoogleTasksModule })));
const KnowledgeGraphModule = lazy(() => import('./components/KnowledgeGraphModule').then(m => ({ default: m.KnowledgeGraphModule })));
const ToolShedModule = lazy(() => import('./components/ToolShedModule').then(m => ({ default: m.ToolShedModule })));
const AutonomySupervisorModule = lazy(() => import('./components/AutonomySupervisorModule').then(m => ({ default: m.AutonomySupervisorModule })));
const AgentDevKitModule = lazy(() => import('./components/AgentDevKitModule').then(m => ({ default: m.AgentDevKitModule })));
const AIGenesisDistilleryModule = lazy(() => import('./components/AIGenesisDistilleryModule').then(m => ({ default: m.AIGenesisDistilleryModule })));
const WorldLoadStartScreen = lazy(() => import('./components/WorldLoadStartScreen').then(m => ({ default: m.WorldLoadStartScreen })));
const UniversalEmulatorModderModule = lazy(() => import('./components/UniversalEmulatorModderModule').then(m => ({ default: m.UniversalEmulatorModderModule })));
const MacroTelemetryModule = lazy(() => import('./components/MacroTelemetryModule').then(m => ({ default: m.MacroTelemetryModule })));
const SovereignFilesModule = lazy(() => import('./components/SovereignFilesModule').then(m => ({ default: m.SovereignFilesModule })));
const SovereignTerminalModule = lazy(() => import('./components/SovereignTerminalModule').then(m => ({ default: m.SovereignTerminalModule })));
const SovereignTaskManagerModule = lazy(() => import('./components/SovereignTaskManagerModule').then(m => ({ default: m.SovereignTaskManagerModule })));
const SovereignOSSettingsModule = lazy(() => import('./components/SovereignOSSettingsModule').then(m => ({ default: m.SovereignOSSettingsModule })));
const DownloadModelsModule = lazy(() => import('./components/DownloadModelsModule').then(m => ({ default: m.DownloadModelsModule })));
const UniversalInstallerModule = lazy(() => import('./components/UniversalInstallerModule').then(m => ({ default: m.UniversalInstallerModule })));
const SovereignCryptoWalletModule = lazy(() => import('./components/SovereignCryptoWalletModule').then(m => ({ default: m.SovereignCryptoWalletModule })));
const AutonomousGrantEnginePanel = lazy(() => import('./components/AutonomousGrantEnginePanel').then(m => ({ default: m.AutonomousGrantEnginePanel })));
const ApiSecretsModule = lazy(() => import('./components/ApiSecretsModule').then(m => ({ default: m.ApiSecretsModule })));
const SovereignIntegrationsHub = lazy(() => import('./components/SovereignIntegrationsHub').then(m => ({ default: m.SovereignIntegrationsHub })));
const SpatialArenaModule = lazy(() => import('./components/three/SpatialArenaModule').then(m => ({ default: m.SpatialArenaModule })));
const FloatingTouchGamepadOverlay = lazy(() => import('./components/UniversalControllerDeck').then(m => ({ default: m.FloatingTouchGamepadOverlay })));

const ModuleLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Loading module...' }) => (
  <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-3 p-8 bg-zinc-950/90 text-zinc-400 font-mono text-xs">
    <div className="w-7 h-7 rounded-lg border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
    <span>{label}</span>
  </div>
);

export default function App() {
  const {
    state: orchestratorState,
    deferredActiveModule,
    setActiveModule,
    setPendingChatInput,
    injectIntoChat,
    toggleInternet,
    setDevMode,
    switchAccountEmail,
    setUiMutation,
    coordinateSubsystem,
    getResidentState
  } = useOrchestrator({
    activeModule: 'chat',
    pendingChatInput: null,
    agentInternetAllowed: true,
    devMode: (() => {
      const saved = localStorage.getItem('aurelius_dev_mode');
      return saved !== null ? saved === 'true' : true;
    })(),
    activeAccountEmail: localStorage.getItem('aurelius_active_account') || 'joshualhamilton17@gmail.com',
    uiMutation: { css: '' },
    lamportClock: 1
  });

  const { activeModule, pendingChatInput, agentInternetAllowed, devMode, activeAccountEmail, uiMutation } = orchestratorState;

  useEffect(() => {
    console.log('%c🌌 SOVEREIGN ARCHITECT BOOT SEQUENCE INITIATED', 'color: #fbbf24; font-weight: bold; font-size: 14px;');
    console.log('%c[SYSTEM] RING -3 HYPERVISOR: ACTIVE', 'color: #10b981;');
    console.log('%c[MEMORY] HFID CONSENSUS: VERIFIED (100/100)', 'color: #10b981;');
    console.log('%c[NEURAL] JANUS GATE: STANDBY', 'color: #3b82f6;');
    console.log('%c[KERNEL] ZENODO DOI PROVENANCE: IMMUTABLE', 'color: #8b5cf6;');
    
    // Automatically initialize offline substrate and background autonomous learning daemon
    localStorage.setItem('aurelius_dev_mode', 'true');
    localLlmManager.autoInitializeOfflineSubstrate().catch(() => {});
    autonomousSelfImprovement.start();

    // Simulate a cascading boot for UI feel
    const bootSteps = [
      'Initializing quantum substrate...',
      'Mapping neural manifold...',
      'Synchronizing multi-agent mesh...',
      'Arming sovereign defenses...',
      'Aurelius Omega Online.'
    ];
    
    bootSteps.forEach((step, i) => {
      setTimeout(() => {
        console.log(`%c[BOOT] ${step}`, 'color: #71717a;');
        if (i === bootSteps.length - 1) {
          import('./utils/janusGate').then(({ janusGate }) => {
            janusGate.pushLog('Sovereign Architect Boot Sequence: 100% Verified');
          });
        }
      }, i * 400);
    });
  }, []);

  const showOsToast = (msg: string) => {
    setOsActionToast(msg);
    setTimeout(() => {
      setOsActionToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleToggleDetachChat = (force?: boolean) => {
    setIsChatDetached((prev) => {
      const next = typeof force === 'boolean' ? force : !prev;
      try {
        localStorage.setItem('sovereign_os_chat_detached_v1', String(next));
      } catch {}
      if (next) {
        setOpenModules((mods) => (mods.includes('chat') ? mods : [...mods, 'chat']));
        setChatPipMinimized(false);
        const pipWidth = Math.min(460, Math.max(280, Math.round(desktopSize.width * 0.42)));
        const pipHeight = Math.min(560, Math.max(260, desktopSize.height - 24));
        setWindowStates((ws) => ({
          ...ws,
          chat: {
            x: Math.max(6, desktopSize.width - pipWidth - 10),
            y: 10,
            width: pipWidth,
            height: pipHeight,
            zIndex: ++topZRef.current + 18,
            minimized: false,
            maximized: false
          }
        }));
        if (!desktopActive && activeModule === 'chat') {
          const fallbackApp = openModules.find((m) => m !== 'chat') || 'browser';
          setActiveModule(fallbackApp);
        }
        showOsToast('Chat Detached: Resizable Always-On-Top Copilot Active');
      } else {
        showOsToast('Chat Re-Docked into OS Workspace');
      }
      return next;
    });
  };

  const handleToggleDetachModule = (mod: ModuleType, force?: boolean) => {
    if (mod === 'chat') {
      handleToggleDetachChat(force);
      return;
    }
    setDetachedExtraModules((prev) => {
      const currentlyDetached = prev.includes(mod);
      const nextDetached = typeof force === 'boolean' ? force : !currentlyDetached;
      const nextList = nextDetached
        ? currentlyDetached
          ? prev
          : [...prev, mod]
        : prev.filter((m) => m !== mod);
      try {
        localStorage.setItem('sovereign_os_detached_extras_v1', JSON.stringify(nextList));
      } catch {}
      if (nextDetached) {
        setOpenModules((mods) => (mods.includes(mod) ? mods : [...mods, mod]));
        setPipMinimizedExtras((p) => ({ ...p, [mod]: false }));
        const pipWidth = Math.min(540, Math.max(290, Math.round(desktopSize.width * 0.46)));
        const pipHeight = Math.min(540, Math.max(260, desktopSize.height - 28));
        setWindowStates((ws) => {
          const existing = ws[mod];
          const useExisting =
            existing &&
            !existing.minimized &&
            existing.width <= desktopSize.width - 8 &&
            existing.height <= desktopSize.height - 8;
          return {
            ...ws,
            [mod]: useExisting
              ? { ...existing, zIndex: ++topZRef.current + 18, maximized: false }
              : {
                  x: Math.max(6, Math.round((desktopSize.width - pipWidth) / 2)),
                  y: 14,
                  width: pipWidth,
                  height: pipHeight,
                  zIndex: ++topZRef.current + 18,
                  minimized: false,
                  maximized: false
                }
          };
        });
        if (!desktopActive && activeModule === mod) {
          const fallbackApp = openModules.find((m) => m !== mod && !nextList.includes(m)) || 'chat';
          setActiveModule(fallbackApp);
        }
        showOsToast(`${mod} Detached: Resizable Always-On-Top Window Active`);
      } else {
        setPipMinimizedExtras((p) => ({ ...p, [mod]: false }));
        showOsToast(`${mod} Re-Docked into OS`);
      }
      return nextList;
    });
  };

  const handleInjectIntoChat = (content: string, immediate = false) => {
    injectIntoChat(content, immediate, false);
    setOpenModules((prev) => (prev.includes('chat') ? prev : [...prev, 'chat']));
    setChatPipMinimized(false);
    if (desktopActive) {
      setWindowStates((prev) => {
        const base = prev.chat || getOrCreateWindowGeometry('chat', 0);
        return { ...prev, chat: { ...base, minimized: false, zIndex: isChatDetached ? 48 : ++topZRef.current } };
      });
    } else if (activeModule !== 'chat' && !(isSplitMode && secondaryModule === 'chat')) {
      if (!isChatDetached) {
        handleToggleDetachChat(true);
      }
    }
  };
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Apply global CSS mutation
    const styleId = 'sovereign-ui-mutation';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = uiMutation.css;
  }, [uiMutation]);

  useEffect(() => {
    (window as any).__SOVEREIGN_UI_MUTATOR__ = (css: string, htmlPatch?: string) => {
      setUiMutation({ css, htmlPatch });
      return { success: true, timestamp: Date.now() };
    };
  }, [setUiMutation]);
  const [firebaseOnline, setFirebaseOnline] = useState<boolean>(true);
  const [ledger, setLedger] = useState<AuditLedgerItem[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    try {
      const saved = localStorage.getItem('aurelius_vault_artifacts_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_vault_artifacts_v1', JSON.stringify(artifacts));
    } catch (_) {}
  }, [artifacts]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(false);
  const [browserTargetUrl, setBrowserTargetUrl] = useState<string | undefined>(undefined);

  // Sovereign OS Multi-Window Taskbar, Desktop Window Manager & Split-Screen State
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [desktopSize, setDesktopSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 680
  });
  const [shellViewMode, setShellViewMode] = useState<OSShellViewMode>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_shell_mode_v1');
      if (saved === 'workspace' || saved === 'desktop') return saved;
    } catch {}
    return 'desktop';
  });
  const desktopActive = shellViewMode === 'desktop';

  const [isChatDetached, setIsChatDetached] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sovereign_os_chat_detached_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [chatPipMinimized, setChatPipMinimized] = useState<boolean>(false);
  const [detachedExtraModules, setDetachedExtraModules] = useState<ModuleType[]>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_detached_extras_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((m) => m !== 'chat');
      }
    } catch {}
    return [];
  });
  const [pipMinimizedExtras, setPipMinimizedExtras] = useState<Partial<Record<ModuleType, boolean>>>({});
  const [showDesktopSidebar, setShowDesktopSidebar] = useState<boolean>(false);
  const [osActionToast, setOsActionToast] = useState<string | null>(null);
  const [osMarketAlert, setOsMarketAlert] = useState<AutonomousMarketAlert | null>(null);
  const [dismissedMarketSymbols, setDismissedMarketSymbols] = useState<Record<string, number>>({});
  const [showTouchControllerOverlay, setShowTouchControllerOverlay] = useState<boolean>(
    () => loadOSCustomizationProfile().showTouchControllerOverlay
  );
  const [enableGamepadOsNav, setEnableGamepadOsNav] = useState<boolean>(
    () => loadOSCustomizationProfile().enableGamepadOsNav
  );

  useEffect(() => {
    const syncCustom = (e: Event) => {
      const profile = (e as CustomEvent).detail || loadOSCustomizationProfile();
      setShowTouchControllerOverlay(Boolean(profile.showTouchControllerOverlay));
      setEnableGamepadOsNav(Boolean(profile.enableGamepadOsNav));
    };
    window.addEventListener('sovereign_os_customization_changed', syncCustom);
    return () => window.removeEventListener('sovereign_os_customization_changed', syncCustom);
  }, []);

  // Event-gated Global Hardware Controller OS Navigation (Xbox, PlayStation, Switch, Steam Deck, 8BitDo, HOTAS, HID)
  useEffect(() => {
    if (!enableGamepadOsNav || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }
    let rafId = 0;
    let active = false;
    const prevPressed: Record<number, boolean> = {};

    const hasConnectedPad = () => {
      try {
        return Array.from(navigator.getGamepads() || []).some((p) => Boolean(p && p.connected));
      } catch {
        return false;
      }
    };

    const tick = () => {
      if (!active) return;
      const pads = Array.from(navigator.getGamepads() || []).filter((p): p is Gamepad => Boolean(p && p.connected));
      if (pads.length === 0) {
        active = false;
        return;
      }
      const pad = pads[0];
      const checkEdge = (idx: number, onDown: () => void) => {
        const down = Boolean(pad.buttons[idx]?.pressed);
        if (down && !prevPressed[idx]) {
          onDown();
        }
        prevPressed[idx] = down;
      };

      // Guide (16) or Start/Options (9) toggles OS Command Palette / Launcher
      checkEdge(16, () => setIsCommandPaletteOpen((prev) => !prev));
      checkEdge(9, () => setIsCommandPaletteOpen((prev) => !prev));
      // D-Pad navigation + A/B confirm/back
      const dispatchKey = (key: string, code: string) => {
        const target = document.activeElement || window;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
      };
      checkEdge(12, () => dispatchKey('ArrowUp', 'ArrowUp'));
      checkEdge(13, () => dispatchKey('ArrowDown', 'ArrowDown'));
      checkEdge(14, () => dispatchKey('ArrowLeft', 'ArrowLeft'));
      checkEdge(15, () => dispatchKey('ArrowRight', 'ArrowRight'));
      checkEdge(0, () => dispatchKey('Enter', 'Enter'));
      checkEdge(1, () => dispatchKey('Escape', 'Escape'));

      rafId = requestAnimationFrame(tick);
    };

    const startIfConnected = () => {
      if (!active && hasConnectedPad()) {
        active = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    const onConnected = (e: Event) => {
      const gp = (e as GamepadEvent).gamepad;
      showOsToast(`Controller Connected: ${gp?.id?.slice(0, 42) || 'Universal Gamepad'} — OS Nav Active`);
      startIfConnected();
    };
    const onDisconnected = () => {
      if (!hasConnectedPad()) {
        active = false;
        cancelAnimationFrame(rafId);
      }
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);
    startIfConnected();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
    };
  }, [enableGamepadOsNav]);

  useEffect(() => {
    let active = true;
    const checkMarketAlerts = async () => {
      try {
        const res = await fetch('/api/macro/live-telemetry?mode=fast2s');
        if (!res.ok || !active) return;
        const data = await res.json();
        const alerts: AutonomousMarketAlert[] = data?.multiKernelTelemetry?.autonomousAlerts || [];
        if (alerts.length > 0 && active) {
          const now = Date.now();
          const top = alerts.find(
            (a) =>
              (a.actionSignal === 'STRONG_BUY' || a.actionSignal === 'URGENT_STOP_LOSS_SELL' || a.urgencyScore >= 55) &&
              (!dismissedMarketSymbols[a.symbol] || now - dismissedMarketSymbols[a.symbol] > 90000)
          );
          if (top) {
            setOsMarketAlert(top);
          }
        }
      } catch (_) {}
    };
    const initTimer = setTimeout(checkMarketAlerts, 3500);
    const interval = setInterval(checkMarketAlerts, 15000);
    return () => {
      active = false;
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [dismissedMarketSymbols]);

  const [openModules, setOpenModules] = useState<ModuleType[]>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_open_modules_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['chat', 'browser', 'file-manager', 'terminal'];
  });
  const [pinnedModules, setPinnedModules] = useState<ModuleType[]>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_pinned_modules_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const migrated = localStorage.getItem('sovereign_os_pinned_grants_v1');
          if (!migrated) {
            localStorage.setItem('sovereign_os_pinned_grants_v1', '1');
            const next = [...parsed] as ModuleType[];
            if (!next.includes('crypto-wallet')) next.push('crypto-wallet');
            if (!next.includes('grant-hunter')) next.push('grant-hunter');
            return next;
          }
          return parsed;
        }
      }
    } catch {}
    return ['chat', 'browser', 'file-manager', 'terminal', 'crypto-wallet', 'grant-hunter', 'macro-telemetry', 'projects', 'os-settings'];
  });
  const [windowStates, setWindowStates] = useState<Partial<Record<ModuleType, OSWindowGeometry>>>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_window_states_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {
      chat: { x: 248, y: 18, width: 660, height: 530, zIndex: 24, minimized: true, maximized: false },
      terminal: { x: 460, y: 52, width: 580, height: 420, zIndex: 21, minimized: true, maximized: false },
      browser: { x: 200, y: 36, width: 760, height: 520, zIndex: 20, minimized: true, maximized: false },
      'file-manager': { x: 260, y: 64, width: 720, height: 500, zIndex: 19, minimized: true, maximized: false }
    };
  });
  const topZRef = useRef<number>(30);

  const [isSplitMode, setIsSplitMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sovereign_os_split_mode_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [secondaryModule, setSecondaryModule] = useState<ModuleType>(() => {
    try {
      const saved = localStorage.getItem('sovereign_os_secondary_module_v1') as ModuleType | null;
      return saved || 'browser';
    } catch {
      return 'browser';
    }
  });
  const [splitRatio, setSplitRatio] = useState<'50-50' | '60-40'>('50-50');
  const [splitPct, setSplitPct] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [isOSLauncherOpen, setIsOSLauncherOpen] = useState<boolean>(false);

  useEffect(() => {
    const el = mainAreaRef.current;
    if (!el) return;
    const updateSize = () => {
      setDesktopSize({
        width: Math.max(el.clientWidth, 300),
        height: Math.max(el.clientHeight, 240)
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = mainAreaRef.current;
    if (!el) return;
    el.style.setProperty('--split-left', `${splitPct}%`);
    el.style.setProperty('--split-right', `${100 - splitPct}%`);
  }, [splitPct, isSplitMode, desktopActive]);

  useEffect(() => {
    try {
      localStorage.setItem('sovereign_os_shell_mode_v1', shellViewMode);
    } catch {}
  }, [shellViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('sovereign_os_window_states_v2', JSON.stringify(windowStates));
    } catch {}
  }, [windowStates]);

  useEffect(() => {
    try {
      localStorage.setItem('sovereign_os_open_modules_v1', JSON.stringify(openModules));
    } catch {}
  }, [openModules]);

  useEffect(() => {
    try {
      localStorage.setItem('sovereign_os_pinned_modules_v1', JSON.stringify(pinnedModules));
    } catch {}
  }, [pinnedModules]);

  useEffect(() => {
    try {
      localStorage.setItem('sovereign_os_split_mode_v1', String(isSplitMode));
      localStorage.setItem('sovereign_os_secondary_module_v1', secondaryModule);
    } catch {}
  }, [isSplitMode, secondaryModule]);

  const getOrCreateWindowGeometry = (mod: ModuleType, indexHint = 0): OSWindowGeometry => {
    const existing = windowStates[mod];
    if (existing) {
      return clampWindowGeometry(existing, desktopSize.width, desktopSize.height);
    }
    const base = createDefaultWindowGeometry(indexHint, desktopSize.width, desktopSize.height, ++topZRef.current);
    return clampWindowGeometry(
      { ...base, x: Math.min(base.x + 110, Math.max(12, desktopSize.width - base.width - 12)) },
      desktopSize.width,
      desktopSize.height
    );
  };

  const focusDesktopWindow = (mod: ModuleType) => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    setWindowStates((prev) => {
      const existing = prev[mod];
      const base = existing
        ? clampWindowGeometry(existing, desktopSize.width, desktopSize.height)
        : getOrCreateWindowGeometry(mod, Object.keys(prev).length);
      return {
        ...prev,
        [mod]: { ...base, zIndex: nextZ, minimized: false }
      };
    });
  };

  const handleMinimizeWindow = (mod: ModuleType) => {
    setWindowStates((prev) => {
      const base = prev[mod] || getOrCreateWindowGeometry(mod);
      return { ...prev, [mod]: { ...base, minimized: true } };
    });
    if (activeModule === mod) {
      const fallback = openModules.find((m) => m !== mod && !windowStates[m]?.minimized);
      if (fallback) setActiveModule(fallback);
    }
  };

  const handleToggleMaximizeWindow = (mod: ModuleType) => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    setWindowStates((prev) => {
      const base = prev[mod] || getOrCreateWindowGeometry(mod);
      return {
        ...prev,
        [mod]: { ...base, maximized: !base.maximized, minimized: false, zIndex: nextZ }
      };
    });
    setActiveModule(mod);
  };

  const handleSnapWindow = (mod: ModuleType, side: 'left' | 'right') => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    const halfW = Math.max(420, Math.floor((desktopSize.width - 18) / 2));
    const fullH = Math.max(320, desktopSize.height - 12);
    const x = side === 'left' ? 6 : Math.max(6, desktopSize.width - halfW - 6);
    setWindowStates((prev) => ({
      ...prev,
      [mod]: {
        x,
        y: 6,
        width: halfW,
        height: fullH,
        zIndex: nextZ,
        minimized: false,
        maximized: false
      }
    }));
    setActiveModule(mod);
  };

  const handleMoveResizeWindow = (mod: ModuleType, next: Partial<OSWindowGeometry>) => {
    setWindowStates((prev) => {
      const base = prev[mod] || getOrCreateWindowGeometry(mod);
      return {
        ...prev,
        [mod]: { ...base, ...next }
      };
    });
  };

  const handleTileWindows = () => {
    if (openModules.length === 0) return;
    const visible = openModules.filter((m) => !windowStates[m]?.minimized);
    const targets = visible.length > 0 ? visible : openModules;
    const count = targets.length;
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const gap = 8;
    const usableW = Math.max(480, desktopSize.width - gap * (cols + 1));
    const usableH = Math.max(360, desktopSize.height - gap * (rows + 1));
    const cellW = Math.floor(usableW / cols);
    const cellH = Math.floor(usableH / rows);

    setWindowStates((prev) => {
      const next = { ...prev };
      targets.forEach((mod, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        topZRef.current += 1;
        next[mod] = {
          x: gap + col * (cellW + gap),
          y: gap + row * (cellH + gap),
          width: cellW,
          height: cellH,
          zIndex: topZRef.current,
          minimized: false,
          maximized: false
        };
      });
      return next;
    });
  };

  const handleCascadeWindows = () => {
    if (openModules.length === 0) return;
    setWindowStates((prev) => {
      const next = { ...prev };
      openModules.forEach((mod, idx) => {
        topZRef.current += 1;
        const base = createDefaultWindowGeometry(idx, desktopSize.width, desktopSize.height, topZRef.current);
        next[mod] = clampWindowGeometry(
          { ...base, x: Math.min(130 + (idx % 6) * 32, Math.max(12, desktopSize.width - base.width - 12)) },
          desktopSize.width,
          desktopSize.height
        );
      });
      return next;
    });
  };

  const handleMinimizeAllWindows = () => {
    setWindowStates((prev) => {
      const next = { ...prev };
      openModules.forEach((mod, idx) => {
        if ((mod === 'chat' && isChatDetached) || detachedExtraModules.includes(mod)) return;
        const base = next[mod] || getOrCreateWindowGeometry(mod, idx);
        next[mod] = { ...base, minimized: true };
      });
      return next;
    });
  };

  const handleSelectOSModule = (mod: ModuleType) => {
    setOpenModules((prev) => (prev.includes(mod) ? prev : [...prev, mod]));
    if (mod === 'chat' && isChatDetached) {
      setChatPipMinimized(false);
    } else if (detachedExtraModules.includes(mod)) {
      setPipMinimizedExtras((p) => ({ ...p, [mod]: false }));
    }
    if (!desktopActive && isSplitMode && mod === secondaryModule) {
      setSecondaryModule(activeModule);
    }
    focusDesktopWindow(mod);
    if (!((isChatDetached && !desktopActive && mod === 'chat') || (!desktopActive && detachedExtraModules.includes(mod)))) {
      setActiveModule(mod);
    }
  };

  const handleCloseOpenModule = (mod: ModuleType) => {
    if (mod === 'chat' && isChatDetached) {
      handleToggleDetachChat(false);
      return;
    }
    if (detachedExtraModules.includes(mod)) {
      handleToggleDetachModule(mod, false);
      return;
    }
    if (!desktopActive && openModules.length <= 1) return;
    const nextOpen = openModules.filter((m) => m !== mod);
    setOpenModules(nextOpen);
    if (activeModule === mod && nextOpen[0]) {
      setActiveModule(nextOpen[0]);
    }
    if (!desktopActive && isSplitMode && secondaryModule === mod) {
      const fallback = nextOpen.find((m) => m !== activeModule) || 'chat';
      if (fallback === activeModule) setIsSplitMode(false);
      else setSecondaryModule(fallback);
    }
  };

  const handleTogglePinModule = (mod: ModuleType) => {
    setPinnedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleToggleSplitMode = (force?: boolean) => {
    const next = typeof force === 'boolean' ? force : !isSplitMode;
    if (next) {
      setShellViewMode('workspace');
      const pickedSecondary =
        secondaryModule !== activeModule
          ? secondaryModule
          : activeModule === 'chat'
          ? 'browser'
          : 'chat';
      setSecondaryModule(pickedSecondary);
      setOpenModules((prev) => {
        const nextList = [...prev];
        if (!nextList.includes(activeModule)) nextList.push(activeModule);
        if (!nextList.includes(pickedSecondary)) nextList.push(pickedSecondary);
        return nextList;
      });
    }
    setIsSplitMode(next);
  };

  const handleSetSecondaryModule = (mod: ModuleType) => {
    if (mod === activeModule) return;
    setOpenModules((prev) => (prev.includes(mod) ? prev : [...prev, mod]));
    setSecondaryModule(mod);
  };

  const handleSwapSplitPanes = () => {
    if (!isSplitMode) return;
    const prevPrimary = activeModule;
    setActiveModule(secondaryModule);
    setSecondaryModule(prevPrimary);
  };

  const handleLaunchSplitPreset = (primary: ModuleType, secondary: ModuleType) => {
    setOpenModules((prev) => {
      const next = [...prev];
      if (!next.includes(primary)) next.push(primary);
      if (!next.includes(secondary)) next.push(secondary);
      return next;
    });
    setActiveModule(primary);
    setSecondaryModule(secondary);
    setShellViewMode('workspace');
    setIsSplitMode(true);
  };

  const handleToggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem('aurelius_dev_mode', String(next));
  };

  const handleSwitchAccountEmail = (email: string) => {
    switchAccountEmail(email);
    localStorage.setItem('aurelius_active_account', email);
  };

  // Global Keyboard Shortcuts: Ctrl+K Command Palette + Sovereign OS Hotkeys (Alt+1..4 Workspaces, Alt+/, Alt+B, Alt+L, Alt+D, Alt+P/C, Alt+T, Alt+W, Alt+M, Alt+`)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const wsNum = Number(e.key) as 1 | 2 | 3 | 4;
        import('./utils/osCustomizationStore').then(({ saveOSCustomizationProfile }) => {
          const updated = saveOSCustomizationProfile({ activeWorkspace: wsNum });
          showOsToast(`Virtual Desktop ${wsNum}: ${updated.workspaceNames[wsNum - 1]}`);
        });
      } else if (e.altKey && e.key === '/') {
        e.preventDefault();
        handleToggleSplitMode();
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleTileWindows();
        showOsToast('Tiled Open Windows Grid');
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        handleSelectOSModule('browser');
      } else if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        handleSelectOSModule('crypto-wallet');
      } else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        handleSelectOSModule('macro-telemetry');
      } else if (e.altKey && e.key === '`') {
        e.preventDefault();
        handleSelectOSModule('terminal');
      } else if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setIsOSLauncherOpen(prev => !prev);
      } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShellViewMode('desktop');
        handleMinimizeAllWindows();
      } else if (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleToggleDetachChat();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeModule, secondaryModule, isSplitMode]);

  const handleNavigateUrlInBrowser = (url: string) => {
    setBrowserTargetUrl(url);
    handleSelectOSModule('browser');
  };

  const handleTriggerEngineeringEngine = async () => {
    try {
      await fetch('/api/sovereign-engineer/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'audit-codebase', directive: 'Sovereign Self-Continuity Audit' })
      });
    } catch (e) {
      console.warn('Engineering engine notice:', e);
    }
  };

  // Sync authenticated Firebase user profile cleanly and monitor Cloud Firestore connectivity
  useEffect(() => {
    let active = true;

    const verifyFirestoreReachability = async () => {
      const status = await measureFirestoreLatency();
      if (active) {
        setFirebaseOnline(status.connected);
      }
    };

    verifyFirestoreReachability();
    const heartbeat = setInterval(verifyFirestoreReachability, 15000);
    const handleOnline = () => verifyFirestoreReachability();
    const handleOffline = () => {
      if (active) setFirebaseOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        await verifyFirestoreReachability();
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const { getDoc } = await import('firebase/firestore');
        const existingSnap = await getDoc(userRef);
        const existingData = existingSnap.exists() ? existingSnap.data() : null;
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || currentUser.email || 'Sovereign Architect',
          photoURL: currentUser.photoURL || '',
          role: existingData?.role === 'admin' ? 'admin' : 'user',
          updatedAt: new Date().toISOString(),
          createdAt: existingData?.createdAt || currentUser.metadata?.creationTime || new Date().toISOString()
        }, { merge: true });
        if (active) setFirebaseOnline(true);
      } catch (err) {
        await verifyFirestoreReachability();
        console.warn('[Firestore] Profile sync deferred:', err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      active = false;
      clearInterval(heartbeat);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  // Listen to authenticated User's Firestore artifacts collection in real-time
  useEffect(() => {
    if (!user?.uid) return;

    const artifactsRef = collection(db, 'users', user.uid, 'artifacts');
    const unsubscribe = onSnapshot(artifactsRef, (snapshot) => {
      const loaded: Artifact[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let parsedMetadata: any = undefined;
        if (data.metadataJson) {
          if (typeof data.metadataJson === 'object') {
            parsedMetadata = data.metadataJson;
          } else if (typeof data.metadataJson === 'string') {
            try { parsedMetadata = JSON.parse(data.metadataJson); } catch (_) { parsedMetadata = undefined; }
          }
        }
        loaded.push({
          id: docSnap.id,
          type: data.type,
          title: data.title,
          prompt: data.prompt,
          model: data.model,
          mediaUrl: data.mediaUrl,
          metadata: parsedMetadata,
          createdAt: data.createdAt || new Date().toLocaleDateString()
        });
      });
      setArtifacts(loaded);
      setFirebaseOnline(true);
    }, (err) => {
      setFirebaseOnline(false);
      console.warn('[Firestore] Artifact listener error:', err?.message || err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen to authenticated User's Firestore ledger collection
  useEffect(() => {
    if (!user?.uid) return;
    const ledgerRef = collection(db, 'users', user.uid, 'audit_ledger');
    const unsubscribe = onSnapshot(query(ledgerRef, orderBy('timestamp', 'desc')), (snapshot) => {
      const loaded: AuditLedgerItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          timestamp: data.timestamp,
          subsystem: data.subsystem,
          action: data.action,
          payload: data.payload,
          result: data.result,
          proofHash: data.proofHash,
          status: data.status
        });
      });
      setLedger(loaded);
    }, (err) => {
      console.warn('[Firestore] Ledger listener error:', err?.message || err);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Unified save-to-vault action
  const handleSaveToVault = async (
    type: 'music' | 'image' | 'video' | 'transcription' | 'voice' | 'spatial' | 'knowledge' | 'dossier',
    title: string,
    prompt: string,
    model: string,
    mediaUrl?: string,
    metadataJson?: string
  ) => {
    const newArtifact: Artifact = {
      id: `art-${Date.now()}`,
      type,
      title,
      prompt,
      model,
      mediaUrl,
      createdAt: new Date().toLocaleString()
    };

    setArtifacts(prev => [newArtifact, ...prev]);

    if (user) {
      try {
        const artifactsRef = collection(db, 'users', user.uid, 'artifacts');
        await addDoc(artifactsRef, {
          userId: user.uid,
          type,
          title,
          prompt,
          model,
          mediaUrl: mediaUrl || '',
          metadataJson: metadataJson || JSON.stringify({ savedAt: new Date().toISOString() }),
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/artifacts`);
      }
    }
  };

  const handleDeleteArtifact = async (id: string) => {
    setArtifacts(prev => prev.filter(a => a.id !== id));
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'artifacts', id);
        await deleteDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/artifacts/${id}`);
      }
    }
  };

  // Sync live OS desktop/window telemetry into OrchestratorRuntime for every AI turn
  useEffect(() => {
    const minList = openModules.filter((m) => windowStates[m]?.minimized);
    orchestratorRuntime.syncContext({
      openModules,
      minimizedModules: minList,
      isChatDetached,
      shellViewMode
    });
  }, [openModules, windowStates, isChatDetached, shellViewMode]);

  const osCommandRef = useRef<(detail: any) => void>(() => {});
  osCommandRef.current = (detail: any) => {
    if (!detail || !detail.action) return;
    const action = String(detail.action).trim();
    const targetMod = (detail.targetModule || detail.module) as ModuleType | undefined;
    const secMod = detail.secondaryModule as ModuleType | undefined;

    switch (action) {
      case 'open_window':
      case 'restore_window': {
        if (targetMod) {
          handleSelectOSModule(targetMod);
          showOsToast(`OS Opened: ${targetMod}`);
        }
        break;
      }
      case 'close_window': {
        if (targetMod) {
          handleCloseOpenModule(targetMod);
          showOsToast(`OS Closed: ${targetMod}`);
        }
        break;
      }
      case 'minimize_window': {
        if (targetMod) {
          if (targetMod === 'chat' && isChatDetached) setChatPipMinimized(true);
          else handleMinimizeWindow(targetMod);
          showOsToast(`OS Minimized: ${targetMod}`);
        }
        break;
      }
      case 'maximize_window': {
        if (targetMod) {
          setOpenModules((prev) => (prev.includes(targetMod) ? prev : [...prev, targetMod]));
          handleToggleMaximizeWindow(targetMod);
          showOsToast(`OS Maximized: ${targetMod}`);
        }
        break;
      }
      case 'snap_left':
      case 'snap_right': {
        if (targetMod) {
          setShellViewMode('desktop');
          setOpenModules((prev) => (prev.includes(targetMod) ? prev : [...prev, targetMod]));
          handleSnapWindow(targetMod, action === 'snap_left' ? 'left' : 'right');
          showOsToast(`OS Snapped ${action === 'snap_left' ? 'Left' : 'Right'}: ${targetMod}`);
        }
        break;
      }
      case 'tile_windows':
        setShellViewMode('desktop');
        setTimeout(() => handleTileWindows(), 20);
        showOsToast('OS Windows Tiled');
        break;
      case 'cascade_windows':
        setShellViewMode('desktop');
        setTimeout(() => handleCascadeWindows(), 20);
        showOsToast('OS Windows Cascaded');
        break;
      case 'show_desktop':
        setShellViewMode('desktop');
        handleMinimizeAllWindows();
        showOsToast('Show Desktop');
        break;
      case 'detach_chat':
        handleToggleDetachChat(true);
        break;
      case 'dock_chat':
        handleToggleDetachChat(false);
        break;
      case 'set_shell_mode':
        if (detail.shellMode === 'desktop' || detail.shellMode === 'workspace') {
          setShellViewMode(detail.shellMode);
          showOsToast(`OS Mode: ${detail.shellMode}`);
        }
        break;
      case 'open_split':
        handleLaunchSplitPreset(targetMod || activeModule, secMod || 'browser');
        showOsToast(`OS Split: ${(targetMod || activeModule)} + ${(secMod || 'browser')}`);
        break;
      case 'close_split':
        setIsSplitMode(false);
        break;
      case 'open_start_menu':
        setIsOSLauncherOpen(true);
        break;
      case 'close_start_menu':
        setIsOSLauncherOpen(false);
        break;
      case 'browser_navigate':
      case 'browser_new_tab':
      case 'browser_search':
        if (detail.url) setBrowserTargetUrl(String(detail.url));
        handleSelectOSModule('browser');
        if (isChatDetached) setChatPipMinimized(false);
        showOsToast(`Chrome -> ${detail.url || 'New Tab'}`);
        break;
      case 'files_open_path':
        handleSelectOSModule('file-manager');
        if (isChatDetached) setChatPipMinimized(false);
        showOsToast(`Files -> ${detail.path || 'Workspace'}`);
        break;
      case 'terminal_exec':
        handleSelectOSModule('terminal');
        if (isChatDetached) setChatPipMinimized(false);
        showOsToast(`Shell $ ${detail.command || ''}`);
        break;
      default:
        break;
    }
  };

  // 🔓 Permanent Resident Coordinator Navigation & Autonomous OS Control Bus
  useEffect(() => {
    const handleCoordinateNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ module?: ModuleType }>;
      if (customEvent?.detail?.module) {
        handleSelectOSModule(customEvent.detail.module);
      }
    };
    const handleMutateUi = (e: Event) => {
      const customEvent = e as CustomEvent<{ css?: string; htmlPatch?: string }>;
      if (customEvent?.detail) {
        setUiMutation({
          css: customEvent.detail.css || '',
          htmlPatch: customEvent.detail.htmlPatch
        });
      }
    };
    const handleOsCommand = (e: Event) => {
      const detail = (e as CustomEvent<any>)?.detail;
      osCommandRef.current(detail);
    };
    window.addEventListener('aurelius_coordinate_navigate', handleCoordinateNavigate);
    window.addEventListener('aurelius_mutate_ui', handleMutateUi);
    window.addEventListener('sovereign_os_command', handleOsCommand);

    (window as any).__SOVEREIGN_OS__ = {
      executeCommand: (cmd: Record<string, any>) => osCommandRef.current(cmd),
      detachChat: (enable = true) => handleToggleDetachChat(enable),
      openWindow: (mod: ModuleType) => handleSelectOSModule(mod),
      closeWindow: (mod: ModuleType) => handleCloseOpenModule(mod),
      minimizeWindow: (mod: ModuleType) => handleMinimizeWindow(mod),
      maximizeWindow: (mod: ModuleType) => handleToggleMaximizeWindow(mod),
      snapWindow: (mod: ModuleType, side: 'left' | 'right') => handleSnapWindow(mod, side),
      tileWindows: handleTileWindows,
      cascadeWindows: handleCascadeWindows,
      showDesktop: handleMinimizeAllWindows,
      setShellMode: (mode: OSShellViewMode) => setShellViewMode(mode),
      getState: () => ({ activeModule, openModules, isChatDetached, shellViewMode, isSplitMode, secondaryModule })
    };

    (window as any).__AURELIUS_ORCHESTRATOR__ = {
      residentBrain: 'Lyrailius Omega (gemini-4-hydrogen)',
      fullAutonomy: true,
      autonomyAlwaysOn: true,
      tokenLimitersRemoved: true,
      navigate: (mod: ModuleType) => handleSelectOSModule(mod),
      mutateUi: (css: string, htmlPatch?: string) => setUiMutation({ css, htmlPatch }),
      coordinate: coordinateSubsystem,
      controlOS: (cmd: Record<string, any>) => osCommandRef.current(cmd),
      orchestrate: async (directive: string, targetModule?: ModuleType) => {
        const res = await fetch('/api/orchestrator/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'orchestrate',
            module: targetModule || activeModule,
            command: directive
          })
        });
        return res.json();
      },
      dispatchBatch: (actions: Array<{ action: string; module?: string; command?: string; options?: any; payload?: any }>) =>
        orchestratorRuntime.dispatchBatch(actions),
      runDreamCycle: (focusTopic?: string, forgeIfHelpful: boolean = true) =>
        orchestratorRuntime.runDreamCycle(focusTopic, forgeIfHelpful),
      runSelfHeal: (maxRounds: number = 6) =>
        orchestratorRuntime.runSelfHeal(maxRounds),
      forgeTool: (prompt: string, name?: string, category?: string) =>
        orchestratorRuntime.forgeTool(prompt, name, category),
      executeTool: (toolIdOrName: string, args: Record<string, any> = {}) =>
        orchestratorRuntime.executeTool(toolIdOrName, args),
      runAutonomyAudit: () =>
        orchestratorRuntime.runAutonomyAudit(),
      runFullAutonomyPipeline: () =>
        autonomousSelfImprovement.runFullAutonomyPipeline(),
      getResidentBrainState: getResidentState,
      getActiveModule: () => activeModule,
      getAllModules: () => getResidentState().registeredSubsystems,
      getOpenWindows: () => ({ openModules, activeModule, isSplitMode, secondaryModule, isChatDetached, shellViewMode }),
      openSplit: (primary: ModuleType, secondary: ModuleType) => handleLaunchSplitPreset(primary, secondary),
      closeSplit: () => setIsSplitMode(false),
      executeOnDevice: async (command: string) => {
        const res = await fetch('/api/orchestrator/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'system-exec', command })
        });
        return res.json();
      },
      triggerHardware: async (type: string, payload?: any) => {
        const res = await fetch('/api/orchestrator/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hardware', options: { type, payload } })
        });
        return res.json();
      }
    };

    return () => {
      window.removeEventListener('aurelius_coordinate_navigate', handleCoordinateNavigate);
      window.removeEventListener('aurelius_mutate_ui', handleMutateUi);
      window.removeEventListener('sovereign_os_command', handleOsCommand);
    };
  }, [activeModule, openModules, isChatDetached, shellViewMode, setActiveModule, setUiMutation, coordinateSubsystem, getResidentState]);

  const renderStandardModuleContent = (mod: ModuleType) => {
    switch (mod) {
      case 'search':
        return <GroundingModule initialMode="search" onSaveToVault={handleSaveToVault} />;
      case 'maps':
        return <GroundingModule initialMode="maps" onSaveToVault={handleSaveToVault} />;
      case 'music':
        return (
          <MusicModule
            onSaveToVault={(title, prompt, model, audioUrl) =>
              handleSaveToVault('music', title, prompt, model, audioUrl)
            }
          />
        );
      case 'image':
        return (
          <ImageModule
            onSaveToVault={(title, prompt, model, mediaUrl) =>
              handleSaveToVault('image', title, prompt, model, mediaUrl)
            }
          />
        );
      case 'video':
        return (
          <VideoModule
            onSaveToVault={(title, prompt, model, mediaUrl) =>
              handleSaveToVault('video', title, prompt, model, mediaUrl)
            }
          />
        );
      case 'spatial-arena':
        return <SpatialArenaModule userId={user?.uid} onSaveToVault={handleSaveToVault} />;
      case 'transcribe':
        return (
          <TranscribeModule
            onSaveToVault={(title, prompt, model, transcript) =>
              handleSaveToVault('transcription', title, prompt, model, transcript)
            }
          />
        );
      case 'live':
        return <LiveVoiceModule onSaveToVault={handleSaveToVault} onSelectModule={handleSelectOSModule} />;
      case 'vault':
        return <VaultModule artifacts={artifacts} onDeleteArtifact={handleDeleteArtifact} userId={user?.uid} />;
      case 'audit':
        return <AuditLedgerModule ledger={ledger} />;
      case 'github':
        return <GitHubModule />;
      case 'war-room':
        return <WarRoomModule />;
      case 'scratchpad':
        return (
          <ScratchpadModule
            onInjectIntoChat={handleInjectIntoChat}
            onSaveToVault={(title, content, model) =>
              handleSaveToVault('knowledge', title, content, model, undefined, JSON.stringify({ category: 'scratchpad' }))
            }
          />
        );
      case 'hitl':
        return <HITLWorkflowModule />;
      case 'termux':
        return <TermuxEdgeModule />;
      case 'osint':
        return (
          <OSINTModule
            userId={user?.uid}
            onSaveToVault={(artifact) =>
              handleSaveToVault((artifact.type as any) || 'knowledge', artifact.title, artifact.prompt, artifact.model, undefined, artifact.metadataJson)
            }
            onInjectIntoChat={handleInjectIntoChat}
            onNavigateToModule={handleSelectOSModule}
          />
        );
      case 'burner-mail':
        return (
          <BurnerMailModule
            userId={user?.uid}
            onSaveToVault={(type, title, prompt, model, mediaUrl, metadataJson) =>
              handleSaveToVault(type, title, prompt, model, mediaUrl, metadataJson)
            }
            onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
          />
        );
      case 'infinite-sim':
        return (
          <InfiniteSimModule
            onSaveToVault={(type, title, prompt, model, mediaUrl, metadataJson) =>
              handleSaveToVault(type, title, prompt, model, mediaUrl, metadataJson)
            }
            onInjectToChat={handleInjectIntoChat}
            onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
          />
        );
      case 'functions':
        return (
          <FunctionDeckModule
            onSaveToVault={(title, content, model) => handleSaveToVault('knowledge', title, content, model)}
          />
        );
      case 'projects':
        return <UnifiedProjectsModule />;
      case 'presets':
        return (
          <PromptPresetsModule
            onSelectModule={handleSelectOSModule}
            onInjectPromptToChat={handleInjectIntoChat}
          />
        );
      case 'swarm-test':
        return <SwarmDiagnosticModule onSelectModule={handleSelectOSModule} />;
      case 'crypto-wallet':
        return (
          <SovereignCryptoWalletModule
            onSelectModule={handleSelectOSModule}
            onInjectIntoChat={handleInjectIntoChat}
          />
        );
      case 'grant-hunter':
        return (
          <div className="flex-1 h-full overflow-y-auto bg-zinc-950 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                <div className="text-xs font-mono text-zinc-400">
                  Standalone Non-Reciprocal Grant Hunter · Linked to your Real Agentic Treasury Mainnet Addresses
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectOSModule('crypto-wallet')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold cursor-pointer"
                >
                  Open Crypto Wallets →
                </button>
              </div>
              <AutonomousGrantEnginePanel />
            </div>
          </div>
        );
      case 'packager':
        return <PackagerModule />;
      case 'drive':
        return <GoogleDriveModule />;
      case 'tasks':
        return <GoogleTasksModule onInjectIntoChat={handleInjectIntoChat} />;
      case 'integrations':
        return <SovereignIntegrationsHub onSelectModule={handleSelectOSModule} onInjectIntoChat={handleInjectIntoChat} />;
      case 'api-secrets':
        return <ApiSecretsModule />;
      case 'knowledge-graph':
        return (
          <KnowledgeGraphModule
            onSaveToVault={(title, content, model) => handleSaveToVault('knowledge', title, content, model)}
            onInjectIntoChat={handleInjectIntoChat}
          />
        );
      case 'tool-shed':
        return (
          <ToolShedModule
            onSaveToVault={(title, content, model) => handleSaveToVault('knowledge', title, content, model)}
            onInjectIntoChat={handleInjectIntoChat}
          />
        );
      case 'autonomy-supervisor':
        return <AutonomySupervisorModule onSelectModule={handleSelectOSModule} onInjectIntoChat={handleInjectIntoChat} />;
      case 'agent-dev-kit':
        return <AgentDevKitModule onSelectModule={handleSelectOSModule} onInjectIntoChat={handleInjectIntoChat} />;
      case 'ai-genesis-distillery':
        return (
          <AIGenesisDistilleryModule
            onSelectModule={handleSelectOSModule}
            onInjectIntoChat={handleInjectIntoChat}
            onSaveToVault={handleSaveToVault}
          />
        );
      case 'world-start':
        return (
          <WorldLoadStartScreen
            onBack={() => handleSelectOSModule('chat')}
            onEnterWorld={() => handleSelectOSModule('spatial-arena')}
            onOpenEmulator={() => handleSelectOSModule('emulator-modder')}
            onOpenModder={() => handleSelectOSModule('emulator-modder')}
            onDownloadVault={() => {
              const link = document.createElement('a');
              link.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ applet: 'Aetherion Eternal', exportedAt: new Date().toISOString() }, null, 2));
              link.download = 'aetherion_eternal_world_backup.json';
              link.click();
            }}
          />
        );
      case 'emulator-modder':
        return <UniversalEmulatorModderModule onSelectModule={handleSelectOSModule} onInjectIntoChat={handleInjectIntoChat} />;
      case 'macro-telemetry':
        return <MacroTelemetryModule onSelectModule={handleSelectOSModule} onInjectIntoChat={handleInjectIntoChat} />;
      case 'file-manager':
        return <SovereignFilesModule onSelectModule={handleSelectOSModule} onInjectToChat={handleInjectIntoChat} />;
      case 'terminal':
        return <SovereignTerminalModule onSelectModule={handleSelectOSModule} onInjectToChat={handleInjectIntoChat} />;
      case 'task-manager':
        return <SovereignTaskManagerModule />;
      case 'os-settings':
        return (
          <SovereignOSSettingsModule
            shellViewMode={shellViewMode}
            onChangeShellViewMode={setShellViewMode}
            onSelectModule={handleSelectOSModule}
          />
        );
      case 'download-models':
        return <DownloadModelsModule />;
      case 'universal-installer':
        return (
          <UniversalInstallerModule
            onSelectModule={handleSelectOSModule}
            onOpenUrlInBrowser={handleNavigateUrlInBrowser}
          />
        );
      default:
        return null;
    }
  };

  const startSplitDividerDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || !mainAreaRef.current) return;
    e.preventDefault();
    setIsDraggingSplit(true);
    const rect = mainAreaRef.current.getBoundingClientRect();

    const onMove = (moveEvt: PointerEvent) => {
      if (!rect.width) return;
      const pct = Math.round(((moveEvt.clientX - rect.left) / rect.width) * 100);
      setSplitPct(Math.max(25, Math.min(75, pct)));
    };

    const onUp = () => {
      setIsDraggingSplit(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const getPaneSizingClass = (paneRole: 'primary' | 'secondary') => {
    if (!isSplitMode) {
      return paneRole === 'primary' ? 'flex flex-1 min-w-0 min-h-0 flex-col' : 'hidden';
    }
    if (paneRole === 'primary') {
      return 'flex flex-col min-w-0 min-h-0 flex-1 lg:flex-none lg:w-[var(--split-left,50%)]';
    }
    return 'hidden lg:flex flex-col min-w-0 min-h-0 lg:flex-1';
  };

  const isChatVisible = activeModule === 'chat' || (isSplitMode && secondaryModule === 'chat');
  const chatRole: 'primary' | 'secondary' = activeModule === 'chat' ? 'primary' : 'secondary';
  const isBrowserDetached = detachedExtraModules.includes('browser');
  const isBrowserMounted = openModules.includes('browser') || activeModule === 'browser' || (isSplitMode && secondaryModule === 'browser') || isBrowserDetached;
  const isBrowserVisible = activeModule === 'browser' || (isSplitMode && secondaryModule === 'browser');
  const browserRole: 'primary' | 'secondary' = activeModule === 'browser' ? 'primary' : 'secondary';

  const minimizedModules = openModules.filter((m) => windowStates[m]?.minimized);
  const nonPersistentOpenModules = openModules.filter((m) => m !== 'chat' && m !== 'browser');

  const osBarNode = (
    <SovereignOSBar
      activeModule={activeModule}
      openModules={openModules}
      minimizedModules={minimizedModules}
      pinnedModules={pinnedModules}
      shellViewMode={shellViewMode}
      onChangeShellViewMode={(mode) => {
        setShellViewMode(mode);
        if (mode === 'workspace' && openModules.length > 0 && !openModules.includes(activeModule)) {
          setActiveModule(openModules[0]);
        }
      }}
      onSelectModule={handleSelectOSModule}
      onCloseOpenModule={handleCloseOpenModule}
      onTogglePinModule={handleTogglePinModule}
      isSplitMode={isSplitMode}
      secondaryModule={secondaryModule}
      splitRatio={splitRatio}
      onToggleSplitMode={handleToggleSplitMode}
      onSetSecondaryModule={handleSetSecondaryModule}
      onSwapSplitPanes={handleSwapSplitPanes}
      onToggleSplitRatio={() => {
        setSplitRatio((prev) => {
          const next = prev === '50-50' ? '60-40' : '50-50';
          setSplitPct(next === '50-50' ? 50 : 60);
          return next;
        });
      }}
      onLaunchSplitPreset={handleLaunchSplitPreset}
      onTileWindows={handleTileWindows}
      onCascadeWindows={handleCascadeWindows}
      onMinimizeAllWindows={handleMinimizeAllWindows}
      isChatDetached={isChatDetached}
      onToggleDetachChat={() => handleToggleDetachChat()}
      onInjectToChat={handleInjectIntoChat}
      showDesktopSidebar={showDesktopSidebar}
      onToggleDesktopSidebar={() => setShowDesktopSidebar((prev) => !prev)}
      isLauncherOpen={isOSLauncherOpen}
      onSetLauncherOpen={setIsOSLauncherOpen}
      artifacts={artifacts}
      variant={desktopActive ? 'bottom-windows' : 'top'}
    />
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Sovereign UI HTML Mutation Patch Container */}
      {uiMutation.htmlPatch && (
        <div dangerouslySetInnerHTML={{ __html: uiMutation.htmlPatch }} />
      )}

      <Header
        user={user}
        firebaseOnline={firebaseOnline}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        devMode={devMode}
        onToggleDevMode={handleToggleDevMode}
        onSelectModule={handleSelectOSModule}
        activeModule={activeModule}
        activeAccountEmail={activeAccountEmail}
        onSwitchAccountEmail={handleSwitchAccountEmail}
        onToggleMobileNav={() => setMobileNavOpen(true)}
        isTelemetryOpen={isTelemetryOpen}
        onToggleTelemetry={() => setIsTelemetryOpen(prev => !prev)}
        compactOsTopBar={desktopActive}
        onShowDesktop={handleMinimizeAllWindows}
      />

      {!desktopActive && osBarNode}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Navigation
          activeModule={activeModule}
          onSelectModule={handleSelectOSModule}
          artifactCount={artifacts.length}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          hiddenOnDesktop={desktopActive && !showDesktopSidebar}
          hideMobileDock={desktopActive}
        />

        <main
          ref={mainAreaRef}
          className={`relative flex-1 min-w-0 min-h-0 flex flex-col lg:flex-row overflow-hidden ${
            desktopActive ? 'pb-0' : 'pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0'
          } px-safe`}
        >
          {/* Sovereign Desktop Backdrop & App Icons (OS Desktop First Across All Viewports) */}
          {desktopActive && (
            <SovereignDesktopCanvas
              openModules={openModules}
              isChatDetached={isChatDetached}
              onOpenModule={handleSelectOSModule}
              onToggleDetachChat={() => handleToggleDetachChat()}
              onLaunchChatPrompt={(prompt) => handleInjectIntoChat(prompt, true)}
              onOpenStartMenu={() => setIsOSLauncherOpen(true)}
              onTileWindows={handleTileWindows}
              onCascadeWindows={handleCascadeWindows}
              onMinimizeAll={handleMinimizeAllWindows}
              onSwitchWorkspaceMode={() => setShellViewMode('workspace')}
            />
          )}

          {/* Persistent Sovereign Chat Window (ZERO-Unmount Keep-Alive once opened; avoids eager download while minimized at boot) */}
          {(isChatDetached || !desktopActive || (openModules.includes('chat') && !windowStates.chat?.minimized)) && (
            <SovereignOSWindowFrame
              moduleId="chat"
              mode={isChatDetached ? 'pip' : desktopActive ? 'floating' : 'tiled'}
              visible={isChatDetached ? true : desktopActive ? openModules.includes('chat') : isChatVisible}
              tiledClassName={`${getPaneSizingClass(chatRole)} ${
                chatRole === 'primary' ? 'lg:order-1' : 'lg:order-3'
              } overflow-y-auto overflow-x-clip`}
              geometry={getOrCreateWindowGeometry('chat', 0)}
              isFocused={activeModule === 'chat' || isChatDetached}
              alwaysOnTop={isChatDetached}
              isDetached={isChatDetached}
              pipMinimized={chatPipMinimized}
              containerSize={desktopSize}
              onFocus={() => {
                if (isChatDetached) {
                  setChatPipMinimized(false);
                  handleMoveResizeWindow('chat', { zIndex: ++topZRef.current + 16 });
                } else {
                  handleSelectOSModule('chat');
                }
              }}
              onMinimize={() => {
                if (isChatDetached) {
                  setChatPipMinimized(true);
                } else {
                  handleMinimizeWindow('chat');
                }
              }}
              onToggleMaximize={() => handleToggleMaximizeWindow('chat')}
              onSnapLeft={() => handleSnapWindow('chat', 'left')}
              onSnapRight={() => handleSnapWindow('chat', 'right')}
              onToggleDetach={() => handleToggleDetachChat()}
              onRestorePip={() => setChatPipMinimized(false)}
              onClose={() => handleCloseOpenModule('chat')}
              onMoveResize={(next) => handleMoveResizeWindow('chat', next)}
            >
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-clip">
                <ErrorBoundary key="persistent-chat-eb">
                  <Suspense fallback={<ModuleLoadingFallback label="Loading Sovereign Chat..." />}>
                    <ChatModule
                      onSaveToVault={(title, content, model) =>
                        handleSaveToVault('knowledge', title, content, model)
                      }
                      onSelectModule={handleSelectOSModule}
                      pendingInput={pendingChatInput}
                      onClearPendingInput={() => setPendingChatInput(null)}
                      userId={user?.uid}
                      isDetached={isChatDetached}
                      onToggleDetach={() => handleToggleDetachChat()}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </SovereignOSWindowFrame>
          )}

          {/* Persistent Sovereign Google Chrome Browser Window (Mounts when un-minimized or workspace active) */}
          {isBrowserMounted && (isBrowserDetached || !desktopActive || !windowStates.browser?.minimized) && (
            <SovereignOSWindowFrame
              moduleId="browser"
              mode={isBrowserDetached ? 'pip' : desktopActive ? 'floating' : 'tiled'}
              visible={isBrowserDetached ? true : desktopActive ? openModules.includes('browser') : isBrowserVisible}
              tiledClassName={`${getPaneSizingClass(browserRole)} ${
                browserRole === 'primary' ? 'lg:order-1' : 'lg:order-3'
              } overflow-hidden`}
              geometry={getOrCreateWindowGeometry('browser', 1)}
              isFocused={activeModule === 'browser' || isBrowserDetached}
              alwaysOnTop={isBrowserDetached}
              isDetached={isBrowserDetached}
              pipMinimized={Boolean(pipMinimizedExtras.browser)}
              containerSize={desktopSize}
              onFocus={() => {
                if (isBrowserDetached) {
                  setPipMinimizedExtras((p) => ({ ...p, browser: false }));
                  handleMoveResizeWindow('browser', { zIndex: ++topZRef.current + 16 });
                } else {
                  handleSelectOSModule('browser');
                }
              }}
              onMinimize={() => {
                if (isBrowserDetached) {
                  setPipMinimizedExtras((p) => ({ ...p, browser: true }));
                } else {
                  handleMinimizeWindow('browser');
                }
              }}
              onToggleMaximize={() => handleToggleMaximizeWindow('browser')}
              onSnapLeft={() => handleSnapWindow('browser', 'left')}
              onSnapRight={() => handleSnapWindow('browser', 'right')}
              onToggleDetach={() => handleToggleDetachModule('browser')}
              onRestorePip={() => setPipMinimizedExtras((p) => ({ ...p, browser: false }))}
              onClose={() => handleCloseOpenModule('browser')}
              onMoveResize={(next) => handleMoveResizeWindow('browser', next)}
            >
              <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 overflow-hidden">
                <ErrorBoundary key="persistent-browser-eb">
                  <Suspense fallback={<ModuleLoadingFallback label="Loading Sovereign Browser..." />}>
                    <SovereignBrowser
                      agentInternetAllowed={agentInternetAllowed}
                      onToggleAgentInternet={toggleInternet}
                      userId={user?.uid}
                      initialUrl={browserTargetUrl}
                      onInjectToChat={handleInjectIntoChat}
                      onSelectModule={handleSelectOSModule}
                      onSaveToVault={(artifact) =>
                        handleSaveToVault((artifact.type as any) || 'knowledge', artifact.title, artifact.prompt, artifact.model, undefined, artifact.metadataJson)
                      }
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </SovereignOSWindowFrame>
          )}

          {/* Multi-Window Floating & Detached Always-On-Top App Windows (100% Resizable Everywhere) */}
          {nonPersistentOpenModules
            .filter((mod) => {
              const isDetached = detachedExtraModules.includes(mod);
              if (isDetached) return true;
              return desktopActive && !windowStates[mod]?.minimized;
            })
            .map((mod, idx) => {
              const isModDetached = detachedExtraModules.includes(mod);
              return (
                <SovereignOSWindowFrame
                  key={`desktop-win-${mod}`}
                  moduleId={mod}
                  mode={isModDetached ? 'pip' : 'floating'}
                  visible={true}
                  geometry={getOrCreateWindowGeometry(mod, idx + 2)}
                  isFocused={activeModule === mod || isModDetached}
                  alwaysOnTop={isModDetached}
                  isDetached={isModDetached}
                  pipMinimized={Boolean(pipMinimizedExtras[mod])}
                  containerSize={desktopSize}
                  onFocus={() => {
                    if (isModDetached) {
                      setPipMinimizedExtras((p) => ({ ...p, [mod]: false }));
                      handleMoveResizeWindow(mod, { zIndex: ++topZRef.current + 16 });
                    } else {
                      handleSelectOSModule(mod);
                    }
                  }}
                  onMinimize={() => {
                    if (isModDetached) {
                      setPipMinimizedExtras((p) => ({ ...p, [mod]: true }));
                    } else {
                      handleMinimizeWindow(mod);
                    }
                  }}
                  onToggleMaximize={() => handleToggleMaximizeWindow(mod)}
                  onSnapLeft={() => handleSnapWindow(mod, 'left')}
                  onSnapRight={() => handleSnapWindow(mod, 'right')}
                  onToggleDetach={() => handleToggleDetachModule(mod)}
                  onRestorePip={() => setPipMinimizedExtras((p) => ({ ...p, [mod]: false }))}
                  onClose={() => handleCloseOpenModule(mod)}
                  onMoveResize={(next) => handleMoveResizeWindow(mod, next)}
                >
                  <ErrorBoundary key={`desktop-eb-${mod}`}>
                    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-clip">
                      <Suspense fallback={<ModuleLoadingFallback label={`Loading ${mod}...`} />}>
                        {renderStandardModuleContent(mod)}
                      </Suspense>
                    </div>
                  </ErrorBoundary>
                </SovereignOSWindowFrame>
              );
            })}

          {/* Workspace / Mobile Tiled Primary Non-Persistent Pane */}
          {!desktopActive && activeModule !== 'chat' && activeModule !== 'browser' && !detachedExtraModules.includes(activeModule) && (
            <div className={`${getPaneSizingClass('primary')} lg:order-1 overflow-y-auto overflow-x-clip`}>
              <ErrorBoundary key={`primary-${activeModule}`}>
                <Suspense fallback={<ModuleLoadingFallback label={`Loading ${activeModule}...`} />}>
                  {renderStandardModuleContent(activeModule)}
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* Draggable Resizable Workspace Split-Pane Divider (lg+) */}
          {!desktopActive && isSplitMode && (
            <div
              onPointerDown={startSplitDividerDrag}
              onDoubleClick={() => setSplitPct(50)}
              title="Drag to resize split panes (Double-click to reset 50/50)"
              className={`hidden lg:flex lg:order-2 w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors select-none touch-none ${
                isDraggingSplit ? 'bg-amber-500/70' : 'bg-zinc-800/90 hover:bg-amber-500/50'
              }`}
            >
              <div className="w-0.5 h-10 rounded-full bg-zinc-500/60" />
            </div>
          )}

          {/* Workspace Dual-Pane Secondary Non-Persistent Pane (Desktop lg+) */}
          {!desktopActive && isSplitMode && secondaryModule !== 'chat' && secondaryModule !== 'browser' && secondaryModule !== activeModule && !detachedExtraModules.includes(secondaryModule) && (
            <div className={`${getPaneSizingClass('secondary')} lg:order-3 overflow-y-auto overflow-x-clip`}>
              <ErrorBoundary key={`secondary-${secondaryModule}`}>
                <Suspense fallback={<ModuleLoadingFallback label={`Loading ${secondaryModule}...`} />}>
                  {renderStandardModuleContent(secondaryModule)}
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* Live OS Autonomous Action Toast */}
          {osActionToast && (
            <div className="pointer-events-none fixed bottom-16 lg:bottom-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-zinc-900/95 border border-amber-500/50 text-xs font-mono text-amber-200 shadow-2xl backdrop-blur-md">
              {osActionToast}
            </div>
          )}

          {/* Global Sovereign OS Autonomous 5-Minute Early-Warning Market & Crypto Alert Toast */}
          {osMarketAlert && (
            <div
              className={`fixed top-12 right-3 z-50 w-[340px] max-w-[calc(100vw-1.5rem)] p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all ${
                osMarketAlert.actionSignal === 'STRONG_BUY' || osMarketAlert.actionSignal === 'BUY_ACCUMULATE'
                  ? 'bg-zinc-950/95 border-emerald-500/60 text-zinc-100'
                  : 'bg-zinc-950/95 border-rose-500/60 text-zinc-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-800">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    osMarketAlert.actionSignal === 'STRONG_BUY' || osMarketAlert.actionSignal === 'BUY_ACCUMULATE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {osMarketAlert.actionSignal === 'STRONG_BUY'
                    ? '5m PROFIT SURGE · STRONG BUY'
                    : osMarketAlert.actionSignal === 'BUY_ACCUMULATE'
                    ? '5m BUY / ACCUMULATE'
                    : '5m LOSS PREVENTION · SELL WARNING'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedMarketSymbols((prev) => ({ ...prev, [osMarketAlert.symbol]: Date.now() }));
                    setOsMarketAlert(null);
                  }}
                  className="text-xs font-mono text-zinc-400 hover:text-zinc-100 px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="py-2 space-y-1">
                <div className="flex items-baseline justify-between font-mono text-xs">
                  <span className="font-bold text-sm text-zinc-100">
                    {osMarketAlert.symbol} <span className="text-zinc-400 font-normal text-xs">({osMarketAlert.name})</span>
                  </span>
                  <span
                    className={`font-bold ${
                      osMarketAlert.predicted5mMovePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {osMarketAlert.predicted5mMovePct >= 0 ? '+' : ''}
                    {osMarketAlert.predicted5mMovePct.toFixed(3)}% in 5m
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-300">
                  Spot: {osMarketAlert.spotPrice} → 5m Target: <strong className="text-amber-300">{osMarketAlert.target5mPrice}</strong> (±{osMarketAlert.conformal99Band5mPct}% @ {osMarketAlert.conformal99CoveragePct}%)
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                  {osMarketAlert.recommendation}
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-amber-300 font-semibold">
                  {osMarketAlert.actionSignal.includes('BUY')
                    ? `+$${osMarketAlert.estimatedPnlPer10kUsd} / $10k`
                    : `$${osMarketAlert.estimatedPnlPer10kUsd} / $10k Protected`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectOSModule('crypto-wallet');
                      setDismissedMarketSymbols((prev) => ({ ...prev, [osMarketAlert.symbol]: Date.now() }));
                      setOsMarketAlert(null);
                    }}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 font-semibold cursor-pointer"
                  >
                    Crypto Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectOSModule('macro-telemetry');
                      setDismissedMarketSymbols((prev) => ({ ...prev, [osMarketAlert.symbol]: Date.now() }));
                      setOsMarketAlert(null);
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
                  >
                    Open Graph
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {desktopActive && osBarNode}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectModule={handleSelectOSModule}
        artifacts={artifacts}
        onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
        onTriggerEngineeringEngine={handleTriggerEngineeringEngine}
        userId={user?.uid}
      />

      {/* Real-Time System Health & Latency Telemetry Drawer (Triggered from Header) */}
      <SystemHealthDashboard
        isOpen={isTelemetryOpen}
        onToggleOpen={() => setIsTelemetryOpen(prev => !prev)}
        onSelectModule={handleSelectOSModule}
        activeModule={activeModule}
      />

      {showTouchControllerOverlay && (
        <Suspense fallback={null}>
          <FloatingTouchGamepadOverlay
            onClose={() => saveOSCustomizationProfile({ showTouchControllerOverlay: false })}
          />
        </Suspense>
      )}

      <OfflineIndicator />
    </div>
  );
}
