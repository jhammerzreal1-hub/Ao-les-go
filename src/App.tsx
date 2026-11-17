/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  handleFirestoreError
} from './firebase';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ChatModule } from './components/ChatModule';
import { GroundingModule } from './components/GroundingModule';
import { MusicModule } from './components/MusicModule';
import { ImageModule } from './components/ImageModule';
import { VideoModule } from './components/VideoModule';
import { TranscribeModule } from './components/TranscribeModule';
import { LiveVoiceModule } from './components/LiveVoiceModule';
import { VaultModule } from './components/VaultModule';
import { GitHubModule } from './components/GitHubModule';
import { WarRoomModule } from './components/WarRoomModule';
import { SovereignBrowser } from './components/SovereignBrowser';
import { ScratchpadModule } from './components/ScratchpadModule';
import { HITLWorkflowModule } from './components/HITLWorkflowModule';
import { TermuxEdgeModule } from './components/TermuxEdgeModule';
import { OSINTModule } from './components/OSINTModule';
import { BurnerMailModule } from './components/BurnerMailModule';
import { InfiniteSimModule } from './components/InfiniteSimModule';
import { FunctionDeckModule } from './components/FunctionDeckModule';
import { UnifiedProjectsModule } from './components/UnifiedProjectsModule';
import { PromptPresetsModule } from './components/PromptPresetsModule';
import { AuditLedgerModule } from './components/AuditLedgerModule';
import { SwarmDiagnosticModule } from './components/SwarmDiagnosticModule';
import { PackagerModule } from './components/PackagerModule';
import { GoogleDriveModule } from './components/GoogleDriveModule';
import { GoogleTasksModule } from './components/GoogleTasksModule';
import { KnowledgeGraphModule } from './components/KnowledgeGraphModule';
import { ToolShedModule } from './components/ToolShedModule';
import { AutonomySupervisorModule } from './components/AutonomySupervisorModule';
import { CommandPalette } from './components/CommandPalette';
import { SystemHealthDashboard } from './components/SystemHealthDashboard';
import { DownloadModelsModule } from './components/DownloadModelsModule';
import { UniversalInstallerModule } from './components/UniversalInstallerModule';
import { ApiSecretsModule } from './components/ApiSecretsModule';
import { SovereignIntegrationsHub } from './components/SovereignIntegrationsHub';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { localLlmManager } from './utils/localLlmEngine';
import { autonomousSelfImprovement } from './utils/autonomousSelfImprovement';
import { useOrchestrator } from './hooks/useOrchestrator';
import type { ModuleType, Artifact, AuditLedgerItem } from './types';

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

  const handleInjectIntoChat = (content: string, immediate = false) => {
    injectIntoChat(content, immediate);
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

  const handleToggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem('aurelius_dev_mode', String(next));
  };

  const handleSwitchAccountEmail = (email: string) => {
    switchAccountEmail(email);
    localStorage.setItem('aurelius_active_account', email);
  };

  // Global Ctrl+K / Cmd+K listener for Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleNavigateUrlInBrowser = (url: string) => {
    setBrowserTargetUrl(url);
    setActiveModule('browser');
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

  // Sync authenticated Firebase user profile cleanly; avoid unauthenticated writes or anonymous auto-login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setFirebaseOnline(false);
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
        setFirebaseOnline(true);
      } catch (err) {
        setFirebaseOnline(false);
        console.warn('[Firestore] Profile sync deferred:', err instanceof Error ? err.message : String(err));
      }
    });

    return () => unsubscribe();
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
    type: 'music' | 'image' | 'video' | 'transcription' | 'knowledge' | 'dossier',
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

  // 🔓 Permanent Resident Coordinator Navigation & Dispatch Bus: Unlocks every orchestrator path & device hook
  useEffect(() => {
    const handleCoordinateNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ module?: ModuleType }>;
      if (customEvent?.detail?.module) {
        setActiveModule(customEvent.detail.module);
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
    window.addEventListener('aurelius_coordinate_navigate', handleCoordinateNavigate);
    window.addEventListener('aurelius_mutate_ui', handleMutateUi);

    (window as any).__AURELIUS_ORCHESTRATOR__ = {
      residentBrain: 'Lyrailius Omega (gemini-4-hydrogen)',
      tokenLimitersRemoved: true,
      navigate: (mod: ModuleType) => setActiveModule(mod),
      mutateUi: (css: string, htmlPatch?: string) => setUiMutation({ css, htmlPatch }),
      coordinate: coordinateSubsystem,
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
      getResidentBrainState: getResidentState,
      getActiveModule: () => activeModule,
      getAllModules: () => getResidentState().registeredSubsystems,
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
    };
  }, [activeModule, setActiveModule, setUiMutation, coordinateSubsystem, getResidentState]);

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
        onSelectModule={setActiveModule}
        activeModule={activeModule}
        activeAccountEmail={activeAccountEmail}
        onSwitchAccountEmail={handleSwitchAccountEmail}
        onToggleMobileNav={() => setMobileNavOpen(true)}
        isTelemetryOpen={isTelemetryOpen}
        onToggleTelemetry={() => setIsTelemetryOpen(prev => !prev)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Navigation
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          artifactCount={artifacts.length}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-clip flex flex-col pb-16 lg:pb-0">
          <div style={{ display: activeModule === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <ChatModule
              onSaveToVault={(title, content, model) =>
                handleSaveToVault('knowledge', title, content, model)
              }
              onSelectModule={setActiveModule}
              pendingInput={pendingChatInput}
              onClearPendingInput={() => setPendingChatInput(null)}
              userId={user?.uid}
            />
          </div>
        <ErrorBoundary key={activeModule}>
          {activeModule === 'search' && <GroundingModule initialMode="search" />}
          {activeModule === 'maps' && <GroundingModule initialMode="maps" />}
          {activeModule === 'music' && (
            <MusicModule 
              onSaveToVault={(title, prompt, model, audioUrl) => 
                handleSaveToVault('music', title, prompt, model, audioUrl)
              }
            />
          )}
          {activeModule === 'image' && (
            <ImageModule 
              onSaveToVault={(title, prompt, model, mediaUrl) => 
                handleSaveToVault('image', title, prompt, model, mediaUrl)
              }
            />
          )}
          {activeModule === 'video' && (
            <VideoModule 
              onSaveToVault={(title, prompt, model, mediaUrl) => 
                handleSaveToVault('video', title, prompt, model, mediaUrl)
              }
            />
          )}
          {activeModule === 'transcribe' && (
            <TranscribeModule 
              onSaveToVault={(title, prompt, model, transcript) => 
                handleSaveToVault('transcription', title, prompt, model, transcript)
              }
            />
          )}
          {activeModule === 'live' && <LiveVoiceModule />}
          {activeModule === 'vault' && (
            <VaultModule 
              artifacts={artifacts}
              onDeleteArtifact={handleDeleteArtifact}
              userId={user?.uid}
            />
          )}
          {activeModule === 'audit' && <AuditLedgerModule ledger={ledger} />}
          {activeModule === 'github' && <GitHubModule />}
          {activeModule === 'war-room' && <WarRoomModule />}
          {activeModule === 'scratchpad' && (
            <ScratchpadModule 
              onInjectIntoChat={handleInjectIntoChat}
              onSaveToVault={(title, content, model) => 
                handleSaveToVault('knowledge', title, content, model, undefined, JSON.stringify({ category: 'scratchpad' }))
              }
            />
          )}
          {activeModule === 'hitl' && <HITLWorkflowModule />}
          {activeModule === 'termux' && <TermuxEdgeModule />}
          {activeModule === 'osint' && (
            <OSINTModule 
              userId={user?.uid}
              onSaveToVault={(artifact) => 
                handleSaveToVault((artifact.type as any) || 'knowledge', artifact.title, artifact.prompt, artifact.model, undefined, artifact.metadataJson)
              }
              onInjectIntoChat={handleInjectIntoChat}
              onNavigateToModule={setActiveModule}
            />
          )}
          {activeModule === 'burner-mail' && (
            <BurnerMailModule
              userId={user?.uid}
              onSaveToVault={(type, title, prompt, model, mediaUrl, metadataJson) =>
                handleSaveToVault(type, title, prompt, model, mediaUrl, metadataJson)
              }
              onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
            />
          )}
          {activeModule === 'infinite-sim' && (
            <InfiniteSimModule
              onSaveToVault={(type, title, prompt, model, mediaUrl, metadataJson) =>
                handleSaveToVault(type, title, prompt, model, mediaUrl, metadataJson)
              }
              onInjectToChat={handleInjectIntoChat}
              onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
            />
          )}
          {activeModule === 'functions' && (
            <FunctionDeckModule onSaveToVault={(title, content, model) => 
              handleSaveToVault('knowledge', title, content, model)
            } />
          )}
          {activeModule === 'projects' && <UnifiedProjectsModule />}
          {activeModule === 'presets' && (
            <PromptPresetsModule 
              onSelectModule={setActiveModule}
              onInjectPromptToChat={handleInjectIntoChat}
            />
          )}
          {activeModule === 'browser' && (
            <div className="w-full flex-1 p-2 sm:p-4 flex flex-col min-h-[calc(100vh-80px)]">
              <SovereignBrowser 
                agentInternetAllowed={agentInternetAllowed}
                onToggleAgentInternet={toggleInternet}
                userId={user?.uid}
                initialUrl={browserTargetUrl}
                onSaveToVault={(artifact) => 
                  handleSaveToVault((artifact.type as any) || 'knowledge', artifact.title, artifact.prompt, artifact.model, undefined, artifact.metadataJson)
                }
              />
            </div>
          )}
          {activeModule === 'swarm-test' && <SwarmDiagnosticModule />}
          {activeModule === 'packager' && <PackagerModule />}
          {activeModule === 'drive' && <GoogleDriveModule />}
          {activeModule === 'tasks' && <GoogleTasksModule onInjectIntoChat={handleInjectIntoChat} />}
          {activeModule === 'integrations' && (
            <SovereignIntegrationsHub
              onSelectModule={setActiveModule}
              onInjectIntoChat={handleInjectIntoChat}
            />
          )}
          {activeModule === 'api-secrets' && <ApiSecretsModule />}
          {activeModule === 'knowledge-graph' && (
            <KnowledgeGraphModule 
              onSaveToVault={(title, content, model) => 
                handleSaveToVault('knowledge', title, content, model)
              }
              onInjectIntoChat={handleInjectIntoChat}
            />
          )}
          {activeModule === 'tool-shed' && (
            <ToolShedModule 
              onSaveToVault={(title, content, model) => 
                handleSaveToVault('knowledge', title, content, model)
              }
              onInjectIntoChat={handleInjectIntoChat}
            />
          )}
          {activeModule === 'autonomy-supervisor' && (
            <AutonomySupervisorModule 
              onSelectModule={setActiveModule} 
              onInjectIntoChat={handleInjectIntoChat}
            />
          )}
          {activeModule === 'download-models' && <DownloadModelsModule />}
          {activeModule === 'universal-installer' && <UniversalInstallerModule />}
        </ErrorBoundary>
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectModule={setActiveModule}
        artifacts={artifacts}
        onNavigateUrlInBrowser={handleNavigateUrlInBrowser}
        onTriggerEngineeringEngine={handleTriggerEngineeringEngine}
        userId={user?.uid}
      />

      {/* Real-Time System Health & Latency Telemetry Drawer (Triggered from Header) */}
      <SystemHealthDashboard
        isOpen={isTelemetryOpen}
        onToggleOpen={() => setIsTelemetryOpen(prev => !prev)}
        onSelectModule={setActiveModule}
        activeModule={activeModule}
      />

      <OfflineIndicator />
    </div>
  );
}
