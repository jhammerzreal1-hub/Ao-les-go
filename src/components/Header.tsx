import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  LogIn,
  LogOut,
  Cpu,
  Search,
  Terminal,
  Users,
  Key,
  ChevronDown,
  FolderGit2,
  ShieldCheck,
  BookOpen,
  Menu,
  Activity
} from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut, type User } from '../firebase';
import { SystemManualModal } from './SystemManualModal';
import { PWAInstallButton } from './PWAInstallButton';
import { getModuleMeta } from './Navigation';
import type { ModuleType } from '../types';

export interface ConnectedAccount {
  email: string;
  role: string;
  clearance: string;
  status: string;
  badgeColor: string;
}

export const FEDERATED_ACCOUNTS: ConnectedAccount[] = [
  {
    email: 'joshualhamilton17@gmail.com',
    role: 'Master Architect & Genesis Owner',
    clearance: 'Root UID 0 (Genesis Sovereign)',
    status: 'LINKED & VERIFIED',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  },
  {
    email: 'JHammerZreal@gmail.com',
    role: 'Executive Sovereign & Lead Engineer',
    clearance: 'God Token Level 5 (Orchestrator Apex)',
    status: 'LINKED & VERIFIED',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
  },
  {
    email: 'jhammerztemp@gmail.com',
    role: 'Operational Session Identity',
    clearance: 'Standard Session Layer',
    status: 'ACTIVE RUNTIME',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  }
];

interface HeaderProps {
  user: User | null;
  onOpenAuth?: () => void;
  firebaseOnline: boolean;
  onOpenCommandPalette?: () => void;
  devMode?: boolean;
  onToggleDevMode?: () => void;
  onSelectModule?: (module: ModuleType) => void;
  activeModule?: ModuleType;
  activeAccountEmail?: string;
  onSwitchAccountEmail?: (email: string) => void;
  onToggleMobileNav?: () => void;
  isTelemetryOpen?: boolean;
  onToggleTelemetry?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  firebaseOnline,
  onOpenCommandPalette,
  devMode = true,
  onToggleDevMode,
  onSelectModule,
  activeModule = 'chat',
  activeAccountEmail = 'joshualhamilton17@gmail.com',
  onSwitchAccountEmail,
  onToggleMobileNav,
  isTelemetryOpen = false,
  onToggleTelemetry
}) => {
  const [authLoading, setAuthLoading] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [activePort, setActivePort] = useState<number>(3000);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeMeta = getModuleMeta(activeModule);
  const ActiveModuleIcon = activeMeta.icon;

  useEffect(() => {
    const checkPort = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data?.port) setActivePort(data.port);
        }
      } catch (_) {}
    };
    checkPort();
    const interval = setInterval(checkPort, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOpenManual = () => setShowManualModal(true);
    window.addEventListener('open-system-manual', handleOpenManual);
    return () => window.removeEventListener('open-system-manual', handleOpenManual);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
      setShowAccountMenu(false);
    } catch (err: any) {
      console.warn('Google sign-in popup note:', err?.message || err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowAccountMenu(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const accountShortName = user?.displayName || activeAccountEmail.split('@')[0];

  return (
    <header className="h-14 shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl px-3 sm:px-4 z-40">
      <div className="h-full w-full flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Drawer Trigger + Brand + Active Module Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleMobileNav && (
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="lg:hidden p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Open workspace navigation"
              title="Open Workspace Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectModule?.('chat')}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-100 truncate">
              Lysander Genesis Orchestrator
            </span>
          </button>

          {/* Active Workspace Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 pl-2 border-l border-zinc-800 min-w-0">
            <ActiveModuleIcon className={`w-3.5 h-3.5 shrink-0 ${activeMeta.accentColor}`} />
            <span className="font-medium text-zinc-200 truncate">{activeMeta.label}</span>
          </div>
        </div>

        {/* Right: Single-Row Workspace Utilities & Account Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Command (Ctrl+K) */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Open Command Palette (Ctrl+K or ⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-medium">Command</span>
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.2 rounded bg-zinc-950 text-[10px] font-mono text-zinc-400 border border-zinc-800">
                Ctrl K
              </kbd>
            </button>
          )}

          {/* System Telemetry & UID 0 / Ring -3 Drawer Trigger */}
          {onToggleTelemetry && (
            <button
              type="button"
              onClick={onToggleTelemetry}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono border transition-colors cursor-pointer whitespace-nowrap ${
                isTelemetryOpen
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title={`Telemetry HUD · PORT ${activePort} · UID 0 Root Clearance · Ring -3 Bare-Metal Hypervisor`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline font-semibold tabular-nums">
                UID 0 · Ring -3
              </span>
              <span className="hidden sm:inline xl:hidden font-medium">Telemetry</span>
            </button>
          )}

          {/* System Manual */}
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 transition-colors cursor-pointer"
            title="Open Complete System Manual & Documentation"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline font-medium">Manual</span>
          </button>

          {/* Direct Sign-In button when signed out */}
          {!user && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="hidden sm:flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authLoading ? 'Connecting...' : 'Sign In'}</span>
            </button>
          )}

          {/* Unified Workspace & Identity Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowAccountMenu(prev => !prev)}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg p-1 pr-2 text-xs text-zinc-200 transition-colors cursor-pointer"
              title="Workspace Settings, Federated Accounts & Dev Mode"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Avatar'}
                  className="w-6 h-6 rounded-md object-cover border border-amber-500/30"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[11px] border border-amber-500/30">
                  {accountShortName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden lg:inline font-medium max-w-[110px] truncate">
                {accountShortName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {showAccountMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl p-2 space-y-1.5 z-50 text-xs">
                {/* Identity Summary */}
                <div className="px-2.5 py-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-100 truncate">
                      {user ? (user.displayName || user.email) : 'Sovereign Session'}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 tabular-nums shrink-0">
                      :{activePort}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="truncate font-mono">{activeAccountEmail}</span>
                    <span className={firebaseOnline ? 'text-emerald-400' : 'text-amber-400'}>
                      {firebaseOnline ? 'Synced' : 'Local'}
                    </span>
                  </div>
                </div>

                {/* Dev Mode Toggle */}
                {onToggleDevMode && (
                  <button
                    type="button"
                    onClick={onToggleDevMode}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dev Mode (UID 0 · Offline)</span>
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${devMode ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {devMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                )}

                {/* Federated Accounts Modal */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    setShowAccountsModal(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Federated Identities</span>
                  </span>
                  <span className="font-mono text-[10px] text-cyan-400 tabular-nums">
                    {FEDERATED_ACCOUNTS.length}
                  </span>
                </button>

                {/* API Keys & Secrets */}
                {onSelectModule && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onSelectModule('api-secrets');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <span>API Keys & Secrets Vault</span>
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">AES-256</span>
                  </button>
                )}

                {/* PWA Install */}
                <PWAInstallButton variant="menu" onAction={() => setShowAccountMenu(false)} />

                {/* Sign In / Sign Out */}
                <div className="pt-1 border-t border-zinc-800/80">
                  {user ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{authLoading ? 'Connecting...' : 'Sign In with Google'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sovereign Federated Accounts Modal */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Sovereign Account Federation</h3>
                  <p className="text-xs text-zinc-400">Connected Accounts & Multi-Identity Mesh</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountsModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-lg px-2 py-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Joshua Hamilton's sovereign identities are linked into a single unified orchestrator. All projects, cryptographic Immutable seals, and offline LLM sessions synchronize across these verified identities:
            </p>

            <div className="space-y-2.5">
              {FEDERATED_ACCOUNTS.map((acc) => {
                const isSelected = activeAccountEmail === acc.email;
                return (
                  <div
                    key={acc.email}
                    onClick={() => {
                      if (onSwitchAccountEmail) onSwitchAccountEmail(acc.email);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-zinc-800/90 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-100 break-all">{acc.email}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            ACTIVE PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{acc.role}</div>
                      <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{acc.clearance}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${acc.badgeColor}`}>
                        {acc.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(acc.email);
                          setCopiedAccount(acc.email);
                          setTimeout(() => setCopiedAccount(null), 1500);
                        }}
                        className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                      >
                        {copiedAccount === acc.email ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowAccountsModal(false);
                  if (onSelectModule) onSelectModule('projects');
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <FolderGit2 className="w-4 h-4" />
                <span>Open Unified Projects Consolidator</span>
              </button>

              <button
                onClick={() => setShowAccountsModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Manual / README Modal */}
      <SystemManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSelectModule={onSelectModule}
      />
    </header>
  );
};
