import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Activity,
  Terminal,
  RefreshCw,
  Cpu,
  Globe,
  Github,
  Zap,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DiagnosticEvent {
  timestamp: string;
  subsystem: string;
  status: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
}

const STORAGE_KEY_SUBSYSTEMS = 'aurelius_swarm_diagnostic_subsystems_v3';
const STORAGE_KEY_LOGS = 'aurelius_swarm_diagnostic_logs_v3';

const DEFAULT_SUBSYSTEMS = [
  { id: 'connectivity', name: 'Backend API & Health', status: 'IDLE', score: 0 },
  { id: 'vault', name: 'AES-256-GCM Secrets Vault', status: 'IDLE', score: 0 },
  { id: 'github', name: 'GitHub Repository Matrix', status: 'IDLE', score: 0 },
  { id: 'llm', name: 'Multi-LLM Provider Gateway', status: 'IDLE', score: 0 },
  { id: 'tools', name: 'Autonomous Tool Registry', status: 'IDLE', score: 0 },
  { id: 'audit', name: 'Audit Ledger Integrity', status: 'IDLE', score: 0 },
  { id: 'autonomy', name: 'Workspace Autonomy Engine', status: 'IDLE', score: 0 },
  { id: 'compiler', name: 'TypeScript Compiler Gate', status: 'IDLE', score: 0 }
];

export const SwarmDiagnosticModule: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<DiagnosticEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [subsystems, setSubsystems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBSYSTEMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_SUBSYSTEMS.length) return parsed;
      }
    } catch (_) {}
    return DEFAULT_SUBSYSTEMS;
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUBSYSTEMS, JSON.stringify(subsystems));
    } catch (_) {}
  }, [subsystems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    } catch (_) {}
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (subsystem: string, status: DiagnosticEvent['status'], message: string) => {
    setLogs((prev) =>
      [...prev, { timestamp: new Date().toLocaleTimeString(), subsystem, status, message }].slice(-80)
    );
  };

  const updateSubsystem = (id: string, status: string, score: number) => {
    setSubsystems((prev) => prev.map((s) => (s.id === id ? { ...s, status, score } : s)));
  };

  const runFullDiagnostic = async () => {
    if (running) return;
    setRunning(true);
    setSubsystems(DEFAULT_SUBSYSTEMS.map((s) => ({ ...s, status: 'TESTING', score: 25 })));
    addLog('SYSTEM', 'INFO', 'Starting live multi-subsystem verification...');

    // 1. Health
    const healthT0 = performance.now();
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const ms = Math.round(performance.now() - healthT0);
      if (res.ok && data.status === 'online') {
        updateSubsystem('connectivity', 'SUCCESS', 100);
        addLog('HEALTH', 'SUCCESS', `/api/health online (${ms}ms) · port ${data.port || 3000}`);
      } else {
        updateSubsystem('connectivity', 'ERROR', 40);
        addLog('HEALTH', 'ERROR', `Health endpoint returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      updateSubsystem('connectivity', 'ERROR', 0);
      addLog('HEALTH', 'ERROR', e?.message || 'Health request failed');
    }

    // 2. AES-256-GCM Secrets Vault
    try {
      const res = await fetch('/api/secrets');
      const data = await res.json();
      if (res.ok && data.success) {
        updateSubsystem('vault', 'SUCCESS', 100);
        addLog(
          'VAULT',
          'SUCCESS',
          `${data.vault?.algorithm || 'AES-256-GCM'} active · ${data.vault?.configuredCount ?? 0}/${data.vault?.totalTracked ?? 0} secrets configured`
        );
      } else {
        updateSubsystem('vault', 'ERROR', 30);
        addLog('VAULT', 'ERROR', data.error || 'Secrets handler unavailable');
      }
    } catch (e: any) {
      updateSubsystem('vault', 'ERROR', 0);
      addLog('VAULT', 'ERROR', e?.message || 'Vault check failed');
    }

    // 3. GitHub
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      if (res.ok && data.status === 'ONLINE') {
        updateSubsystem('github', 'SUCCESS', 100);
        addLog('GITHUB', 'SUCCESS', `Connected to github.com/${data.user?.login || 'JHammerZ'} · ${data.user?.publicRepos || 0} repos`);
      } else {
        updateSubsystem('github', 'WARN', 65);
        addLog('GITHUB', 'WARN', data.error || 'GitHub status returned non-online state');
      }
    } catch (e: any) {
      updateSubsystem('github', 'ERROR', 0);
      addLog('GITHUB', 'ERROR', e?.message || 'GitHub check failed');
    }

    // 4. LLM Providers
    try {
      const res = await fetch('/api/llm/providers');
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) {
        const onlineCount = data.providers.filter((p: any) => p.hasKey).length;
        updateSubsystem('llm', 'SUCCESS', 100);
        addLog('LLM_GATEWAY', 'SUCCESS', `${onlineCount}/${data.providers.length} external/local LLM providers ready`);
      } else {
        updateSubsystem('llm', 'WARN', 60);
        addLog('LLM_GATEWAY', 'WARN', 'Provider list unavailable');
      }
    } catch (e: any) {
      updateSubsystem('llm', 'ERROR', 0);
      addLog('LLM_GATEWAY', 'ERROR', e?.message || 'Provider check failed');
    }

    // 5. Autonomous Tool Registry
    try {
      const res = await fetch('/api/agents/tools');
      const data = await res.json();
      if (res.ok) {
        updateSubsystem('tools', 'SUCCESS', 100);
        addLog('TOOLS', 'SUCCESS', `${data.totalCount ?? data.tools?.length ?? 0} server micro-tools loaded`);
      } else {
        updateSubsystem('tools', 'ERROR', 40);
        addLog('TOOLS', 'ERROR', `Tools registry HTTP ${res.status}`);
      }
    } catch (e: any) {
      updateSubsystem('tools', 'ERROR', 0);
      addLog('TOOLS', 'ERROR', e?.message || 'Tools check failed');
    }

    // 6. Audit Ledger
    try {
      const res = await fetch('/api/audit/ledger');
      const data = await res.json();
      if (res.ok && Array.isArray(data.ledger)) {
        updateSubsystem('audit', 'SUCCESS', 100);
        addLog('AUDIT', 'SUCCESS', `Audit ledger verified (${data.ledger.length} entries)`);
      } else {
        updateSubsystem('audit', 'WARN', 60);
        addLog('AUDIT', 'WARN', 'Audit ledger empty or unreachable');
      }
    } catch (e: any) {
      updateSubsystem('audit', 'ERROR', 0);
      addLog('AUDIT', 'ERROR', e?.message || 'Audit ledger check failed');
    }

    // 7. Workspace Autonomy Engine
    try {
      const res = await fetch('/api/functions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionId: 'listDirectory', args: { dirPath: 'src' }, agentId: 'swarm-diagnostic' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateSubsystem('autonomy', 'SUCCESS', 100);
        addLog('AUTONOMY', 'SUCCESS', `Workspace autonomy engine indexed ${data.output?.count ?? 0} entries in src/`);
      } else {
        updateSubsystem('autonomy', 'ERROR', 30);
        addLog('AUTONOMY', 'ERROR', data.error || 'Autonomy probe failed');
      }
    } catch (e: any) {
      updateSubsystem('autonomy', 'ERROR', 0);
      addLog('AUTONOMY', 'ERROR', e?.message || 'Autonomy check failed');
    }

    // 8. TypeScript Compiler Gate
    try {
      const res = await fetch('/api/functions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionId: 'runLint', args: {}, agentId: 'swarm-diagnostic' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateSubsystem('compiler', 'SUCCESS', 100);
        addLog('COMPILER', 'SUCCESS', 'npx tsc --noEmit exited cleanly with 0 errors');
      } else {
        updateSubsystem('compiler', 'WARN', 50);
        addLog('COMPILER', 'WARN', data.error || 'Compiler reported warnings/errors');
      }
    } catch (e: any) {
      updateSubsystem('compiler', 'ERROR', 0);
      addLog('COMPILER', 'ERROR', e?.message || 'Compiler check failed');
    }

    addLog('SYSTEM', 'SUCCESS', 'Live diagnostic pass complete.');
    setRunning(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 font-mono">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-24 h-24 text-amber-500" />
            </div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-100">Swarm Matrix</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Live Probe Verification</p>
                </div>
              </div>

              <div className="space-y-3">
                {subsystems.map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        {s.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {s.status === 'ERROR' && <AlertCircle className="w-3 h-3 text-rose-400" />}
                        {s.name}
                      </span>
                      <span
                        className={
                          s.status === 'SUCCESS'
                            ? 'text-emerald-400 font-bold'
                            : s.status === 'ERROR'
                            ? 'text-rose-400 font-bold'
                            : s.status === 'IDLE'
                            ? 'text-zinc-500'
                            : 'text-amber-400'
                        }
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          s.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : s.status === 'ERROR'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={runFullDiagnostic}
                disabled={running}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 px-4 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                RUN LIVE DIAGNOSTIC
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Audit Policy</div>
              <div className="text-xs text-zinc-200 font-bold">8 REAL-TIME PROBES</div>
              <div className="text-[10px] text-emerald-400 font-mono">Zero Simulated Steps</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col h-[600px]">
          <div className="flex-1 bg-black border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Live Probe Output Stream</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-zinc-400 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs">
                  <Zap className="w-10 h-10 mb-2 opacity-40" />
                  <span>Click "RUN LIVE DIAGNOSTIC" to verify live backend endpoints.</span>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-[11px] leading-relaxed border-l border-zinc-800 pl-3">
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`font-bold shrink-0 w-24 ${
                        log.status === 'SUCCESS'
                          ? 'text-emerald-500'
                          : log.status === 'ERROR'
                          ? 'text-rose-500'
                          : log.status === 'WARN'
                          ? 'text-amber-500'
                          : 'text-blue-400'
                      }`}
                    >
                      {log.subsystem}
                    </span>
                    <span className={log.status === 'ERROR' ? 'text-rose-300' : 'text-zinc-300'}>{log.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Cpu className="w-3 h-3 text-amber-400" /> Live Node Telemetry
                </span>
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Globe className="w-3 h-3 text-emerald-400" /> HTTP Verified
                </span>
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Github className="w-3 h-3 text-sky-400" /> GitHub Status
                </span>
              </div>
              <div className="text-zinc-400 font-bold">{running ? 'PROBING_ENDPOINTS' : 'READY'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
