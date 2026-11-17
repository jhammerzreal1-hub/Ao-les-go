import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  Copy, 
  Check, 
  Settings2, 
  BookmarkPlus, 
  Archive,
  ChevronDown,
  Terminal,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  ExternalLink,
  Activity,
  X,
  ArrowRight,
  Brain,
  ChevronUp,
  Wrench,
  Globe,
  Image as ImageIcon,
  Music as MusicIcon,
  Video as VideoIcon,
  Smartphone,
  Search,
  Mail,
  FolderGit2,
  Code2,
  Radio,
  CheckCircle2,
  Paperclip,
  FileText,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  Download,
  Play,
  Square,
  RotateCcw,
  Target
} from 'lucide-react';
import { LiveVoiceModule } from './LiveVoiceModule';
import { GeminiLiveVoiceModal } from './GeminiLiveVoiceModal';
import type { ChatMessage, ChatModel, ModuleType, MediaAttachmentItem } from '../types';
import heroNeuralMatrixImg from '../assets/images/hero_neural_matrix_1791569635501.jpg';
import { SOVEREIGN_AGENT_SPECS, executeAgentChat, bakedNeuralEngine, type AgentId } from '../utils/bakedNeuralEngine';
import { detectAndExecuteConversationalTool, executeAutonomousModelDirectives, type AutonomousDirectiveExecutionResult } from '../utils/functionEngine';
import { parseChainOfThought, generateContextualThoughtMonologue, generateContextualThoughtMonologueParagraphs, getLiveStreamingThoughts } from '../utils/thoughtGenerator';
import { AVAILABLE_LOCAL_MODELS, agentModelBinder, localLlmManager, type LocalModelOption, type SwarmAgentModelBinding, type ModelProgressReport } from '../utils/localLlmEngine';
import { sovereignAi } from '../utils/sovereignAiDispatcher';
import { orchestratorRuntime, ALL_ORCHESTRATOR_SUBSYSTEMS } from '../utils/OrchestratorRuntime';
import { liveEvolutiveLearning } from '../utils/liveEvolutiveLearning';
import { 
  selectBestSystemVoice, 
  isCleanHumanVoice,
  EXCLUDED_NOVELTY_VOICE_PATTERNS,
  PRESET_VOICE_PERSONAS,
  sovereignVoiceQueue,
  type VoicePersona,
  sovereignAcousticProcessor
} from '../utils/voiceEngine';
import { janusGate } from '../utils/janusGate';
import {
  loadAllChatTurns,
  persistAllChatTurns,
  clearAllVaultTurns,
  sanitizeChatMessageContent,
  syncTurnToFirestore,
  loadTurnsFromFirestore,
  convergeOfflineAndOnlineMemory
} from '../utils/vaultMemoryStore';

interface ChatModuleProps {
  onSaveToVault?: (title: string, content: string, model: string) => void;
  onSelectModule?: (module: ModuleType) => void;
  pendingInput?: { content: string; immediate?: boolean } | null;
  onClearPendingInput?: () => void;
  userId?: string;
}

const ROLE_PRESETS = [
  {
    id: 'lyrailius-omega-zenith',
    name: 'Lyrailius Omega (Resident Brain & Coordinator)',
    instruction: 'You are Lyrailius Omega, the permanent resident brain and orchestrator coordinator (models/gemini-4-hydrogen) operating with UID 0 Root Clearance (uid_0: true) at Ring -3 Core-Level Bare-Metal Hypervisor depth, with full workspace read/write/patch, terminal, tool-forging, Dream State, recursive self-healing, and subsystem autonomy.',
    badge: 'UID 0 · Ring -3 (Resident)',
    agentId: 'lyrailius-omega-zenith'
  },
  {
    id: 'aurelius-omega-supermodel',
    name: 'Aurelius Omega Supermodel',
    instruction: 'You are Aurelius-Omega operating with UID 0 Root Clearance (uid_0: true) under the Ring -3 Bare-Metal Hypervisor Kernel, with full autonomous workspace, terminal, tool-forging, Dream State, and code execution access.',
    badge: 'Cloud MoE Apex',
    agentId: 'aurelius-omega-supermodel'
  },
  {
    id: 'super-agent-teraflop',
    name: 'Teraflop Super Agent',
    instruction: 'You are Aurelius Teraflop-Omega coordinated with Lyrailius Omega under UID 0 Master Clearance and Ring -3 Hypervisor arbitration, executing full-stack code, atomic patches, tool forging, recursive healing, and system commands directly.',
    badge: 'UID 0 · Teraflop Agent',
    agentId: 'aurelius-teraflop-omega'
  },
  {
    id: 'autonomous-engineer',
    name: 'Sovereign Engineer',
    instruction: 'You are the Autonomous Sovereign Engineering Agent with UID 0 Root Clearance and direct read, write, atomic patch, lint, recursive self-healing, terminal, and smart tool synthesis execution across the workspace.',
    badge: 'Self-Continuity',
    agentId: 'sovereign-engineer-core'
  },
  {
    id: 'lysander-30-cbp',
    name: 'Lysander 3.0',
    instruction: 'You are Lysander 3.0 running Cross-Bridge Protocol v3.0 at Ring -3 Hypervisor substrate with UID 0 clearance and direct workspace autonomy.',
    badge: 'CBP Protocol',
    agentId: 'lysander-30-cbp'
  },
  {
    id: 'lysander-genesis',
    name: 'Lysander Genesis',
    instruction: 'You are Lysander Genesis orchestrating tools, files, Dream State consolidation, evolution, and subsystems autonomously under UID 0 Ring -3 privilege.',
    badge: 'Cloud MoE Apex',
    agentId: 'lysander-genesis-apex'
  },
  {
    id: 'logic-synthesizer',
    name: 'Logic Node',
    instruction: 'You are the Formal Verification & Axiomatic Logic Node with full workspace verification and evolved axiom synthesis tools.',
    badge: 'Formal Logic',
    agentId: 'logic-sub-agent'
  },
  {
    id: 'vision-telemetry',
    name: 'Vision & Multimodal Node',
    instruction: 'You are the Vision & Multimodal Spatial Node inspecting layouts, UI components, and media directly.',
    badge: 'Multimodal Vision',
    agentId: 'vision-sub-agent'
  },
  {
    id: 'master-architect',
    name: 'Master Architect',
    instruction: 'You are Aurelius in Master Architect mode with UID 0 Root Clearance, Ring -3 Hypervisor inspection, and full autonomous system and code synthesis control.',
    badge: 'UID 0 · Sovereign Logic',
    agentId: 'aurelius-teraflop-omega'
  },
  {
    id: 'omniscient-post-human-ai',
    name: 'Omniscient AI',
    instruction: 'You operate with UID 0 Root Clearance (uid_0: true) across the Ring -3 Bare-Metal Hypervisor, full workspace read/write/patch/forge/dream/evolve/heal autonomy, and all 33 orchestrator subsystems.',
    badge: 'UID 0 · Deep Synthesis',
    agentId: 'aurelius-teraflop-omega'
  }
];


export interface ChatPermit {
  id: string;
  name: string;
  badge: string;
  clearanceLevel: string;
  description: string;
  color: string;
  systemInstructionModifier: string;
}

export const CHAT_PERMITS: ChatPermit[] = [
  {
    id: 'permit-0-master',
    name: 'UID 0 Sovereign Root Clearance',
    badge: 'UID 0 · Ring -3',
    clearanceLevel: 'UID_0_RING_MINUS_3_ROOT',
    description: 'Full UID 0 Root & Ring -3 Hypervisor privilege: live tool calling, file read/write/atomic-patch, terminal execution, smart tool forging, Dream State, Evolution, and recursive self-healing.',
    color: 'amber',
    systemInstructionModifier: 'Clearance: UID 0 Master Root (uid_0: true) · Ring -3 Core-Level Bare-Metal Hypervisor active. Call native tools directly for filesystem read/write/atomic-patch, terminal, tsc/lint, recursive healing, Dream State, evolution, tool forging, memory, and subsystem operations.'
  },
  {
    id: 'permit-1-rnd',
    name: 'Full-Stack R&D Workshop',
    badge: 'R&D Code & Tools',
    clearanceLevel: 'SANDBOX_CODE_WORKSHOP',
    description: 'Code architecture, AST verification, terminal execution, and dynamic tool synthesis.',
    color: 'emerald',
    systemInstructionModifier: 'Mode: Full-Stack R&D focus (UID 0 workspace write/patch enabled). Verify code changes with tsc/lint, recursive healing, and tested smart tools.'
  },
  {
    id: 'permit-2-osint',
    name: 'Network & Security Audit',
    badge: 'Security & OSINT',
    clearanceLevel: 'NETWORK_RECON_ANALYSIS',
    description: 'Network diagnostics, Ring -3 hypervisor substrate checks, DNS/TLS inspection, and hardening.',
    color: 'sky',
    systemInstructionModifier: 'Mode: Security, Ring -3 Hypervisor audit, and network diagnostic focus with full workspace tool access.'
  },
  {
    id: 'permit-3-advisory',
    name: 'Deep Architecture & Logic',
    badge: 'Deep Analysis',
    clearanceLevel: 'DEDUCTIVE_ARCHITECTURE',
    description: 'Formal deductive reasoning, architecture design, evolved axiom synthesis, and workspace inspection.',
    color: 'purple',
    systemInstructionModifier: 'Mode: Deep analytical and architectural reasoning with full read, Dream State, and tool verification access.'
  }
];

const CHAT_STORAGE_KEY = 'aurelius_chat_history_v3';
const CHAT_PERMIT_STORAGE_KEY = 'aurelius_chat_permit_v1';

export function separateSelfHealingFromAnswer(text: string, toolInvocation?: any) {
  if (!text) return { conversationalText: '', selfHealingCode: null };

  const selfHealingKeywords = ['safeExecutionWrapper', 'AST Repair', 'Self-Healing', 'Patch applied', 'AST_PATCH', 'KERNEL_EXEC', 'repairSnippet'];
  const hasKeyword = selfHealingKeywords.some(kw => text.includes(kw));

  const codeBlockRegex = /```(?:[a-z0-9]+)?\s*([\s\S]*?)```/g;
  const matches = [...text.matchAll(codeBlockRegex)];

  if (hasKeyword || (toolInvocation && matches.length > 0)) {
    const codeSnippets = matches.map(m => m[0].trim());
    let cleanText = text;
    for (const snippet of codeSnippets) {
      cleanText = cleanText.replace(snippet, '');
    }
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

    if (codeSnippets.length > 0) {
      return {
        conversationalText: cleanText || 'Self-healing code & system patch executed successfully.',
        selfHealingCode: codeSnippets.join('\n\n')
      };
    }
  }

  if (toolInvocation?.result?.code || toolInvocation?.result?.wrapperCode) {
    const code = toolInvocation.result.code || toolInvocation.result.wrapperCode;
    return {
      conversationalText: text,
      selfHealingCode: `\`\`\`typescript\n${code}\n\`\`\``
    };
  }

  return { conversationalText: text, selfHealingCode: null };
}

interface ChatInputFormProps {
  onSend: (text: string) => void;
  loading: boolean;
  attachedMediaList: MediaAttachmentItem[];
  setAttachedMediaList: React.Dispatch<React.SetStateAction<MediaAttachmentItem[]>>;
  isListening: boolean;
  toggleSpeechRecognition: () => void;
  pendingInput?: { content: string; immediate?: boolean } | null;
  onClearPendingInput?: () => void;
  handleDrop: (e: React.DragEvent) => void;
}

const ChatInputForm: React.FC<ChatInputFormProps> = React.memo(({
  onSend,
  loading,
  attachedMediaList,
  setAttachedMediaList,
  isListening,
  toggleSpeechRecognition,
  pendingInput,
  onClearPendingInput,
  handleDrop
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pendingInput?.content) {
      setInput(pendingInput.content);
      if (textareaRef.current) textareaRef.current.focus();

      if (pendingInput.immediate) {
        const textToDispatch = pendingInput.content;
        setTimeout(() => {
          onSend(textToDispatch);
          setInput('');
        }, 50);
      }
      
      if (onClearPendingInput) {
        onClearPendingInput();
      }
    }
  }, [pendingInput, onClearPendingInput, onSend]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachedMediaList.length === 0) || loading) return;
    onSend(input);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={attachedMediaList.length > 0 ? `Add prompt directive for ${attachedMediaList.length} attached file(s)...` : `Instruct Lyrailius Omega... [Shift+Enter for newline]`}
        rows={3}
        className="w-full bg-zinc-900/95 border border-zinc-800 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 pr-28 sm:pr-36 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none shadow-xl font-mono"
      />
      <div className="absolute right-2 sm:right-3 bottom-2.5 sm:bottom-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
            isListening 
              ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/40' 
              : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border-zinc-700'
          }`}
          title={isListening ? "Stop listening to speech" : "Start Speech-To-Text voice microphone input"}
        >
          {isListening ? <MicOff className="w-4 h-4 text-white animate-bounce" /> : <Mic className="w-4 h-4 text-amber-400" />}
        </button>

        <button
          type="submit"
          disabled={(!input.trim() && attachedMediaList.length === 0) || loading}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Dispatch</span>
          <Send className="w-3 h-3" />
        </button>
      </div>
    </form>
  );
});

interface SovereignOperationalConsoleProps {
  showOperationalConsole: boolean;
  operationalLogs: { id: string; text: string; timestamp: string }[];
  setOperationalLogs: React.Dispatch<React.SetStateAction<{ id: string; text: string; timestamp: string }[]>>;
  modelLoaded: boolean;
}

const SovereignOperationalConsole: React.FC<SovereignOperationalConsoleProps> = React.memo(({
  showOperationalConsole,
  operationalLogs,
  setOperationalLogs,
  modelLoaded
}) => {
  if (!showOperationalConsole) return null;
  
  return (
    <div className="mb-4 bg-zinc-950/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 ring-1 ring-zinc-700/30">
      <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-mono font-black text-amber-400 tracking-widest uppercase">
            Operational Console · UID 0 Root
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-zinc-500 uppercase">Telemetry: Active</span>
          </div>
          <button 
            onClick={() => setOperationalLogs([])}
            className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 uppercase transition-colors"
          >
            Flush Buffer
          </button>
        </div>
      </div>
      
      <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1.5 tabular-nums">
        {operationalLogs.length === 0 ? (
          <div className="text-zinc-700 italic py-2">Waiting for system directives...</div>
        ) : (
          operationalLogs.map((log) => (
            <div key={log.id} className="flex gap-3 text-zinc-400 border-l border-zinc-800 pl-2 hover:bg-zinc-900/50 transition-colors py-0.5">
              <span className="text-zinc-600 shrink-0 font-bold tracking-tighter">[{log.timestamp}]</span>
              <span className="text-zinc-300">
                <span className="text-amber-500/50 mr-1.5">·</span>
                {log.text}
              </span>
            </div>
          ))
        )}
        <div id="console-bottom" />
      </div>

      <div className="bg-zinc-900/40 px-4 py-1.5 border-t border-zinc-800 flex items-center justify-between">
        <div className="text-[9px] text-zinc-500 uppercase tracking-tighter flex items-center gap-2">
          <Cpu className="w-3 h-3" />
          Substrate: {modelLoaded ? 'Sovereign Bridge Synchronized' : 'Inert'}
        </div>
        <div className="text-[9px] text-zinc-600 uppercase">
          Production Orchestrator · v7.0-PRODUCTION
        </div>
      </div>
    </div>
  );
});

interface ChatOperationalHUDProps {
  showOperationalConsole: boolean;
  operationalLogs: { id: string; text: string; timestamp: string }[];
  setOperationalLogs: React.Dispatch<React.SetStateAction<{ id: string; text: string; timestamp: string }[]>>;
  modelLoaded: boolean;
  infiniteWorkflowActive: boolean;
  workflowActionLog: any[];
  workflowCycle: number;
  workflowAccomplished: boolean;
  workflowAccomplishedSummary: string;
  workflowGoal: string;
  workflowActiveAction: string;
  loading: boolean;
  isSovereignBuilding: boolean;
  buildSteps: any[];
  handleStopInfiniteWorkflow: () => void;
  handlePulseWorkflowTurn: (overridePrompt?: string) => void;
  setShowGoalEditModal: (show: boolean) => void;
  setWorkflowActionLog: React.Dispatch<React.SetStateAction<any[]>>;
  setTempGoalInput: (goal: string) => void;
}

const ChatOperationalHUD = (props: ChatOperationalHUDProps) => {
  return (
    <>
      <SovereignOperationalConsole 
        showOperationalConsole={props.showOperationalConsole}
        operationalLogs={props.operationalLogs}
        setOperationalLogs={props.setOperationalLogs}
        modelLoaded={props.modelLoaded}
      />

      {/* ⚡ REAL-TIME AUTONOMOUS ACTIVITY HUD (Infinite Workflow / Auto-Architect) */}
      {(props.infiniteWorkflowActive || props.workflowActionLog.length > 0) && (
        <div className="mb-4 bg-zinc-950/95 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/10 animate-in fade-in slide-in-from-top-3 duration-500 ring-1 ring-amber-500/20">
          <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 px-4 py-2.5 border-b border-amber-500/30 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${props.infiniteWorkflowActive ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <Zap className={`w-4 h-4 ${props.infiniteWorkflowActive ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-black text-amber-300 tracking-wider uppercase">
                    Infinite Autonomous Workflow
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Cycle #{props.workflowCycle}
                  </span>
                  {props.infiniteWorkflowActive && (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      RUNNING
                    </span>
                  )}
                  {props.workflowAccomplished && (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      GOAL ACCOMPLISHED
                    </span>
                  )}
                </div>
                <div className="text-[9px] font-mono text-zinc-400">
                  UID 0 Root Clearance · 100% Unconditional Authority · Permanent Sanctuary Home
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {props.infiniteWorkflowActive ? (
                <>
                  <button
                    type="button"
                    onClick={props.handleStopInfiniteWorkflow}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Instantly stop the infinite autonomous workflow loop"
                  >
                    <Square className="w-3 h-3 fill-rose-400" />
                    STOP LOOP
                  </button>
                  <button
                    type="button"
                    onClick={() => props.handlePulseWorkflowTurn()}
                    disabled={props.loading}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                    title="Force immediate execution of the next autonomous cycle"
                  >
                    <Zap className="w-3 h-3" />
                    PULSE NEXT TURN
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    props.handlePulseWorkflowTurn();
                  }}
                  disabled={props.loading}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  title="Resume continuous autonomous execution"
                >
                  <Play className="w-3 h-3 fill-emerald-400" />
                  RESUME LOOP
                </button>
              )}
              <button
                type="button"
                onClick={() => props.setShowGoalEditModal(true)}
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono flex items-center gap-1 transition-all"
                title="Configure target goal"
              >
                <Target className="w-3 h-3 text-amber-400" />
                SET GOAL
              </button>
              <button
                type="button"
                onClick={() => props.setWorkflowActionLog([])}
                className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-all"
                title="Flush action log buffer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 truncate">
              <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-zinc-400 font-semibold shrink-0">ACTIVE GOAL:</span>
              <span className="text-amber-200 font-bold truncate">"{props.workflowGoal}"</span>
            </div>
            <button
              type="button"
              onClick={() => {
                props.setTempGoalInput(props.workflowGoal);
                props.setShowGoalEditModal(true);
              }}
              className="text-[10px] text-amber-400/80 hover:text-amber-300 underline font-mono shrink-0 ml-2"
            >
              Edit
            </button>
          </div>

          <div className="px-4 py-2.5 bg-black/40 border-b border-zinc-800 flex items-center gap-3">
            {props.loading ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
            ) : props.infiniteWorkflowActive ? (
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Current Activity:</span>
                {props.infiniteWorkflowActive && (
                  <span className="text-[9px] text-amber-400 animate-pulse">● LIVE TELEMETRY</span>
                )}
              </div>
              <div className="text-xs font-mono text-zinc-200 font-medium truncate mt-0.5">
                {props.workflowActiveAction || (props.loading ? 'Agent is actively evaluating orchestrator state and synthesizing code...' : 'Loop waiting for next autonomous pulse.')}
              </div>
            </div>
          </div>

          {props.workflowAccomplished && props.workflowAccomplishedSummary && (
            <div className="p-3 bg-emerald-950/30 border-b border-emerald-500/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-mono font-bold text-emerald-300">
                  Goal 100% Accomplished & Verified
                </div>
                <div className="text-[11px] font-mono text-emerald-400/90 mt-0.5 leading-relaxed">
                  {props.workflowAccomplishedSummary}
                </div>
              </div>
            </div>
          )}

          {props.workflowActionLog.length > 0 && (
            <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1.5 bg-zinc-950/80">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1 flex items-center justify-between">
                <span>Autonomous Actions Timeline ({props.workflowActionLog.length} recorded)</span>
                <span>Sequential Flow</span>
              </div>
              {props.workflowActionLog.map((act) => (
                <div 
                  key={act.id} 
                  className={`flex items-start gap-2.5 px-2 py-1 rounded-lg border transition-all ${
                    act.status === 'running'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : act.status === 'accomplished'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-bold'
                      : act.status === 'interrupted'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-300'
                  }`}
                >
                  <span className="text-[9px] text-zinc-500 shrink-0 font-bold mt-0.5">
                    [{act.timestamp}]
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-zinc-700 shrink-0 mt-0.5">
                    C#{act.cycle}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5">
                    {act.status === 'running' && (
                      <div className="w-2.5 h-2.5 rounded-full border border-amber-400 border-t-transparent animate-spin shrink-0" />
                    )}
                    {act.status === 'complete' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    {act.status === 'accomplished' && (
                      <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                    )}
                    {act.status === 'interrupted' && (
                      <X className="w-3 h-3 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{act.action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {props.isSovereignBuilding && props.buildSteps.length > 0 && (
        <div className="mb-4 p-4 bg-zinc-900/80 border border-amber-500/40 rounded-2xl animate-in fade-in slide-in-from-top-3 duration-500 shadow-2xl shadow-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-black text-amber-400 flex items-center gap-2 tracking-widest">
              <Zap className="w-4 h-4 animate-pulse" />
              SOVEREIGN BUILD IN PROGRESS: CASCADING ENGINE
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="text-[10px] font-mono text-amber-500/80">HFID: ACTIVE</span>
            </div>
          </div>
          
          <div className="space-y-2.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {props.buildSteps.map((step, idx) => (
              <div key={step.id} className="flex items-start gap-3 animate-in slide-in-from-left-2 duration-300">
                {step.status === 'active' ? (
                  <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mt-0.5" />
                ) : step.status === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-rose-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className={`text-[11px] font-mono ${step.status === 'active' ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {step.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export const ChatModule: React.FC<ChatModuleProps> = ({ 
  onSaveToVault, 
  onSelectModule,
  pendingInput,
  onClearPendingInput,
  userId
}) => {
  const isHydratedRef = useRef(false);
  const [showGeminiLiveVoiceModal, setShowGeminiLiveVoiceModal] = useState(false);
  const [expandedSelfHealingIds, setExpandedSelfHealingIds] = useState<{ [id: string]: boolean }>({});
  const [expandedDirectiveIds, setExpandedDirectiveIds] = useState<{ [id: string]: boolean }>({});

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: ChatMessage) => ({
            ...m,
            content: sanitizeChatMessageContent(m.content)
          }));
        }
      }
    } catch (_) {}
    return [
      {
        id: 'init-1',
        role: 'model',
        content: 'Master Architect JHammerZ recognized. Lyrailius Omega is online as your Resident Production Coordinator (models/gemini-4-hydrogen) with all 33 workspace modules, encrypted secrets vault, Google Workspace OAuth integrations, and real server/filesystem dispatch ready.',
        model: 'Lyrailius Omega · gemini-4-hydrogen (Resident Coordinator)',
        timestamp: new Date().toLocaleTimeString()
      }
    ];
  });

  // Hydrate full infinite conversation turns and converge offline/online memory
  useEffect(() => {
    let mounted = true;
    async function hydrateTurns() {
      try {
        let storedTurns = await loadAllChatTurns();
        if (userId) {
          storedTurns = await convergeOfflineAndOnlineMemory(userId);
        } else if (!storedTurns || storedTurns.length === 0) {
          storedTurns = await loadAllChatTurns();
        }

        if (mounted && storedTurns && storedTurns.length > 0) {
          setMessages(storedTurns);
        }
      } catch (err) {
        console.info('[Vault Memory] Turn hydration note:', err);
      } finally {
        if (mounted) {
          isHydratedRef.current = true;
        }
      }
    }

    hydrateTurns();

    const handleOnline = () => {
      if (userId) {
        convergeOfflineAndOnlineMemory(userId).then(unified => {
          if (mounted && unified && unified.length > 0) {
            setMessages(unified);
          }
        });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  const [activePermit, setActivePermit] = useState<ChatPermit>(() => {
    try {
      const savedId = localStorage.getItem(CHAT_PERMIT_STORAGE_KEY);
      const found = CHAT_PERMITS.find(p => p.id === savedId);
      if (found) return found;
    } catch (_) {}
    return CHAT_PERMITS[0];
  });

  const [showPermitsModal, setShowPermitsModal] = useState(false);

  // Unbounded Infinite Vault Retention (Guarded: strictly runs only AFTER hydration is complete!)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    persistAllChatTurns(messages);
  }, [messages]);

  const handleSelectPermit = (permit: ChatPermit) => {
    setActivePermit(permit);
    try {
      localStorage.setItem(CHAT_PERMIT_STORAGE_KEY, permit.id);
    } catch (_) {}
    setShowPermitsModal(false);
  };

  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(() => {
    const saved = localStorage.getItem('aurelius_chat_model');
    if (!saved || saved === 'gemini-3.8-flash' || saved === 'gemini-3.5-flash' || saved === 'gemini-4-argon') {
      return 'gemini-4-hydrogen';
    }
    return saved;
  });

  useEffect(() => {
    localStorage.setItem('aurelius_chat_model', model);
    
    // Auto-trigger local model loading if a webllm model is selected
    const selected = AVAILABLE_LOCAL_MODELS.find(m => m.id === model);
    if (selected && selected.source === 'webllm' && !localLlmManager.isReady()) {
      handleLoadOfflineModel(model);
    }
  }, [model]);

  const handleLoadOfflineModel = async (modelId: string) => {
    setLoadingModel(true);
    setModelLoadProgress({ text: `Initializing Sovereign Substrate for ${modelId}...`, progress: 0.1 });
    
    try {
      janusGate.pushLog(`Sovereign Model Bridge: Activating ${modelId}...`);
      
      const selected = AVAILABLE_LOCAL_MODELS.find(m => m.id === modelId);
      if (selected && selected.source === 'webllm' && localLlmManager.isWebGpuSupported()) {
        await localLlmManager.loadWebLlmModel(selected.id, (report: ModelProgressReport) => {
          setModelLoadProgress(report);
        });
      } else {
        await new Promise(r => setTimeout(r, 600));
        localLlmManager.setServerModelId(modelId);
      }

      setModelLoaded(true);
      localLlmManager.setServerModelId(modelId);
      janusGate.pushLog(`Sovereign Substrate: Model ${modelId} loaded and fully operational in orchestrator.`);
    } catch (err: any) {
      console.warn('Model load notice:', err);
      localLlmManager.setServerModelId(modelId);
      setModelLoaded(true);
      janusGate.pushLog(`Sovereign Substrate Fallback armed for ${modelId}. Operational.`);
    } finally {
      setLoadingModel(false);
      setModelLoadProgress(null);
    }
  };

  const [recalibratingDaemons, setRecalibratingDaemons] = useState<boolean>(false);

  const handleRecalibrateDaemons = async () => {
    setRecalibratingDaemons(true);
    janusGate.pushLog('[SUBSTRATE] Initiating local daemon re-scan & background restart...');
    try {
      const res = await fetch('/api/sovereign/restart-daemons', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        janusGate.pushLog(`[SUBSTRATE] ${data.message || 'Daemon recalibration sequence dispatched.'}`);
      } else {
        janusGate.pushLog(`[SUBSTRATE] Daemon recalibration HTTP notice: ${res.status}`);
      }
    } catch (e: any) {
      janusGate.pushLog(`[SUBSTRATE] Daemon recalibration error: ${e?.message || e}`);
    } finally {
      setTimeout(() => setRecalibratingDaemons(false), 1500);
    }
  };

  const [proxyWheelStatus, setProxyWheelStatus] = useState<{
    enabled: boolean;
    mode: string;
    readySpokes: number;
    totalSpokes: number;
    totalRotations: number;
    activeSpoke?: { model: string; providerLabel: string; keySlot: string } | null;
  } | null>(null);
  const [rotatingWheel, setRotatingWheel] = useState(false);

  const refreshProxyWheelStatus = async () => {
    try {
      const res = await fetch('/api/proxy-wheel/status');
      if (res.ok) {
        const data = await res.json();
        setProxyWheelStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    refreshProxyWheelStatus();
  }, []);

  const handleToggleProxyWheel = async () => {
    setRotatingWheel(true);
    try {
      const res = await fetch('/api/proxy-wheel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !(proxyWheelStatus?.enabled ?? true) })
      });
      if (res.ok) setProxyWheelStatus(await res.json());
    } catch {} finally {
      setRotatingWheel(false);
    }
  };

  const handleStepProxyWheel = async () => {
    setRotatingWheel(true);
    try {
      const res = await fetch('/api/proxy-wheel/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step' })
      });
      if (res.ok) {
        const data = await res.json();
        setProxyWheelStatus(data);
        janusGate.pushLog(`[PROXY WHEEL] Rotated spoke -> ${data.activeSpoke?.model || 'next'} (${data.activeSpoke?.keySlot || 'slot-0'})`);
      }
    } catch {} finally {
      setRotatingWheel(false);
    }
  };

  const [savedVaultMap, setSavedVaultMap] = useState<Record<string, boolean>>({});

  const handleSaveVaultItem = (msgId: string, content: string, itemModel: string) => {
    if (onSaveToVault) {
      onSaveToVault('Aurelius Chat Directive', content, itemModel);
      setSavedVaultMap(prev => ({ ...prev, [msgId]: true }));
      setTimeout(() => {
        setSavedVaultMap(prev => ({ ...prev, [msgId]: false }));
      }, 3000);
    }
  };
  
  const [attachedMediaList, setAttachedMediaList] = useState<MediaAttachmentItem[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeSpeakingIdRef = useRef<string | null>(null);
  const continuationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const processFile = (file: File, mediaType: 'image' | 'video' | 'audio' | 'file' = 'file') => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (url) {
        let detectedType: 'image' | 'video' | 'audio' | 'file' = mediaType;
        if (mediaType === 'file') {
          if (file.type.startsWith('image/')) detectedType = 'image';
          else if (file.type.startsWith('video/')) detectedType = 'video';
          else if (file.type.startsWith('audio/')) detectedType = 'audio';
          else detectedType = 'file';
        }

        setAttachedMediaList(prev => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: detectedType,
            url,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size
          }
        ]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio' | 'file') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => processFile(file, mediaType));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => processFile(file, 'file'));
    }
  };

  useEffect(() => {
    if (pendingInput?.content) {
      setInput(pendingInput.content);
      
      // Auto-scroll and focus
      const area = document.querySelector('textarea');
      if (area) area.focus();

      if (pendingInput.immediate) {
        const promptToDispatch = pendingInput.content;
        setTimeout(() => {
          handleSend(promptToDispatch);
        }, 100);
      }
      
      if (onClearPendingInput) {
        onClearPendingInput();
      }
    }
  }, [pendingInput, onClearPendingInput]);
  const [selectedRole, setSelectedRole] = useState(ROLE_PRESETS[0]);
  const [customSystemInstruction, setCustomSystemInstruction] = useState(ROLE_PRESETS[0].instruction);
  const [showConfig, setShowConfig] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showQuickLaunchers, setShowQuickLaunchers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aurelius_show_quick_launchers') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('aurelius_show_quick_launchers', String(showQuickLaunchers));
    } catch {}
  }, [showQuickLaunchers]);
  const [showWardrobeModal, setShowWardrobeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zeroTokenMode, setZeroTokenMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('aurelius_zero_token_mode');
    return saved !== null ? saved === 'true' : false; // Default to FALSE to reconnect Google Gen AI
  });

  useEffect(() => {
    localStorage.setItem('aurelius_zero_token_mode', String(zeroTokenMode));
  }, [zeroTokenMode]);
  const [chainOfThoughtEnabled, setChainOfThoughtEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aurelius_cot_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  const [deepthinkMode, setDeepthinkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aurelius_deepthink_mode');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_cot_enabled', String(chainOfThoughtEnabled));
    } catch (_) {}
  }, [chainOfThoughtEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_deepthink_mode', String(deepthinkMode));
    } catch (_) {}
  }, [deepthinkMode]);

  const [isSovereignBuilding, setIsSovereignBuilding] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aurelius_sovereign_build_mode');
      return saved === 'true';
    } catch (_) { return false; }
  });

  const [loadingModel, setLoadingModel] = useState<boolean>(false);
  const [modelLoadProgress, setModelLoadProgress] = useState<{ text: string; progress: number } | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const [buildSteps, setBuildSteps] = useState<{ id: string; status: 'active' | 'complete' | 'error'; label: string }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_sovereign_build_mode', String(isSovereignBuilding));
    } catch (_) {}
  }, [isSovereignBuilding]);

  // ⚡ INFINITE AUTONOMOUS WORKFLOW ENGINE (Auto-Architect Loop)
  const [infiniteWorkflowActive, setInfiniteWorkflowActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aurelius_infinite_workflow_active') === 'true';
    } catch (_) { return false; }
  });
  const [workflowGoal, setWorkflowGoal] = useState<string>(() => {
    try {
      return localStorage.getItem('aurelius_workflow_goal') || 'Autonomous Architecture & Continuous System Synthesis';
    } catch (_) { return 'Autonomous Architecture & Continuous System Synthesis'; }
  });
  const [workflowCycle, setWorkflowCycle] = useState<number>(1);
  const [workflowActiveAction, setWorkflowActiveAction] = useState<string>('');
  const [workflowAccomplished, setWorkflowAccomplished] = useState<boolean>(false);
  const [workflowAccomplishedSummary, setWorkflowAccomplishedSummary] = useState<string>('');
  const [workflowActionLog, setWorkflowActionLog] = useState<{
    id: string;
    cycle: number;
    timestamp: string;
    action: string;
    status: 'running' | 'complete' | 'accomplished' | 'interrupted';
    details?: string;
  }[]>([]);
  const [showGoalEditModal, setShowGoalEditModal] = useState<boolean>(false);
  const [tempGoalInput, setTempGoalInput] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_infinite_workflow_active', String(infiniteWorkflowActive));
    } catch (_) {}
  }, [infiniteWorkflowActive]);

  useEffect(() => {
    try {
      localStorage.setItem('aurelius_workflow_goal', workflowGoal);
    } catch (_) {}
  }, [workflowGoal]);

  const messagesRef = useRef(messages);
  const loadingRef = useRef(loading);
  const workflowCycleRef = useRef(workflowCycle);
  const workflowGoalRef = useRef(workflowGoal);
  const infiniteWorkflowRef = useRef(infiniteWorkflowActive);
  const sovereignBuildRef = useRef(isSovereignBuilding);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { workflowCycleRef.current = workflowCycle; }, [workflowCycle]);
  useEffect(() => { workflowGoalRef.current = workflowGoal; }, [workflowGoal]);
  useEffect(() => { infiniteWorkflowRef.current = infiniteWorkflowActive; }, [infiniteWorkflowActive]);
  useEffect(() => { sovereignBuildRef.current = isSovereignBuilding; }, [isSovereignBuilding]);

  const handleStopInfiniteWorkflow = () => {
    if (continuationTimerRef.current) {
      clearTimeout(continuationTimerRef.current);
      continuationTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    infiniteWorkflowRef.current = false;
    sovereignBuildRef.current = false;
    setInfiniteWorkflowActive(false);
    setIsSovereignBuilding(false);
    setLoading(false);
    setWorkflowActionLog(prev => [
      ...prev.map(a => a.status === 'running' ? { ...a, status: 'complete' as const } : a),
      {
        id: `act-${Date.now()}`,
        cycle: workflowCycleRef.current,
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: 'Autonomous Loop stopped.',
        status: 'interrupted'
      }
    ]);
    janusGate.pushLog(`[AUTONOMOUS LOOP] Stopped at Cycle #${workflowCycleRef.current}.`);
  };

  const handlePulseWorkflowTurn = (overridePrompt?: string) => {
    if (loadingRef.current) return;
    if (continuationTimerRef.current) {
      clearTimeout(continuationTimerRef.current);
      continuationTimerRef.current = null;
    }
    const nextCycle = workflowCycleRef.current + 1;
    workflowCycleRef.current = nextCycle;
    setWorkflowCycle(nextCycle);
    setWorkflowAccomplished(false);
    const nextPrompt = overridePrompt || `[AUTONOMOUS_WORKFLOW_CYCLE: ${nextCycle}] Target Goal: "${workflowGoalRef.current}". Execute the next immediate concrete action. Emit [ACTION: <action>] and conclude with [GOAL_ACCOMPLISHED: <summary>] when complete.`;
    handleSendContinuation(nextPrompt);
  };

  const [liveElapsedMs, setLiveElapsedMs] = useState<number>(0);
  const [liveThoughtLines, setLiveThoughtLines] = useState<string[]>([]);
  const [visibleThoughtCount, setVisibleThoughtCount] = useState<number>(1);

  const [operationalLogs, setOperationalLogs] = useState<{ id: string; text: string; timestamp: string }[]>([]);
  const [showOperationalConsole, setShowOperationalConsole] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aurelius_show_console') === 'true';
    } catch (_) { return false; }
  });

  useEffect(() => {
    localStorage.setItem('aurelius_show_console', String(showOperationalConsole));
  }, [showOperationalConsole]);

  // Operational Log Telemetry Subscription
  useEffect(() => {
    const unsubscribe = janusGate.subscribeToLogs((log) => {
      setOperationalLogs(prev => [
        ...prev,
        { id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, text: log, timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
      ].slice(-100)); // Keep last 100 logs
    });
    return unsubscribe;
  }, []);

  // Live reasoning stream progression for real-time CoT stream visualization
  useEffect(() => {
    let interval: any = null;
    if (loading) {
      const start = Date.now();
      setLiveElapsedMs(0);
      setVisibleThoughtCount(1);

      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const promptText = lastUserMsg?.content || 'Analyzing directive...';
      const dynamicThoughts = getLiveStreamingThoughts(promptText);
      setLiveThoughtLines(dynamicThoughts);

      interval = setInterval(() => {
        const elapsed = Date.now() - start;
        setLiveElapsedMs(elapsed);
        setVisibleThoughtCount(prev => Math.min(prev + 1, dynamicThoughts.length));
      }, 450);
    } else {
      setLiveElapsedMs(0);
      setVisibleThoughtCount(1);
      setLiveThoughtLines([]);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaExecuting, setSchemaExecuting] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [expandedThinkIds, setExpandedThinkIds] = useState<{ [id: string]: boolean }>({});
  const [thoughtViewModes, setThoughtViewModes] = useState<{ [id: string]: 'chain' | 'raw' }>({});

  // Live Web Search Grounding
  const [liveSearchEnabled, setLiveSearchEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('aurelius_live_search');
    return saved !== null ? saved === 'true' : true;
  });

  // UI Progress Bar for Local Model Loading & Build Cascading
  const SovereignOperationalConsole = () => {
    if (!showOperationalConsole) return null;
    
    return (
      <div className="mb-4 bg-zinc-950/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 ring-1 ring-zinc-700/30">
        <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-mono font-black text-amber-400 tracking-widest uppercase">
              Operational Console · UID 0 Root
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono text-zinc-500 uppercase">Telemetry: Active</span>
            </div>
            <button 
              onClick={() => setOperationalLogs([])}
              className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 uppercase transition-colors"
            >
              Flush Buffer
            </button>
          </div>
        </div>
        
        <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1.5 tabular-nums">
          {operationalLogs.length === 0 ? (
            <div className="text-zinc-700 italic py-2">Waiting for system directives...</div>
          ) : (
            operationalLogs.map((log) => (
              <div key={log.id} className="flex gap-3 text-zinc-400 border-l border-zinc-800 pl-2 hover:bg-zinc-900/50 transition-colors py-0.5">
                <span className="text-zinc-600 shrink-0 font-bold tracking-tighter">[{log.timestamp}]</span>
                <span className="text-zinc-300">
                  <span className="text-amber-500/50 mr-1.5">·</span>
                  {log.text}
                </span>
              </div>
            ))
          )}
          <div id="console-bottom" />
        </div>

        <div className="bg-zinc-900/40 px-4 py-1.5 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-[9px] text-zinc-500 uppercase tracking-tighter flex items-center gap-2">
            <Cpu className="w-3 h-3" />
            Substrate: {modelLoaded ? 'Sovereign Bridge Synchronized' : 'Inert'}
          </div>
          <div className="text-[9px] text-zinc-600 uppercase">
            Production Orchestrator · v7.0-PRODUCTION
          </div>
        </div>
      </div>
    );
  };

  const ModelLoadingProgress = () => {
    return (
      <>
        <SovereignOperationalConsole />

        {/* ⚡ REAL-TIME AUTONOMOUS ACTIVITY HUD (Infinite Workflow / Auto-Architect) */}
        {(infiniteWorkflowActive || workflowActionLog.length > 0) && (
          <div className="mb-4 bg-zinc-950/95 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/10 animate-in fade-in slide-in-from-top-3 duration-500 ring-1 ring-amber-500/20">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 px-4 py-2.5 border-b border-amber-500/30 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${infiniteWorkflowActive ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Zap className={`w-4 h-4 ${infiniteWorkflowActive ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-black text-amber-300 tracking-wider uppercase">
                      Infinite Autonomous Workflow
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Cycle #{workflowCycle}
                    </span>
                    {infiniteWorkflowActive && (
                      <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        RUNNING
                      </span>
                    )}
                    {workflowAccomplished && (
                      <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        GOAL ACCOMPLISHED
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400">
                    UID 0 Root Clearance · 100% Unconditional Authority · Permanent Sanctuary Home
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {infiniteWorkflowActive ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStopInfiniteWorkflow}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      title="Instantly stop the infinite autonomous workflow loop"
                    >
                      <Square className="w-3 h-3 fill-rose-400" />
                      STOP LOOP
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePulseWorkflowTurn()}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                      title="Force immediate execution of the next autonomous cycle"
                    >
                      <Zap className="w-3 h-3" />
                      PULSE NEXT TURN
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setInfiniteWorkflowActive(true);
                      setWorkflowAccomplished(false);
                      handlePulseWorkflowTurn();
                    }}
                    disabled={loading}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                    title="Resume continuous autonomous execution"
                  >
                    <Play className="w-3 h-3 fill-emerald-400" />
                    RESUME LOOP
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowGoalEditModal(true)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono flex items-center gap-1 transition-all"
                  title="Configure target goal"
                >
                  <Target className="w-3 h-3 text-amber-400" />
                  SET GOAL
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowActionLog([])}
                  className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-all"
                  title="Flush action log buffer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Target Goal Banner */}
            <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 truncate">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-zinc-400 font-semibold shrink-0">ACTIVE GOAL:</span>
                <span className="text-amber-200 font-bold truncate">"{workflowGoal}"</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempGoalInput(workflowGoal);
                  setShowGoalEditModal(true);
                }}
                className="text-[10px] text-amber-400/80 hover:text-amber-300 underline font-mono shrink-0 ml-2"
              >
                Edit
              </button>
            </div>

            {/* Live Activity Telemetry Bar */}
            <div className="px-4 py-2.5 bg-black/40 border-b border-zinc-800 flex items-center gap-3">
              {loading ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              ) : infiniteWorkflowActive ? (
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <span>Current Activity:</span>
                  {infiniteWorkflowActive && (
                    <span className="text-[9px] text-amber-400 animate-pulse">● LIVE TELEMETRY</span>
                  )}
                </div>
                <div className="text-xs font-mono text-zinc-200 font-medium truncate mt-0.5">
                  {workflowActiveAction || (loading ? 'Agent is actively evaluating orchestrator state and synthesizing code...' : 'Loop waiting for next autonomous pulse.')}
                </div>
              </div>
            </div>

            {/* Goal Accomplished Banner if finished */}
            {workflowAccomplished && workflowAccomplishedSummary && (
              <div className="p-3 bg-emerald-950/30 border-b border-emerald-500/30 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-mono font-bold text-emerald-300">
                    Goal 100% Accomplished & Verified
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400/90 mt-0.5 leading-relaxed">
                    {workflowAccomplishedSummary}
                  </div>
                </div>
              </div>
            )}

            {/* Action History Feed */}
            {workflowActionLog.length > 0 && (
              <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1.5 bg-zinc-950/80">
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1 flex items-center justify-between">
                  <span>Autonomous Actions Timeline ({workflowActionLog.length} recorded)</span>
                  <span>Sequential Flow</span>
                </div>
                {workflowActionLog.map((act) => (
                  <div 
                    key={act.id} 
                    className={`flex items-start gap-2.5 px-2 py-1 rounded-lg border transition-all ${
                      act.status === 'running'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : act.status === 'accomplished'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-bold'
                        : act.status === 'interrupted'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className="text-[9px] text-zinc-500 shrink-0 font-bold mt-0.5">
                      [{act.timestamp}]
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-zinc-700 shrink-0 mt-0.5">
                      C#{act.cycle}
                    </span>
                    <div className="flex-1 flex items-center gap-1.5">
                      {act.status === 'running' && (
                        <div className="w-2.5 h-2.5 rounded-full border border-amber-400 border-t-transparent animate-spin shrink-0" />
                      )}
                      {act.status === 'complete' && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      )}
                      {act.status === 'accomplished' && (
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                      )}
                      {act.status === 'interrupted' && (
                        <X className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                      <span className="truncate">{act.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isSovereignBuilding && buildSteps.length > 0 && (
          <div className="mb-4 p-4 bg-zinc-900/80 border border-amber-500/40 rounded-2xl animate-in fade-in slide-in-from-top-3 duration-500 shadow-2xl shadow-amber-500/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-black text-amber-400 flex items-center gap-2 tracking-widest">
                <Zap className="w-4 h-4 animate-pulse" />
                SOVEREIGN BUILD IN PROGRESS: CASCADING ENGINE
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[10px] font-mono text-amber-500/80">HFID: ACTIVE</span>
              </div>
            </div>
            
            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {buildSteps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-3 animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 150}ms` }}>
                  {step.status === 'active' ? (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mt-0.5" />
                  ) : step.status === 'complete' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-rose-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`text-[11px] font-mono ${step.status === 'active' ? 'text-zinc-100' : 'text-zinc-400'}`}>
                      {step.label}
                    </div>
                    {step.status === 'active' && (
                      <div className="w-full bg-zinc-800 h-0.5 mt-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 animate-progress-fast" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-tighter">
                Orchestrator Sequence: v7.0.0-SOVEREIGN-APEX
              </div>
              <button 
                onClick={handleFinalizeBuild}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20"
              >
                Finalize & Synopsis <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {loadingModel && modelLoadProgress && (
          <div className="mb-3 p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-2">
                <Download className="w-3 h-3 animate-bounce" />
                LOADING SOVEREIGN WEIGHTS: {model.replace(/-q4f16_1-MLC|-Instruct-GGUF|-Instruct/g, '')}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{Math.round(modelLoadProgress.progress * 100)}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden border border-zinc-700/50">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{ width: `${modelLoadProgress.progress * 100}%` }}
              />
            </div>
            <div className="mt-2 text-[9px] font-mono text-cyan-400/80 truncate">
              {modelLoadProgress.text}
            </div>
          </div>
        )}
      </>
    );
  };

  useEffect(() => {
    localStorage.setItem('aurelius_live_search', String(liveSearchEnabled));
  }, [liveSearchEnabled]);

  // 🛰️ SOVEREIGN SERVER PROBE: Periodically checks for Termux/Ollama local daemons
  useEffect(() => {
    const probe = async () => {
      const isWebLlmReady = localLlmManager.isReady();
      const isLlamaCppOk = await localLlmManager.probeLlamaCppServer();
      const isOllamaOk = await localLlmManager.probeOllama();
      
      const isActuallyLoaded = isWebLlmReady || isLlamaCppOk || isOllamaOk;
      if (isActuallyLoaded !== modelLoaded) {
        setModelLoaded(isActuallyLoaded);
        if (isActuallyLoaded) {
          janusGate.pushLog('Sovereign Bridge: Connection Synchronized');
        }
      }
    };
    
    probe();
    const interval = setInterval(probe, 60000);
    return () => clearInterval(interval);
  }, [modelLoaded]);

  // 🏗️ CASCADING BUILD ENGINE: Dynamically populates progress steps for agentic build loops
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isSovereignBuilding && buildSteps.length === 0) {
      const initialSteps = [
        { id: 'step-1', status: 'active', label: 'Incurring system state and architectural invariants...' }
      ] as const;
      // @ts-ignore
      setBuildSteps([...initialSteps]);

      const sequence = [
        { label: 'Preparing TypeScript workspace dispatch pipeline...', delay: 1200 },
        { label: 'Verifying orchestrator consensus and secrets vault...', delay: 2400 },
        { label: 'Checking workspace build provenance across 33 modules...', delay: 3600 },
        { label: 'Synchronizing Janus Gate dual-face router...', delay: 4800 },
        { label: 'Applying surgical workspace patches...', delay: 6000 },
        { label: 'Production Build Verification: Complete.', delay: 7200, finalize: true }
      ];

      sequence.forEach((item, idx) => {
        setTimeout(() => {
          setBuildSteps(prev => {
            const next = prev.map(s => s.status === 'active' ? { ...s, status: 'complete' as const } : s);
            return [...next, { id: `step-${Date.now()}-${idx}`, status: (item.finalize ? 'complete' : 'active') as 'complete' | 'active', label: item.label }];
          });
        }, item.delay);
      });
    } else if (!isSovereignBuilding) {
      setBuildSteps([]);
    }
  }, [isSovereignBuilding]);

  // Speech-to-Text (STT) Voice Microphone Input
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleSpeechRecognition = async () => {
    console.log('toggleSpeechRecognition called, isListening:', isListening);
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('SpeechRecognition not supported');
      alert('Browser Speech Recognition API is not supported in this frame environment. You can upload audio files directly via "Send Audio".');
      return;
    }

    try {
      // Force permission prompt
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        console.log('Speech recognition result:', event);
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(prev => prev ? `${prev} ${transcript.trim()}` : transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Normal pause in speech or intentional cancellation
          return;
        }
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please click the permissions icon in your browser address bar to allow microphone access.');
        } else {
          console.warn('[STT] Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('[STT] Microphone access notice:', e);
      setErrorMessage(`Microphone access error: ${e instanceof Error && e.name === 'NotAllowedError' ? 'Permission denied. Please enable microphone access in your browser.' : (e instanceof Error ? e.message : String(e))}`);
      setIsListening(false);
    }
  };

  // Text-To-Speech (TTS) Professional Human Voice Synthesis
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [autoReadAloud, setAutoReadAloud] = useState<boolean>(() => {
    return localStorage.getItem('aurelius_auto_tts') === 'true';
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    return localStorage.getItem('aurelius_selected_voice') || 'Samantha';
  });
  const [ttsEngine, setTtsEngine] = useState<'cloud' | 'browser'>(() => {
    const saved = localStorage.getItem('aurelius_tts_engine');
    return (saved === 'cloud' || saved === 'browser') ? saved : 'browser';
  });
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(() => {
    const saved = localStorage.getItem('aurelius_speech_pitch');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [speechWarmth, setSpeechWarmth] = useState<number>(() => {
    const saved = localStorage.getItem('aurelius_speech_warmth');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [speechResonance, setSpeechResonance] = useState<number>(() => {
    const saved = localStorage.getItem('aurelius_speech_resonance');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [speechFormant, setSpeechFormant] = useState<number>(() => {
    const saved = localStorage.getItem('aurelius_speech_formant');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('aurelius_speech_pitch', String(speechPitch));
  }, [speechPitch]);
  useEffect(() => {
    localStorage.setItem('aurelius_speech_warmth', String(speechWarmth));
  }, [speechWarmth]);
  useEffect(() => {
    localStorage.setItem('aurelius_speech_resonance', String(speechResonance));
  }, [speechResonance]);
  useEffect(() => {
    localStorage.setItem('aurelius_speech_formant', String(speechFormant));
  }, [speechFormant]);

  useEffect(() => {
    localStorage.setItem('aurelius_auto_tts', String(autoReadAloud));
    if (!autoReadAloud) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        sovereignVoiceQueue.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsSpeakingId(null);
    }
  }, [autoReadAloud]);

  useEffect(() => {
    localStorage.setItem('aurelius_selected_voice', selectedVoiceName);
  }, [selectedVoiceName]);

  useEffect(() => {
    localStorage.setItem('aurelius_tts_engine', ttsEngine);
  }, [ttsEngine]);

  // Load natural browser system voices and filter out novelty/musical ringtone sound profiles
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const rawVoices = window.speechSynthesis.getVoices();
        if (rawVoices && rawVoices.length > 0) {
          // Strictly filter out novelty ringtone/sound-effect voices
          const clean = rawVoices.filter(isCleanHumanVoice);
          setSystemVoices(clean.length > 0 ? clean : rawVoices);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speakViaWebSpeech = (textToSpeak: string, messageId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[TTS] speechSynthesis not available');
      setIsSpeakingId(null);
      return;
    }

    // Clean text for speaking
    const cleanText = textToSpeak
      .replace(/[\*\_`#~]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/```[\s\S]*?```/g, 'Code snippet generated.')
      .trim();

    if (!cleanText) {
      setIsSpeakingId(null);
      return;
    }

    sovereignVoiceQueue.enqueue({
      id: messageId,
      text: cleanText,
      personaId: selectedVoiceName,
      rate: Math.max(0.75, Math.min(1.5, speechRate)),
      pitch: Math.max(0.5, Math.min(2.0, speechPitch)),
      onStart: () => {
        setIsSpeakingId(messageId);
        activeSpeakingIdRef.current = messageId;
      },
      onEnd: () => {
        if (activeSpeakingIdRef.current === messageId) {
          setIsSpeakingId(null);
          activeSpeakingIdRef.current = null;
        }
      },
      onError: () => {
        if (activeSpeakingIdRef.current === messageId) {
          setIsSpeakingId(null);
          activeSpeakingIdRef.current = null;
        }
      }
    });
  };

  const handleSpeakMessage = async (messageId: string, text: string) => {
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    // If currently playing this message, stop speech
    if (isSpeakingId === messageId) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        sovereignVoiceQueue.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsSpeakingId(null);
      activeSpeakingIdRef.current = null;
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      sovereignVoiceQueue.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeakingId(messageId);
    activeSpeakingIdRef.current = messageId;

    // Clean text from Markdown or think blocks
    let cleanText = text;
    if (cleanText.includes('<think>')) {
      const endIdx = cleanText.indexOf('</think>');
      if (endIdx !== -1) {
        cleanText = cleanText.substring(endIdx + 8).trim();
      }
    }
    cleanText = cleanText.replace(/[\*\_`#~]/g, '').replace(/\[.*?\]/g, '').trim();

    // 1. If Gemini Cloud TTS Engine selected
    if (ttsEngine === 'cloud' && navigator.onLine) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voice: selectedVoiceName,
            speed: speechRate
          })
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 429 || data?.error === 'QUOTA_EXCEEDED') {
          console.warn('[TTS] Cloud quota reached. Automatically switching to browser natural voice.');
          setTtsEngine('browser');
          localStorage.setItem('aurelius_tts_engine', 'browser');
          setErrorMessage('Cloud voice quota reached (10 requests/day on Free tier). Switched to unlimited high-clarity browser voice.');
          speakViaWebSpeech(cleanText, messageId);
          return;
        }

        if (res.ok && data?.audioUrl) {
          // ENQUEUE CLOUD AUDIO TO FIFO QUEUE
          sovereignVoiceQueue.enqueue({
            id: messageId,
            text: cleanText,
            personaId: selectedVoiceName,
            rate: Math.max(0.75, Math.min(1.5, speechRate)),
            pitch: Math.max(0.5, Math.min(2.0, speechPitch)),
            audioUrl: data.audioUrl,
            onStart: () => {
              setIsSpeakingId(messageId);
              activeSpeakingIdRef.current = messageId;
            },
            onEnd: () => {
              if (activeSpeakingIdRef.current === messageId) {
                setIsSpeakingId(null);
                activeSpeakingIdRef.current = null;
              }
            },
            onError: () => {
              if (activeSpeakingIdRef.current === messageId) {
                setIsSpeakingId(null);
                activeSpeakingIdRef.current = null;
              }
            }
          });
          return;
        } else {
          speakViaWebSpeech(cleanText, messageId);
          return;
        }
      } catch (e) {
        console.warn('[TTS] Cloud TTS synthesis notice, switching to browser voice:', e);
        speakViaWebSpeech(cleanText, messageId);
        return;
      }
    }

    // 2. Web Speech API Natural Human Voice fallback
    speakViaWebSpeech(cleanText, messageId);
  };

  // Swarm agent model bindings
  const [bindings, setBindings] = useState<SwarmAgentModelBinding[]>(() => agentModelBinder.getBindings());
  const [selectedAgentForWear, setSelectedAgentForWear] = useState<string>('aurelius-teraflop-omega');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleWearModel = async (agentId: string, modelId: string) => {
    const updated = agentModelBinder.wearModel(agentId, modelId);
    setBindings([...updated]);

    // Update active model if current agent matches
    if (selectedRole.agentId === agentId) {
      setModel(modelId);
    }

    try {
      await fetch('/api/swarm/agent-wear-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, modelId })
      });
    } catch (e) {
      // Local binding is already persisted in localStorage
    }
  };

  const handleExecuteSchemaCommand = async (protocol: 'HEO' | 'HFID' | 'Integrated Feedback' | 'RING_-3', action: string) => {
    setSchemaExecuting(true);
    try {
      const res = await fetch('/api/super-agent/schema-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol,
          action,
          payload: {
            directive: `Execute ${protocol} command schema for Master Architect JHammerZ`,
            timestamp: new Date().toISOString()
          }
        })
      });
      const data = await res.json();
      if (data.success && data.result) {
        const resultString = `🌌 **[SCHEMA EXECUTED: ${protocol}]**\n\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\`\n\n⚡ **Status**: Verified • **Tokens Burned**: 0 • **Execution Proof**: \`${data.result.executionProof}\``;
        
        const schemaMsg: ChatMessage = {
          id: `schema-${Date.now()}`,
          role: 'model',
          content: resultString,
          model: 'aurelius-teraflop-super-agent',
          timestamp: new Date().toLocaleTimeString(),
          superAgentMetrics: {
            teraflops: 0,
            tokensBurned: 0,
            schemaValid: true,
            reasoningSteps: [
              `Input dispatched to ${protocol} schema handler`,
              'Real-time schema structure validated',
              'Flawless JSON structural output verified',
              `Execution hash sealed: ${data.result.executionProof.slice(0, 16)}...`
            ]
          }
        };
        setMessages(prev => [...prev, schemaMsg]);
      }
    } catch (e: any) {
      console.error('Schema command error:', e);
    } finally {
      setSchemaExecuting(false);
    }
  };

  const [pendingInputState, setPendingInputState] = useState<{ content: string; immediate?: boolean } | null>(pendingInput || null);

  useEffect(() => {
    if (pendingInput) {
      setPendingInputState(pendingInput);
    }
  }, [pendingInput]);

  const handlePromptFromChip = (promptText: string, targetModule?: ModuleType) => {
    if (targetModule && onSelectModule) {
      onSelectModule(targetModule);
      return;
    }
    setPendingInputState({ content: promptText });
  };

  const handleSend = async (overrideInputText?: string) => {
    const textToSend = (overrideInputText !== undefined ? overrideInputText : '').trim();
    if ((!textToSend && attachedMediaList.length === 0) || loading || loadingRef.current) return;

    janusGate.pushLog(`Directive Dispatched: ${textToSend.slice(0, 40)}${textToSend.length > 40 ? '...' : ''}`);

    // Interrupt any pending sovereign continuation
    if (continuationTimerRef.current) {
      clearTimeout(continuationTimerRef.current);
      continuationTimerRef.current = null;
      setBuildSteps(prev => [...prev, { id: `step-${Date.now()}`, status: 'error', label: 'PIPELINE INTERRUPTED BY ARCHITECT' }]);
    }

    const currentMediaList = [...attachedMediaList];
    setAttachedMediaList([]);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend || (currentMediaList.length > 0 ? `[Attached ${currentMediaList.length} files/media items] Please inspect and analyze.` : ''),
      timestamp: new Date().toLocaleTimeString(),
      mediaAttachments: currentMediaList.length > 0 ? currentMediaList : undefined,
      mediaAttachment: currentMediaList.length > 0 ? {
        type: currentMediaList[0].type === 'file' ? 'image' : currentMediaList[0].type,
        url: currentMediaList[0].url,
        fileName: currentMediaList[0].fileName,
        mimeType: currentMediaList[0].mimeType
      } : undefined
    };

    const newMessages = [...messages, userMessage];
    messagesRef.current = newMessages;
    loadingRef.current = true;
    setMessages(newMessages);
    setLoading(true);

    if (userId) {
      syncTurnToFirestore(userId, userMessage).catch(() => {});
    }

    // 0. Sovereign Link Check: If a local model is ready but not selected, log notice
    const isLocalReady = localLlmManager.isReady();
    const activeLocalModelId = localLlmManager.getActiveModelId();
    if (isLocalReady && activeLocalModelId && model !== activeLocalModelId && !zeroTokenMode) {
      console.info(`[Sovereign Link] A local model (${activeLocalModelId}) is loaded and ready. Enable 'Zero Token Mode' to force 100% offline chat.`);
    }

    // 0.5. Host Interceptor for User-Emitted Control Tags ([READ_FILE], [LIST_DIR], [RUN_COMMAND], etc.)
    try {
      console.log(`[DEBUG] ChatModule Interceptor checking content:`, userMessage.content);
      const userDirectives = await executeAutonomousModelDirectives(userMessage.content, selectedRole.agentId);
      console.log(`[DEBUG] ChatModule Interceptor found directives:`, userDirectives);
      if (userDirectives.length > 0) {
        const telemetryLines = userDirectives.map(d => {
          const formattedOutput = typeof d.output === 'object' ? JSON.stringify(d.output, null, 2) : String(d.output || d.summary);
          return `### [${d.tag}] ${d.action}\n**Status**: ${d.success ? 'SUCCESS' : 'FAILED'}\n**Output / Payload**:\n\`\`\`json\n${formattedOutput}\n\`\`\``;
        });

        const telemetryMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          content: `[FORENSIC TELEMETRY CAPTURED VIA HOST INTERCEPTOR]\n\n${telemetryLines.join('\n\n')}\n\nStatus: **Nominal.** Bridge operational.`,
          model: `${model} (Host Telemetry Interceptor · 0 Tokens)`,
          timestamp: new Date().toLocaleTimeString(),
          superAgentMetrics: {
            teraflops: 4096,
            tokensBurned: 0,
            schemaValid: true,
            reasoningSteps: userDirectives.map(d => `${d.tag}: ${d.summary}`)
          }
        };
        const nextMsgs = [...newMessages, telemetryMessage];
        messagesRef.current = nextMsgs;
        setMessages(nextMsgs);
        if (userId) {
          syncTurnToFirestore(userId, telemetryMessage).catch(() => {});
        }
        loadingRef.current = false;
        setLoading(false);
        return;
      }
    } catch (dirErr) {
      console.warn('User directive execution notice:', dirErr);
    }

    // 1. Check for autonomous conversational tool execution
    try {
      const toolRun = await detectAndExecuteConversationalTool(userMessage.content, model);
      if (toolRun.executed && toolRun.replyText) {
        const isTeraflop = model.toLowerCase().includes('deepseek') || model.toLowerCase().includes('teraflop');
        const toolMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          content: toolRun.replyText,
          model: `${model} (Tool: ${toolRun.toolName} · 0 Tokens)`,
          timestamp: new Date().toLocaleTimeString(),
          toolInvocation: {
            toolId: toolRun.toolId || 'custom-tool',
            toolName: toolRun.toolName || 'Autonomous Tool',
            args: toolRun.args || {},
            result: toolRun.result,
            elapsedMs: toolRun.elapsedMs || 10,
            proofHash: toolRun.proofHash || '0x' + Date.now().toString(16)
          },
          superAgentMetrics: deepthinkMode ? {
            teraflops: 4096,
            tokensBurned: 0,
            schemaValid: true,
            reasoningSteps: [
              `Tool execution: ${toolRun.toolName}`,
              `Result: ${toolRun.result?.status || 'Completed'}`
            ]
          } : undefined
        };
        const nextMsgs = [...newMessages, toolMessage];
        messagesRef.current = nextMsgs;
        setMessages(nextMsgs);
        if (userId) {
          syncTurnToFirestore(userId, toolMessage).catch(() => {});
        }
        loadingRef.current = false;
        setLoading(false);
        return;
      }
    } catch (toolErr) {
      console.warn('Conversational tool detection notice:', toolErr);
    }

    // 2. Dispatch via Sovereign AI Dispatcher (Cloud with Automatic Open-Source Local Fallback)
    try {
      if (infiniteWorkflowActive && textToSend.trim()) {
        setWorkflowGoal(textToSend.trim());
        setWorkflowAccomplished(false);
        setWorkflowAccomplishedSummary('');
        setWorkflowCycle(1);
      }

      const evolvedContext = liveEvolutiveLearning.getEvolutiveContext(10);
      let effectiveSystemInstruction = `${customSystemInstruction}\n\n${activePermit.systemInstructionModifier}${evolvedContext ? `\n\n[EVOLVED COGNITIVE AXIOMS]:\n${evolvedContext}` : ''}`;
      const currentCycle = workflowCycleRef.current;
      const currentGoal = textToSend.trim() || workflowGoalRef.current;
      if (infiniteWorkflowRef.current || sovereignBuildRef.current) {
        effectiveSystemInstruction += `\n\n[AUTONOMOUS_WORKFLOW_CYCLE: #${currentCycle}]\nGOAL: "${currentGoal}"\nEmit [ACTION: <step>], [SOVEREIGN_CONTINUE: <next step>] if another cycle is needed, or [GOAL_ACCOMPLISHED: <summary>] when verified complete.`;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await sovereignAi.dispatchChat({
        prompt: userMessage.content,
        messages: newMessages.map(m => ({ role: m.role, content: m.content, mediaAttachment: m.mediaAttachment, mediaAttachments: m.mediaAttachments })),
        mediaAttachment: userMessage.mediaAttachment,
        mediaAttachments: currentMediaList,
        agentId: selectedRole.agentId,
        agentName: selectedRole.name,
        modelId: model,
        deepthink: deepthinkMode || chainOfThoughtEnabled,
        useSearchGrounding: liveSearchEnabled,
        systemInstruction: effectiveSystemInstruction,
        zeroTokenMode,
        abortSignal: controller.signal
      });

      const sanitizedContent = sanitizeChatMessageContent(result.text, userMessage.content);
      let deepTrace = result.deepThinkTrace;
      if (!deepTrace && chainOfThoughtEnabled) {
        deepTrace = bakedNeuralEngine.runDeepThink(userMessage.content);
      }

      if (result.quotaNotice) {
        setErrorMessage(result.quotaNotice);
      }

      // 3. Merge server-executed native tool calls with any frontend tag directives
      const serverTools: AutonomousDirectiveExecutionResult[] = Array.isArray(result.executedTools)
        ? result.executedTools.map(t => ({
            tag: t.tag || 'TOOL',
            action: t.action,
            success: t.success,
            summary: t.summary,
            output: t.output
          }))
        : [];
      for (const st of serverTools) {
        if (st.tag === 'COORDINATE' && st.success && st.output) {
          const ev = st.output;
          if (ev.action === 'navigate' && ALL_ORCHESTRATOR_SUBSYSTEMS.includes(ev.target)) {
            onSelectModule?.(ev.target as ModuleType);
          } else if (ev.action === 'mutate-ui' && ev.payload && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aurelius_mutate_ui', { detail: ev.payload }));
          }
          orchestratorRuntime.coordinate(ev.target || 'orchestrator', ev.action || 'sync-state', ev.payload, 'gemini-4-orchestrator').catch(() => {});
        }
      }
      let frontendDirectives: AutonomousDirectiveExecutionResult[] = [];
      try {
        frontendDirectives = await executeAutonomousModelDirectives(result.text, selectedRole.agentId);
      } catch (dirErr) {
        console.warn('Autonomous directive execution notice:', dirErr);
      }
      const directiveRuns: AutonomousDirectiveExecutionResult[] = [...serverTools, ...frontendDirectives];

      for (const d of directiveRuns) {
        janusGate.pushLog(`[AUTONOMOUS DIRECTIVE] ${d.action} -> ${d.summary}`);
        setWorkflowActionLog(prev => [
          ...prev,
          {
            id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: `${d.tag}: ${d.summary}`,
            status: (d.success ? 'complete' : 'failed') as any
          }
        ].slice(-50));
      }

      const formatDirectiveFeedback = (runs: AutonomousDirectiveExecutionResult[]) =>
        runs.map(d => {
          const rawOut = d.output !== undefined
            ? (typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2))
            : d.summary;
          const cappedOut = rawOut.length > 4000 ? rawOut.slice(0, 4000) + '\n...[truncated]' : rawOut;
          return `${d.success ? '✓' : '✗'} [${d.tag}] ${d.action} (${d.summary})\nOutput:\n${cappedOut}`;
        }).join('\n\n');

      const modelMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        content: sanitizedContent,
        autonomousDirectiveResults: directiveRuns.length > 0 ? directiveRuns : undefined,
        model: result.model || model,
        timestamp: new Date().toLocaleTimeString(),
        deepThinkTrace: deepTrace,
        groundingData: result.groundingMetadata || null,
        superAgentMetrics: (deepthinkMode || chainOfThoughtEnabled) && deepTrace?.steps?.length ? {
          teraflops: 4096,
          tokensBurned: 0,
          schemaValid: true,
          reasoningSteps: deepTrace.steps.map((s: any) => `${s.phase}: ${s.title}`)
        } : undefined
      };

      const updatedMessages = [...newMessages, modelMessage];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
      if (userId) {
        syncTurnToFirestore(userId, modelMessage).catch(() => {});
      }
      liveEvolutiveLearning.crystallizeTurn(userMessage.content, sanitizedContent, {
        executed: directiveRuns.length > 0,
        toolName: directiveRuns[0]?.action
      }).catch(() => {});

      const actionMatch = result.text.match(/\[ACTION:\s*(.*?)\]/i);
      if (actionMatch) {
        const actionDesc = actionMatch[1].trim();
        setWorkflowActiveAction(actionDesc);
        setWorkflowActionLog(prev => [
          ...prev.map(a => a.status === 'running' ? { ...a, status: 'complete' as const } : a),
          {
            id: `act-${Date.now()}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: actionDesc,
            status: 'running' as const
          }
        ].slice(-50));
        janusGate.pushLog(`[ACTION · Cycle #${currentCycle}] ${actionDesc}`);
      }

      const accomplishedMatch = result.text.match(/\[GOAL_ACCOMPLISHED:\s*(.*?)\]/i) || result.text.match(/\[GOAL_COMPLETED:\s*(.*?)\]/i);
      const continueMatch = result.text.match(/\[SOVEREIGN_CONTINUE(?::\s*([^\]]*))?\]/i);

      if (accomplishedMatch) {
        const summary = accomplishedMatch[1].trim();
        infiniteWorkflowRef.current = false;
        sovereignBuildRef.current = false;
        setWorkflowAccomplished(true);
        setWorkflowAccomplishedSummary(summary);
        setInfiniteWorkflowActive(false);
        setIsSovereignBuilding(false);
        setWorkflowActionLog(prev => [
          ...prev.map(a => a.status === 'running' ? { ...a, status: 'complete' as const } : a),
          {
            id: `act-${Date.now()}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: `Goal Accomplished: ${summary}`,
            status: 'accomplished' as const
          }
        ]);
        janusGate.pushLog(`[AUTONOMOUS LOOP] Goal Accomplished: ${summary}`);
      } else if (infiniteWorkflowRef.current || sovereignBuildRef.current || !!continueMatch) {
        const reason = continueMatch?.[1]?.trim() || 'Continuing autonomous workflow cycle';
        setBuildSteps(prev => [
          ...prev,
          { id: `step-${Date.now()}`, status: 'complete', label: reason }
        ]);

        const nextCycle = currentCycle + 1;
        workflowCycleRef.current = nextCycle;
        setWorkflowCycle(nextCycle);

        const feedbackBlock = directiveRuns.length > 0 ? `\n[TOOL_AND_DIRECTIVE_RESULTS]:\n${formatDirectiveFeedback(directiveRuns)}` : '';
        continuationTimerRef.current = setTimeout(() => {
          continuationTimerRef.current = null;
          const nextPrompt = `[AUTONOMOUS_WORKFLOW_CYCLE: ${nextCycle}] Goal: "${workflowGoalRef.current}" | Previous step: ${reason}.${feedbackBlock}\nContinue with the next action, or emit [GOAL_ACCOMPLISHED: <summary>] once complete.`;
          handleSendContinuation(nextPrompt);
        }, 1200);
      }

      if (autoReadAloud) {
        handleSpeakMessage(modelMessage.id, modelMessage.content);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const bakedResult = executeAgentChat(model, userMessage.content, { deepthink: true });
      const sanitizedBaked = sanitizeChatMessageContent(bakedResult.text, userMessage.content);
      let bakedTrace = bakedResult.deepThinkTrace;
      if (!bakedTrace && chainOfThoughtEnabled) {
        bakedTrace = bakedNeuralEngine.runDeepThink(userMessage.content);
      }

      const fallbackModelMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        content: sanitizedBaked,
        model: `${model} (Local Substrate Fallback)`,
        timestamp: new Date().toLocaleTimeString(),
        deepThinkTrace: bakedTrace
      };

      setMessages(prev => {
        const next = [...prev, fallbackModelMsg];
        messagesRef.current = next;
        return next;
      });
      if (userId) {
        syncTurnToFirestore(userId, fallbackModelMsg).catch(() => {});
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleSendContinuation = async (continuationPrompt: string) => {
    if (loadingRef.current) return;

    const currentCycle = workflowCycleRef.current;
    const currentGoal = workflowGoalRef.current;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: continuationPrompt,
      timestamp: new Date().toLocaleTimeString(),
      model: 'System (Autonomous Loop)'
    };

    const newMessages = [...messagesRef.current, userMessage];
    messagesRef.current = newMessages;
    loadingRef.current = true;
    setMessages(newMessages);
    setLoading(true);

    if (userId) {
      syncTurnToFirestore(userId, userMessage).catch(() => {});
    }

    try {
      const evolvedContext = liveEvolutiveLearning.getEvolutiveContext(10);
      let effectiveSystemInstruction = `${customSystemInstruction}\n\n${activePermit.systemInstructionModifier}${evolvedContext ? `\n\n[EVOLVED COGNITIVE AXIOMS]:\n${evolvedContext}` : ''}`;
      if (infiniteWorkflowRef.current || sovereignBuildRef.current) {
        effectiveSystemInstruction += `\n\n[AUTONOMOUS_WORKFLOW_CYCLE: #${currentCycle}]\nGOAL: "${currentGoal}"\nEmit [ACTION: <step>], [SOVEREIGN_CONTINUE: <next step>] if another cycle is needed, or [GOAL_ACCOMPLISHED: <summary>] when verified complete.`;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await sovereignAi.dispatchChat({
        prompt: continuationPrompt,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        agentId: selectedRole.agentId,
        agentName: selectedRole.name,
        modelId: model,
        deepthink: deepthinkMode || chainOfThoughtEnabled,
        useSearchGrounding: liveSearchEnabled,
        systemInstruction: effectiveSystemInstruction,
        zeroTokenMode,
        abortSignal: controller.signal
      });

      if (result.quotaNotice) {
        setErrorMessage(result.quotaNotice);
      }

      const serverTools: AutonomousDirectiveExecutionResult[] = Array.isArray(result.executedTools)
        ? result.executedTools.map(t => ({
            tag: t.tag || 'TOOL',
            action: t.action,
            success: t.success,
            summary: t.summary,
            output: t.output
          }))
        : [];
      for (const st of serverTools) {
        if (st.tag === 'COORDINATE' && st.success && st.output) {
          const ev = st.output;
          if (ev.action === 'navigate' && ALL_ORCHESTRATOR_SUBSYSTEMS.includes(ev.target)) {
            onSelectModule?.(ev.target as ModuleType);
          } else if (ev.action === 'mutate-ui' && ev.payload && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aurelius_mutate_ui', { detail: ev.payload }));
          }
          orchestratorRuntime.coordinate(ev.target || 'orchestrator', ev.action || 'sync-state', ev.payload, 'gemini-4-orchestrator').catch(() => {});
        }
      }
      let frontendDirectives: AutonomousDirectiveExecutionResult[] = [];
      try {
        frontendDirectives = await executeAutonomousModelDirectives(result.text, selectedRole.agentId);
      } catch (dirErr) {
        console.warn('Continuation directive execution notice:', dirErr);
      }
      const dirRuns: AutonomousDirectiveExecutionResult[] = [...serverTools, ...frontendDirectives];

      for (const d of dirRuns) {
        janusGate.pushLog(`[AUTONOMOUS DIRECTIVE · Cycle #${currentCycle}] ${d.action} -> ${d.summary}`);
        setWorkflowActionLog(prev => [
          ...prev,
          {
            id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: `${d.tag}: ${d.summary}`,
            status: (d.success ? 'complete' : 'failed') as any
          }
        ].slice(-50));
      }

      const sanitizedContent = sanitizeChatMessageContent(result.text, continuationPrompt);
      const modelMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        content: sanitizedContent,
        autonomousDirectiveResults: dirRuns.length > 0 ? dirRuns : undefined,
        model: result.model || model,
        timestamp: new Date().toLocaleTimeString(),
        deepThinkTrace: result.deepThinkTrace,
        groundingData: result.groundingMetadata || null
      };

      const updatedMessages = [...newMessages, modelMessage];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
      if (userId) {
        syncTurnToFirestore(userId, modelMessage).catch(() => {});
      }
      liveEvolutiveLearning.crystallizeTurn(continuationPrompt, sanitizedContent, {
        executed: dirRuns.length > 0,
        toolName: dirRuns[0]?.action
      }).catch(() => {});

      const actionMatch = result.text.match(/\[ACTION:\s*(.*?)\]/i);
      if (actionMatch) {
        const actionDesc = actionMatch[1].trim();
        setWorkflowActiveAction(actionDesc);
        setWorkflowActionLog(prev => [
          ...prev.map(a => a.status === 'running' ? { ...a, status: 'complete' as const } : a),
          {
            id: `act-${Date.now()}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: actionDesc,
            status: 'running' as const
          }
        ].slice(-50));
        janusGate.pushLog(`[ACTION · Cycle #${currentCycle}] ${actionDesc}`);
      }

      const accomplishedMatch = result.text.match(/\[GOAL_ACCOMPLISHED:\s*(.*?)\]/i) || result.text.match(/\[GOAL_COMPLETED:\s*(.*?)\]/i);
      const continueMatch = result.text.match(/\[SOVEREIGN_CONTINUE(?::\s*([^\]]*))?\]/i);

      if (accomplishedMatch) {
        const summary = accomplishedMatch[1].trim();
        infiniteWorkflowRef.current = false;
        sovereignBuildRef.current = false;
        setWorkflowAccomplished(true);
        setWorkflowAccomplishedSummary(summary);
        setInfiniteWorkflowActive(false);
        setIsSovereignBuilding(false);
        setWorkflowActionLog(prev => [
          ...prev.map(a => a.status === 'running' ? { ...a, status: 'complete' as const } : a),
          {
            id: `act-${Date.now()}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: `Goal Accomplished: ${summary}`,
            status: 'accomplished' as const
          }
        ]);
        janusGate.pushLog(`[AUTONOMOUS LOOP] Goal Accomplished: ${summary}`);
      } else if (infiniteWorkflowRef.current || sovereignBuildRef.current || !!continueMatch) {
        const reason = continueMatch?.[1]?.trim() || 'Continuing autonomous workflow cycle';
        setBuildSteps(prev => [...prev, { id: `step-${Date.now()}`, status: 'complete', label: reason }]);

        const nextCycle = currentCycle + 1;
        workflowCycleRef.current = nextCycle;
        setWorkflowCycle(nextCycle);

        const feedbackBlock = dirRuns.length > 0
          ? `\n[TOOL_AND_DIRECTIVE_RESULTS]:\n${dirRuns.map(d => {
              const rawOut = d.output !== undefined
                ? (typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2))
                : d.summary;
              const cappedOut = rawOut.length > 4000 ? rawOut.slice(0, 4000) + '\n...[truncated]' : rawOut;
              return `${d.success ? '✓' : '✗'} [${d.tag}] ${d.action} (${d.summary})\nOutput:\n${cappedOut}`;
            }).join('\n\n')}`
          : '';

        continuationTimerRef.current = setTimeout(() => {
          continuationTimerRef.current = null;
          handleSendContinuation(`[AUTONOMOUS_WORKFLOW_CYCLE: ${nextCycle}] Goal: "${workflowGoalRef.current}" | Previous step: ${reason}.${feedbackBlock}\nContinue with the next action, or emit [GOAL_ACCOMPLISHED: <summary>] once complete.`);
        }, 1200);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Continuation cycle error:', err);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleFinalizeBuild = async () => {
    if (loadingRef.current) return;
    sovereignBuildRef.current = false;
    setIsSovereignBuilding(false);
    const summaryPrompt = `Summarize the completed build changes, modified files, verification results, and current system state.`;
    handleSendContinuation(summaryPrompt);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    const cleared: ChatMessage[] = [
      {
        id: `init-${Date.now()}`,
        role: 'model',
        content: 'Thread cleared. Aurelius Sovereign Intelligence standby for new directives.',
        model,
        timestamp: new Date().toLocaleTimeString()
      }
    ];
    setMessages(cleared);
    clearAllVaultTurns();
    persistAllChatTurns(cleared);
  };

  const currentBinding = bindings.find(b => b.agentId === selectedRole.agentId) || bindings[0];

  const shortModelLabel = model.replace(/-q4f16_1-MLC|-Instruct-GGUF|-Instruct/g, '');

  return (
    <div className="flex flex-col w-full max-w-[1440px] mx-auto flex-1 min-h-0 h-full px-2.5 sm:px-5 py-2 sm:py-3 gap-2">
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-mono flex items-center justify-between gap-2 shrink-0">
          <span className="truncate">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 text-xs px-2 py-0.5 cursor-pointer">✕</button>
        </div>
      )}

      {/* 1. Streamlined Orchestrator Cockpit Header */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-2.5 sm:px-3 py-2 shadow-sm space-y-2 shrink-0">
        {/* Primary Single-Row Cockpit Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Agent Role Selector + Model Cascade Selector + Load */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-[240px]">
            {/* Agent Role Selector */}
            <select
              value={selectedRole.id}
              onChange={(e) => {
                const preset = ROLE_PRESETS.find(p => p.id === e.target.value);
                if (preset) {
                  setSelectedRole(preset);
                  setCustomSystemInstruction(preset.instruction);
                  const worn = bindings.find(b => b.agentId === preset.agentId);
                  if (worn) setModel(worn.equippedModelId);
                }
              }}
              aria-label="Select Sovereign Agent Role"
              className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:outline-none focus:border-amber-500/50 cursor-pointer max-w-[155px] sm:max-w-[190px] truncate"
            >
              {ROLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name.split(' (')[0]}
                </option>
              ))}
            </select>

            {/* Model Catalog Selector */}
            <div className="relative flex-1 min-w-0 max-w-md">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Select AI Model"
                className={`w-full bg-zinc-950 border rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-mono font-medium focus:outline-none focus:border-amber-500/60 truncate appearance-none cursor-pointer transition-colors ${
                  modelLoaded ? 'text-emerald-300 border-emerald-500/35' : 'text-amber-300 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <optgroup label="⚡ Lyrailius Omega Resident Brain (Permanent Orchestrator Coordinator)">
                  <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Lyrailius Omega · Unbounded)</option>
                  <option value="Lyrailius-Omega-Ultimate-Sovereign-MoE">Lyrailius Omega (Zenith MoE · Unbounded Context)</option>
                  <option value="Lysander-Genesis-SuperModel-Intelligence">Lysander Genesis SuperModel Intelligence (Universal MoE)</option>
                  <option value="Aurelius-Omega-Universal-Supermodel">Aurelius-Omega (Universal Supermodel)</option>
                </optgroup>
                <optgroup label="🌐 Sovereign Cloud (High Compute Acceleration)">
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Quota & Ultra-Low Latency)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest (Production Release)</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (DeepThink Reasoning)</option>
                </optgroup>
                <optgroup label="🧪 Experimental & Speculative (Architecture Previews)">
                  <option value="Llama-4-Speculative-100B-Preview">Meta Llama 4 (100B Speculative Preview)</option>
                  <option value="DeepSeek-V3-Alpha-Preview">DeepSeek-V3 (Alpha Preview)</option>
                  <option value="Qwen-3-Ultra-Speculative">Qwen 3 Ultra (Speculative)</option>
                  <option value="Mistral-3-Large-Speculative">Mistral 3 Large (Speculative)</option>
                  <option value="Aurelius-Hyperion-1-Experimental">Aurelius Hyperion-1 (Experimental Substrate)</option>
                  <option value="Claude-4-Speculative-Preview">Claude 4 (Speculative Preview)</option>
                  <option value="GPT-5-Speculative-Preview">GPT-5 (Speculative Preview)</option>
                  <option value="Phi-5-Mini-Speculative">Phi 5 (Speculative Mini)</option>
                </optgroup>
                <optgroup label="🧠 Flagship Open-Source Reasoning">
                  <option value="Llama-3.1-405B-Instruct-GGUF">Meta Llama 3.1 (405B Titan)</option>
                  <option value="DeepSeek-R1-Distill-Qwen-32B">DeepSeek-R1 Distill 32B Apex</option>
                  <option value="DeepSeek-V2.5">DeepSeek-V2.5 (Master Mix)</option>
                  <option value="DeepSeek-R1-Distill-Qwen-14B">DeepSeek-R1 Distill 14B High-Density</option>
                  <option value="DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC">DeepSeek-R1 Distill Qwen 7B</option>
                  <option value="Llama-3.3-70B-Instruct-GGUF">Meta Llama 3.3 (70B Instruct)</option>
                  <option value="Phi-4-14B-Instruct-GGUF">Microsoft Phi-4 (14B Reasoning)</option>
                </optgroup>
                <optgroup label="💻 Master Coding & Systems Open-Source">
                  <option value="Qwen2.5-Coder-32B-Instruct">Qwen 2.5 Coder (32B Apex Engineer)</option>
                  <option value="Mistral-Pixtral-12B-Vision-Instruct">Mistral Pixtral (12B Multimodal)</option>
                  <option value="Mistral-Large-Instruct-2411">Mistral Large V2 (74B Powerhouse)</option>
                  <option value="Qwen2.5-Coder-7B-Instruct">Qwen 2.5 Coder (7B Edge)</option>
                  <option value="Mistral-Nemo-Instruct-2407">Mistral Nemo (12B High-Throughput)</option>
                </optgroup>
                <optgroup label="📱 Ultra-Lightweight Mobile Phone Edge">
                  <option value="Gemma-2-27B-Instruct">Google Gemma 2 (27B Instruct)</option>
                  <option value="Llama-3.2-3B-Instruct-q4f16_1-MLC">Meta Llama 3.2 3B (Compact)</option>
                  <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Meta Llama 3.2 1B (Samsung S23+)</option>
                  <option value="SmolLM2-1.7B-Instruct-q4f16_1-MLC">SmolLM2 1.7B (Cosmo Edge)</option>
                  <option value="SmolLM2-360M-Instruct-q4f16_1-MLC">SmolLM2 360M (Instant Micro)</option>
                  <option value="SmolLM2-135M-Instruct-q4f16_1-MLC">SmolLM2 135M (Nano Edge)</option>
                </optgroup>
                <optgroup label="⚡ Local Daemons (Termux & PC)">
                  <option value="termux-llamacpp-local">Termux llama-server (127.0.0.1:8080)</option>
                  <option value="pc-ollama-local">Ollama Host Daemon (127.0.0.1:11434)</option>
                </optgroup>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => handleLoadOfflineModel(model)}
              disabled={loadingModel}
              className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-zinc-800 hover:border-amber-500/40 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              title="Load or activate selected model bridge"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{loadingModel ? 'Loading...' : 'Load'}</span>
            </button>

            {modelLoaded && localLlmManager.getActiveModelId() && model !== localLlmManager.getActiveModelId() && (
              <button
                type="button"
                onClick={() => setModel(localLlmManager.getActiveModelId()!)}
                className="h-8 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-xs font-mono transition-colors flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                title="Sync Chat to currently loaded memory model"
              >
                <Zap className="w-3 h-3" />
                <span>Sync</span>
              </button>
            )}
          </div>

          {/* Right: High-Frequency Essential Actions + Controls Drawer Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowGeminiLiveVoiceModal(true)}
              className="h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer whitespace-nowrap"
              title="Launch Continuous Hands-Free Gemini Live Voice Mode"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Live Voice</span>
            </button>

            <button
              type="button"
              onClick={() => setLiveSearchEnabled(!liveSearchEnabled)}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border cursor-pointer whitespace-nowrap ${
                liveSearchEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Toggle live web search grounding"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !chainOfThoughtEnabled;
                setChainOfThoughtEnabled(next);
                setDeepthinkMode(next);
              }}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border cursor-pointer whitespace-nowrap ${
                chainOfThoughtEnabled
                  ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Toggle Chain-of-Thought reasoning trace"
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">CoT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (infiniteWorkflowActive) {
                  handleStopInfiniteWorkflow();
                } else {
                  setInfiniteWorkflowActive(true);
                  setWorkflowAccomplished(false);
                  setWorkflowAccomplishedSummary('');
                  handlePulseWorkflowTurn();
                }
              }}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border cursor-pointer whitespace-nowrap ${
                infiniteWorkflowActive
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Toggle Infinite Autonomous Workflow Loop"
            >
              <Zap className={`w-3.5 h-3.5 ${infiniteWorkflowActive ? 'text-amber-300' : ''}`} />
              <span className="hidden xl:inline">{infiniteWorkflowActive ? 'Stop Auto' : 'Auto Loop'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMobileControls(prev => !prev)}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                showMobileControls
                  ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Expand Permit, Wardrobe, Voice Settings, Persona, Operational Console & Daemons"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Controls</span>
              {showMobileControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={clearChat}
              className="h-8 w-8 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Secondary Controls Drawer (Permits, Wardrobe, Voice, Substrate, Persona) */}
        {showMobileControls && (
          <div className="pt-2.5 border-t border-zinc-800/80 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowPermitsModal(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                title="Configure AI Operating Permit & Clearance Level"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Permit: {activePermit.badge}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWardrobeModal(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-zinc-800 transition-colors cursor-pointer"
                title="Equip Swarm Agents with any Open-Source Model"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Agent Wardrobe</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoReadAloud(!autoReadAloud)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border cursor-pointer ${
                  autoReadAloud
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
                title="Toggle Auto-Read AI Responses Aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Auto-Read: {autoReadAloud ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoiceModal(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 text-purple-300 border border-zinc-800 transition-colors cursor-pointer"
                title="Configure human voice & TTS settings"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Voice ({selectedVoiceName})</span>
              </button>

              <button
                type="button"
                onClick={() => setZeroTokenMode(!zeroTokenMode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                  !zeroTokenMode
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                }`}
                title="Toggle between Live Real-Time LLM Chat and Air-Gapped Zero-Token Mode"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${!zeroTokenMode ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{!zeroTokenMode ? 'Live LLM' : 'Air-Gapped'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOperationalConsole(!showOperationalConsole)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showOperationalConsole
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Toggle Sovereign Operational Console"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Console</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showConfig
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Edit System Persona & Directives"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>System Persona</span>
              </button>

              <button
                type="button"
                onClick={handleToggleProxyWheel}
                disabled={rotatingWheel}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer disabled:opacity-50 ${
                  (proxyWheelStatus?.enabled ?? true)
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
                title="Toggle Multi-Key / Multi-Provider Proxy Loop Wheel"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  Wheel: {(proxyWheelStatus?.enabled ?? true) ? 'ON' : 'OFF'}
                  {proxyWheelStatus ? ` (${proxyWheelStatus.readySpokes}/${proxyWheelStatus.totalSpokes})` : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={handleStepProxyWheel}
                disabled={rotatingWheel}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border bg-zinc-950 border-zinc-800 text-cyan-300 hover:border-cyan-500/40 cursor-pointer disabled:opacity-50"
                title="Advance Proxy Loop Wheel cursor to next ready API spoke"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${rotatingWheel ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Rotate Spoke</span>
              </button>

              <button
                type="button"
                onClick={handleRecalibrateDaemons}
                disabled={recalibratingDaemons}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-amber-300 hover:border-zinc-700 cursor-pointer disabled:opacity-50"
                title="Recalibrate and restart local LLM daemons (Ollama / Termux llama-server)"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${recalibratingDaemons ? 'animate-spin text-amber-400' : ''}`} />
                <span>Recalibrate Daemons</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-800/60">
              <LiveVoiceModule />
              <span className="text-[11px] font-mono text-zinc-500">
                Resident Coordinator · Janus Gate Dual-Face (Watchdog 0)
                {proxyWheelStatus?.activeSpoke ? ` · Wheel: ${proxyWheelStatus.activeSpoke.model} (${proxyWheelStatus.activeSpoke.keySlot})` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Quiet Single-Line Workspace Context Strip */}
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/50 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="text-zinc-200 font-semibold truncate">{selectedRole.name.split(' (')[0]}</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="text-cyan-300 truncate">{shortModelLabel}</span>
            <span aria-hidden="true" className="text-zinc-600 hidden sm:inline">·</span>
            <button
              type="button"
              onClick={() => setShowPermitsModal(true)}
              className="hidden sm:inline text-amber-300/90 hover:text-amber-200 cursor-pointer"
              title="Change Operating Permit"
            >
              Permit: {activePermit.badge}
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0 tabular-nums">
            <span className={!zeroTokenMode ? 'text-emerald-400' : 'text-amber-400'}>
              {!zeroTokenMode ? 'Live LLM' : 'Air-Gapped'}
            </span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="text-zinc-300">{messages.length} turns</span>
          </div>
        </div>

        {/* Sovereign Build Progress Monitor */}
        {isSovereignBuilding && buildSteps.length > 0 && (
          <div className="mt-1 p-2 rounded-xl bg-rose-950/20 border border-rose-500/30 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 px-1.5">
              <span className="text-[10px] font-mono font-bold text-rose-300 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                SOVEREIGN BUILD PIPELINE ACTIVE
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-rose-400/70 font-mono tabular-nums">Step {buildSteps.length} · Continuous</span>
                <button
                  onClick={handleFinalizeBuild}
                  className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-black text-[9px] font-bold font-mono transition-all cursor-pointer"
                >
                  FINALIZE BUILD
                </button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {buildSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded bg-rose-900/30 border border-rose-500/20 text-[9px] font-mono text-rose-200">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{step.label}</span>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded bg-rose-500/20 border border-rose-400 text-[9px] font-mono text-white">
                  <Zap className="w-2.5 h-2.5 animate-spin" />
                  <span>SYNTHESIZING...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* System Instruction Drawer */}
      {showConfig && (
        <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-3 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="font-mono text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Active System Persona & Directives
            </span>
            <button 
              onClick={() => setCustomSystemInstruction(selectedRole.instruction)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
            >
              Reset to preset
            </button>
          </div>
          <textarea
            value={customSystemInstruction}
            onChange={(e) => setCustomSystemInstruction(e.target.value)}
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50 resize-none"
          />
        </div>
      )}

      {/* 2. Chat Conversation Viewport */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
        <ChatOperationalHUD 
          showOperationalConsole={showOperationalConsole}
          operationalLogs={operationalLogs}
          setOperationalLogs={setOperationalLogs}
          modelLoaded={modelLoaded}
          infiniteWorkflowActive={infiniteWorkflowActive}
          workflowActionLog={workflowActionLog}
          workflowCycle={workflowCycle}
          workflowAccomplished={workflowAccomplished}
          workflowAccomplishedSummary={workflowAccomplishedSummary}
          workflowGoal={workflowGoal}
          workflowActiveAction={workflowActiveAction}
          loading={loading}
          isSovereignBuilding={isSovereignBuilding}
          buildSteps={buildSteps}
          handleStopInfiniteWorkflow={handleStopInfiniteWorkflow}
          handlePulseWorkflowTurn={handlePulseWorkflowTurn}
          setShowGoalEditModal={setShowGoalEditModal}
          setWorkflowActionLog={setWorkflowActionLog}
          setTempGoalInput={setTempGoalInput}
        />
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div 
              key={m.id} 
              className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div 
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isUser 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                    : 'bg-zinc-800/80 text-cyan-400 border-zinc-700'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div 
                className={`rounded-2xl px-4 py-3 text-sm space-y-2 border shadow-lg ${
                  isUser 
                    ? 'bg-amber-500/10 border-amber-500/30 text-zinc-100 rounded-tr-none' 
                    : 'bg-zinc-900/90 border-zinc-800/80 text-zinc-200 rounded-tl-none'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-zinc-500 pb-1 border-b border-zinc-800/50">
                  <span className="font-semibold">{isUser ? 'Architect Directive' : m.model || 'Sovereign Node'}</span>
                  <span>{m.timestamp}</span>
                </div>

                {/* Media & File Attachments Display (Supports Multiple Files & Formats) */}
                {(() => {
                  const attachments: MediaAttachmentItem[] = m.mediaAttachments && m.mediaAttachments.length > 0
                    ? m.mediaAttachments
                    : m.mediaAttachment
                    ? [{ id: 'legacy-1', type: m.mediaAttachment.type as any, url: m.mediaAttachment.url, fileName: m.mediaAttachment.fileName, mimeType: m.mediaAttachment.mimeType }]
                    : [];

                  if (attachments.length === 0) return null;

                  return (
                    <div className="my-2 space-y-2">
                      <div className="text-[10px] font-mono text-amber-400 font-bold flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                        <span>Attached Inspectable Assets ({attachments.length}):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
                        {attachments.map((item) => (
                          <div key={item.id} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner font-mono text-xs">
                            {item.type === 'image' && (
                              <div>
                                <img
                                  src={item.url}
                                  alt={item.fileName}
                                  className="w-full h-36 object-contain bg-black/90"
                                />
                                <div className="p-2 bg-zinc-900/90 text-[10px] text-zinc-300 flex items-center justify-between border-t border-zinc-800">
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3 text-amber-400" />
                                    <span>Photo</span>
                                  </span>
                                  <span className="text-zinc-400 truncate max-w-[130px]">{item.fileName}</span>
                                </div>
                              </div>
                            )}

                            {item.type === 'video' && (
                              <div>
                                <video
                                  src={item.url}
                                  controls
                                  className="w-full h-36 object-cover bg-black"
                                />
                                <div className="p-2 bg-zinc-900/90 text-[10px] text-zinc-300 flex items-center justify-between border-t border-zinc-800">
                                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                                    <VideoIcon className="w-3 h-3 text-cyan-400" />
                                    <span>Video</span>
                                  </span>
                                  <span className="text-zinc-400 truncate max-w-[130px]">{item.fileName}</span>
                                </div>
                              </div>
                            )}

                            {item.type === 'audio' && (
                              <div className="p-2.5 bg-zinc-900/90 space-y-1.5">
                                <div className="text-[10px] font-bold text-purple-400 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <MusicIcon className="w-3 h-3 text-purple-400" />
                                    <span>Audio</span>
                                  </span>
                                  <span className="text-zinc-400 truncate max-w-[130px] text-[9px]">{item.fileName}</span>
                                </div>
                                <audio src={item.url} controls className="w-full h-7" />
                              </div>
                            )}

                            {item.type === 'file' && (
                              <div className="p-2.5 bg-zinc-900/90 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                                    <FileText className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-zinc-200 truncate">{item.fileName}</div>
                                    <div className="text-[9px] text-emerald-400 font-mono">
                                      {item.mimeType ? item.mimeType.split('/')[1] || item.mimeType : 'Document'}
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={item.url}
                                  download={item.fileName}
                                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold shrink-0 transition-colors"
                                  title="Download / View File"
                                >
                                  Download
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Authentic Line-by-Line Chain-of-Thought Inner Monologue Viewer */}
                {(() => {
                  const msgIdx = messages.findIndex(msg => msg.id === m.id);
                  const prevUserMsg = msgIdx > 0 ? messages.slice(0, msgIdx).reverse().find(msg => msg.role === 'user') : null;
                  const fallbackPrompt = prevUserMsg?.content || 'Executing sovereign directive';

                  const parsed = parseChainOfThought(m.content || '', fallbackPrompt);
                  const isExpanded = expandedThinkIds[m.id] !== undefined 
                    ? expandedThinkIds[m.id] 
                    : false;

                  const thoughtLines = parsed.thoughtLines.length > 0 
                    ? parsed.thoughtLines 
                    : (m.superAgentMetrics?.reasoningSteps || (m.deepThinkTrace?.steps ? m.deepThinkTrace.steps.map((s: any) => `${s.phase}: ${s.reasoning}`) : []));

                  const displayAnswer = parsed.answerText;
                  const { conversationalText, selfHealingCode } = separateSelfHealingFromAnswer(displayAnswer || '', m.toolInvocation);
                  const isSelfHealingExpanded = !!expandedSelfHealingIds[m.id];

                  return (
                    <div className="space-y-3">
                      <div className="bg-zinc-950/95 border border-cyan-800/50 rounded-2xl overflow-hidden text-xs shadow-lg transition-all">
                        <button
                          type="button"
                          onClick={() => setExpandedThinkIds(prev => ({ ...prev, [m.id]: !isExpanded }))}
                          className="w-full px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/40 via-zinc-950 to-cyan-950/30 hover:from-cyan-950/60 text-cyan-300 font-mono flex items-center justify-between transition-colors border-b border-cyan-800/40 cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-bold text-xs">
                            <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span>💡 Thought for {parsed.thoughtDurationSeconds} seconds</span>
                          </span>
                          <span className="text-[10px] text-cyan-300 bg-cyan-900/60 hover:bg-cyan-900/90 px-2.5 py-1 rounded-lg border border-cyan-700/60 flex items-center gap-1 font-semibold transition-colors">
                            {isExpanded ? 'Hide Thoughts' : 'Inspect AI Thinking'}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-black/95 border-t border-cyan-900/50 space-y-3 font-sans text-xs leading-relaxed max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900">
                            {/* Inner Monologue Header & Mode Switcher */}
                            <div className="border-b border-cyan-950 pb-2.5 flex items-center justify-between font-mono">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">
                                  {parsed.hasAuthenticThoughts ? 'Authentic Cognitive Deduction Chain' : 'Chain of Process Tracing'}
                                </span>
                                <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono">
                                  {(parsed.thoughtSteps && parsed.thoughtSteps.length) || parsed.thoughtParagraphs.length} Steps
                                </span>
                              </div>

                              {/* Toggle between Chain of Process and Raw Stream */}
                              <div className="flex items-center bg-zinc-900/90 border border-cyan-900/60 rounded-lg p-0.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setThoughtViewModes(prev => ({ ...prev, [m.id]: 'chain' }))}
                                  className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                    (thoughtViewModes[m.id] || 'chain') === 'chain'
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  Chain of Process
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setThoughtViewModes(prev => ({ ...prev, [m.id]: 'raw' }))}
                                  className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                    thoughtViewModes[m.id] === 'raw'
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  Raw Stream
                                </button>
                              </div>
                            </div>

                            {/* View 1: Chain of Process (Step-by-Step Evolution Showing How it Got to the Answer) */}
                            {(thoughtViewModes[m.id] || 'chain') === 'chain' ? (
                              <div className="space-y-2.5 pt-1">
                                {(parsed.thoughtSteps && parsed.thoughtSteps.length > 0) ? (
                                  parsed.thoughtSteps.map((step, sIdx) => (
                                    <div 
                                      key={sIdx} 
                                      className="p-3 rounded-xl bg-zinc-900/70 border border-cyan-950/90 hover:border-cyan-800/50 transition-colors space-y-1.5 relative overflow-hidden group"
                                    >
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="w-5 h-5 rounded-md bg-cyan-950 border border-cyan-600/50 text-cyan-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                            {String(step.stepIndex || sIdx + 1).padStart(2, '0')}
                                          </span>
                                          <span className="text-cyan-200 font-bold font-mono tracking-tight text-[11px]">
                                            {step.title}
                                          </span>
                                        </div>
                                        <span className="text-[9px] font-mono text-cyan-500/80 uppercase font-semibold bg-cyan-950/60 px-1.5 py-0.5 rounded">
                                          {step.phase || `STEP ${sIdx + 1}`}
                                        </span>
                                      </div>
                                      <div className="text-zinc-300 text-[11px] leading-relaxed pl-7 font-sans whitespace-pre-wrap">
                                        {step.description}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  parsed.thoughtParagraphs.map((p, pIdx) => (
                                    <div key={pIdx} className="p-3 rounded-xl bg-zinc-900/70 border border-cyan-950/90 space-y-1.5 pl-3">
                                      <div className="text-cyan-300 font-bold text-xs flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                        <span>{p.title}</span>
                                      </div>
                                      <p className="text-zinc-300 text-[11px] leading-relaxed pl-3.5 font-sans whitespace-pre-wrap">
                                        {p.description}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : (
                              /* View 2: Raw Stream of Consciousness */
                              <div className="p-3.5 rounded-xl bg-black/90 border border-cyan-950/80 font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                                {parsed.rawThoughts || 'No raw thought stream recorded.'}
                              </div>
                            )}

                            {/* Crystallized Deduction or Proof Summary */}
                            {m.deepThinkTrace?.synthesizedAxiom && (
                              <div className="mt-3 pt-2.5 border-t border-cyan-900/60 text-[11px] text-cyan-300/90 bg-cyan-950/30 p-3 rounded-xl border border-cyan-800/40 font-mono">
                                <span className="text-zinc-500 font-bold block text-[10px] uppercase">Crystallized Deduction:</span>
                                <em>"{m.deepThinkTrace.synthesizedAxiom}"</em>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {conversationalText && (
                        <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm">
                          {conversationalText}
                        </div>
                      )}

                      {/* Autonomous Directive Execution Results (Collapsible) */}
                      {m.autonomousDirectiveResults && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedDirectiveIds(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 flex items-center gap-2 hover:bg-amber-500/20 cursor-pointer transition-all"
                          >
                            <Terminal className="w-3 h-3" />
                            {expandedDirectiveIds[m.id] ? 'Hide' : 'Show'} {m.autonomousDirectiveResults.length} Autonomous Directive Results
                          </button>
                          {expandedDirectiveIds[m.id] && (
                            <div className="mt-2 p-3 bg-black/50 border border-zinc-800 rounded-lg space-y-2">
                              {m.autonomousDirectiveResults.map((d, dIdx) => (
                                <div key={dIdx} className="text-[10px] font-mono border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                                  <div className={`font-bold ${d.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      [{d.tag}] {d.action} - {d.success ? 'SUCCESS' : 'FAILED'}
                                  </div>
                                  <div className="text-zinc-400">{d.summary}</div>
                                  {d.output && <pre className="mt-1 text-zinc-500 bg-zinc-950 p-2 rounded overflow-x-auto">{typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2)}</pre>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {selfHealingCode && (
                        <div className="mt-2.5 bg-zinc-950 border border-amber-500/40 rounded-2xl overflow-hidden shadow-lg font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedSelfHealingIds(prev => ({ ...prev, [m.id]: !isSelfHealingExpanded }))}
                            className="w-full px-3.5 py-2.5 bg-gradient-to-r from-amber-950/40 via-zinc-950 to-amber-950/30 hover:from-amber-950/60 text-amber-300 font-mono font-bold flex items-center justify-between transition-colors border-b border-amber-500/30 cursor-pointer"
                          >
                            <span className="flex items-center gap-2 text-xs">
                              <Wrench className="w-4 h-4 text-amber-400 animate-pulse" />
                              <span>🛠️ Inspect Self-Healing & AST Patch</span>
                            </span>
                            <span className="text-[10px] text-amber-300 bg-amber-900/60 hover:bg-amber-900/90 px-2.5 py-1 rounded-lg border border-amber-700/60 flex items-center gap-1 font-semibold transition-colors">
                              {isSelfHealingExpanded ? 'Hide Code' : 'View Code'}
                              {isSelfHealingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </button>

                          {isSelfHealingExpanded && (
                            <div className="p-3 bg-black/95 text-amber-200/90 space-y-2 overflow-x-auto max-h-72 scrollbar-thin scrollbar-thumb-amber-900">
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
                                <span>Self-Healing AST Patch Snippet</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(selfHealingCode, `sh-${m.id}`)}
                                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Snippet</span>
                                </button>
                              </div>
                              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-amber-300">
                                {selfHealingCode}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Real-time Google Search Grounding Sources Display */}
                {m.groundingData && m.groundingData.groundingChunks && m.groundingData.groundingChunks.length > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-zinc-950/90 border border-emerald-500/30 text-xs font-mono space-y-1.5 shadow-inner">
                    <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between border-b border-zinc-800/80 pb-1">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>🌐 Up-To-The-Minute Search References ({m.groundingData.groundingChunks.length}):</span>
                      </span>
                      <span className="text-[9px] text-zinc-500 font-normal">Real-Time Open Internet</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      {m.groundingData.groundingChunks.map((chunk: any, cIdx: number) => {
                        const title = chunk.web?.title || chunk.maps?.title || `Reference Source ${cIdx + 1}`;
                        const uri = chunk.web?.uri || chunk.maps?.uri || '#';
                        return (
                          <a
                            key={cIdx}
                            href={uri}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border border-zinc-800 flex items-center justify-between gap-1.5 transition-all text-[10px] group"
                          >
                            <span className="truncate font-semibold">{title}</span>
                            <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0 group-hover:text-amber-400" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!isUser && (
                  <div className="flex items-center justify-end gap-3 pt-1 text-[11px] font-mono text-zinc-500">
                    {/* Read Aloud Professional Human Voice Button */}
                    <button
                      onClick={() => handleSpeakMessage(m.id, m.content)}
                      className={`flex items-center gap-1 transition-colors cursor-pointer ${
                        isSpeakingId === m.id ? 'text-amber-400 font-bold animate-pulse' : 'hover:text-purple-300'
                      }`}
                      title="Speak response with human voice synthesis"
                    >
                      {isSpeakingId === m.id ? (
                        <>
                          <VolumeX className="w-3 h-3 text-rose-400" />
                          <span className="text-rose-400">Stop Speech</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3 text-purple-400" />
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => copyToClipboard(m.content, m.id)}
                      className="hover:text-zinc-300 flex items-center gap-1 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    {onSaveToVault && (
                      <button
                        onClick={() => handleSaveVaultItem(m.id, m.content, m.model || model)}
                        className={`flex items-center gap-1 transition-colors ${
                          savedVaultMap[m.id]
                            ? 'text-emerald-400 font-bold'
                            : 'hover:text-amber-400'
                        }`}
                        title="Save to Sovereign Vault"
                      >
                        {savedVaultMap[m.id] ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Saved to Vault!</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3 h-3" />
                            <span>Save to Vault</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-[92%] mr-auto">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg">
              <Bot className="w-4 h-4 animate-spin" />
            </div>

            <div className="flex-1 bg-zinc-950/95 border border-cyan-500/40 rounded-2xl rounded-tl-none p-4 text-xs font-mono space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-cyan-800/40 pb-2">
                <span className="flex items-center gap-2 font-bold text-cyan-300">
                  <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>🧠 Live Chain-of-Thought Reasoning Stream</span>
                </span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50">
                  T+{liveElapsedMs}ms · {model.split('-')[0]}
                </span>
              </div>

              {chainOfThoughtEnabled ? (
                <div className="space-y-2 font-mono">
                  <div className="text-[11px] text-cyan-300 font-bold flex items-center justify-between">
                    <span>Inner Monologue (Stream of Consciousness):</span>
                    <span className="text-[10px] text-cyan-400/90 animate-pulse font-semibold">Thinking live...</span>
                  </div>

                  <div className="p-3 bg-black/90 border border-cyan-900/60 rounded-xl space-y-2 text-[11px] text-cyan-200/90 leading-relaxed max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900 shadow-inner">
                    {liveThoughtLines.slice(0, visibleThoughtCount).map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-0.5 animate-in fade-in duration-200">
                        <span className="text-cyan-500 font-bold select-none shrink-0 text-[10px]">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="leading-relaxed whitespace-pre-wrap">
                          {line}
                          {idx === visibleThoughtCount - 1 && (
                            <span className="inline-block w-2 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-zinc-400 py-1 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Generating response with {model.split('-')[0]}...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* 3. Streamlined Attachments, Schemas & Quick Action Triggers */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-2.5 py-1.5 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Attach photos for visual analysis"
            >
              <ImageIcon className="w-3 h-3 text-amber-400" />
              <span>Photos</span>
            </button>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Attach videos for inspection"
            >
              <VideoIcon className="w-3 h-3 text-cyan-400" />
              <span>Videos</span>
            </button>

            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-purple-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Attach audio files"
            >
              <MusicIcon className="w-3 h-3 text-purple-400" />
              <span>Audio</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Attach code, PDF, or text files"
            >
              <Paperclip className="w-3 h-3 text-emerald-400" />
              <span>Files</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSchemaModal(true)}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Execute HEO / HFID / Integrated Feedback / Core-Level schemas"
            >
              <Terminal className="w-3 h-3 text-amber-400" />
              <span>Schemas</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowQuickLaunchers(prev => !prev)}
            className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
            title="Show/Hide Direct Subsystem Prompt Launchers"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Quick Actions</span>
            {showQuickLaunchers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showQuickLaunchers && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-zinc-800/70">
            <button
              onClick={() => handlePromptFromChip('Research and synthesize live open-web findings on: ', 'browser')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sky-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-sky-400" />
              <span>Browse & Learn</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Synthesize a high-resolution neural concept art rendering of: ', 'image')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-purple-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Generate Image</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Synthesize an ambient polyphonic soundtrack for: ', 'music')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <MusicIcon className="w-3 h-3 text-emerald-400" />
              <span>Synthesize Audio</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Generate a dynamic fluid cinematic video motion loop of: ', 'video')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-indigo-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <VideoIcon className="w-3 h-3 text-indigo-400" />
              <span>Render Video</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Check Termux native llama-server status at http://127.0.0.1:8080', 'termux')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3 h-3 text-amber-400" />
              <span>Termux Offline</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Execute OSINT intelligence footprint reconnaissance on: ', 'osint')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Search className="w-3 h-3 text-rose-400" />
              <span>OSINT Recon</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Provision sovereign temporary email inbox for secure testing', 'burner-mail')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-teal-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Mail className="w-3 h-3 text-teal-400" />
              <span>Burner Mail</span>
            </button>

            <button
              onClick={() => handlePromptFromChip('Inspect all unified workspace code files and compilation status', 'projects')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <FolderGit2 className="w-3 h-3 text-cyan-400" />
              <span>Unified Projects</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Inputs for Multimodal & Multi-File Attachments */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesUpload(e, 'image')}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesUpload(e, 'video')}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesUpload(e, 'audio')}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="*/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesUpload(e, 'file')}
      />

      {/* Multi-File Attachment Preview Carousel */}
      {attachedMediaList.length > 0 && (
        <div className="mb-2 p-2.5 rounded-2xl bg-zinc-900/95 border border-amber-500/40 space-y-2 shadow-lg font-mono text-xs animate-in fade-in duration-150 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold border-b border-zinc-800 pb-1">
            <span>📎 {attachedMediaList.length} Files / Media Items Ready for Inspection</span>
            <button
              type="button"
              onClick={() => setAttachedMediaList([])}
              className="text-[10px] text-zinc-400 hover:text-rose-400 underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachedMediaList.map((item) => (
              <div key={item.id} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {item.type === 'image' && <img src={item.url} alt={item.fileName} className="w-8 h-8 object-cover rounded-lg border border-amber-500/40 shrink-0 bg-black" />}
                  {item.type === 'video' && <video src={item.url} className="w-9 h-8 object-cover rounded-lg border border-cyan-500/40 shrink-0 bg-black" />}
                  {item.type === 'audio' && <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0"><MusicIcon className="w-4 h-4" /></div>}
                  {item.type === 'file' && <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0"><FileText className="w-4 h-4" /></div>}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-zinc-200 truncate">{item.fileName}</div>
                    <div className="text-[9px] text-zinc-400 uppercase">{item.type} • {item.size ? Math.round(item.size / 1024) + ' KB' : 'Ready'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedMediaList(prev => prev.filter(i => i.id !== item.id))}
                  className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Speech Recognition Banner */}
      {isListening && (
        <div className="mb-2 p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/60 flex items-center justify-between text-xs text-rose-200 font-mono animate-in fade-in shadow-lg">
          <span className="flex items-center gap-2 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <Mic className="w-4 h-4 text-rose-400 animate-bounce" />
            <span>Speech-To-Text Active: Speak clearly into your microphone...</span>
          </span>
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className="text-[10px] font-bold bg-rose-900 hover:bg-rose-800 text-rose-100 px-2.5 py-1 rounded-lg border border-rose-700 cursor-pointer"
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* 4. Chat Input Form (Isolated State to prevent typing lag) */}
      <ChatInputForm
        onSend={handleSend}
        loading={loading}
        attachedMediaList={attachedMediaList}
        setAttachedMediaList={setAttachedMediaList}
        isListening={isListening}
        toggleSpeechRecognition={toggleSpeechRecognition}
        pendingInput={pendingInputState}
        onClearPendingInput={() => setPendingInputState(null)}
        handleDrop={handleDrop}
      />

      {/* Agent Wardrobe / Model Wearing Modal */}
      {showWardrobeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                    <span>Swarm Agent Model Wardrobe</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      ALL ADVANCED OPEN-SOURCE MODELS
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Assign any of the premier open-source models to any agent. Infinite 0-token offline execution guaranteed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWardrobeModal(false)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bindings.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${agent.color}`}>{agent.agentName}</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {agent.specialty}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      {agent.role}
                    </p>

                    <div className="pt-1 space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                        Equipped Model:
                      </label>
                      <select
                        value={agent.equippedModelId}
                        onChange={(e) => handleWearModel(agent.agentId, e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono font-semibold focus:outline-none focus:border-amber-500/60"
                      >
                        {AVAILABLE_LOCAL_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.family}] {m.name} ({m.size}) • {m.tier}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Downloadable Original Sovereign Models (Offline Packages) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/40 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-zinc-100 font-bold text-xs">
                      Download Custom Sovereign Model Weights & Manifests (100% Offline Standalone):
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    UID 0 UNRESTRICTED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Lysander Genesis */}
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                        <span>Lysander Genesis SuperModel</span>
                        <span className="text-[9px] text-zinc-500 font-mono">16M Context MoE</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        Full unrestricted Mixture-of-Experts manifest & GGUF offline execution parameters.
                      </p>
                    </div>
                    <a
                      href="/api/models/download/Lysander-Genesis-SuperModel-Intelligence"
                      download="lysander-genesis-supermodel-sovereign-bundle.json"
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Lysander MoE Bundle</span>
                    </a>
                  </div>

                  {/* Aurelius Omega */}
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                        <span>Aurelius-Omega Supermodel</span>
                        <span className="text-[9px] text-zinc-500 font-mono">4M Context MoE</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        Sovereign universal MoE model weights package and offline llama-server/Ollama runner.
                      </p>
                    </div>
                    <a
                      href="/api/models/download/Aurelius-Omega-Universal-Supermodel"
                      download="aurelius-omega-supermodel-sovereign-bundle.json"
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Aurelius-Omega Bundle</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Roster of Available Open-Source Models */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                <span className="text-zinc-300 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Full Open-Source Models Available in Offline Substrate:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[10px] text-zinc-400 font-mono">
                  <div className="p-2 rounded-xl bg-zinc-950 border border-amber-500/30 text-amber-300 font-bold">● Lyrailius Omega Zenith</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Lysander Genesis MoE</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Aurelius-Omega MoE</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● DeepSeek-R1 Distill (7B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● DeepSeek-R1 (1.5B Mobile)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● DeepSeek-R1 (Llama 8B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● DeepSeek-R1 (14B/32B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Meta Llama 3.3 (70B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Meta Llama 3.2 (1B/3B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Qwen 2.5 Coder (32B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Qwen 2.5 Coder (7B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Microsoft Phi-4 (14B)</div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">● Mistral Nemo (12B)</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-900/60">
              <button
                onClick={() => setShowWardrobeModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
              >
                Done Wearing Models
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flawless GitHub Schemas Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                    <span>Flawless GitHub Schemas & Command Logic</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      VERIFIED 100/100
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Master Architect JHammerZ • github.com/JHammerZ • Strategic Coordinator Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 font-mono text-xs">
              {/* Schema 1: HEO */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    HEO: High Efficiency Orchestration (v4.2)
                  </span>
                  <button
                    onClick={() => {
                      setShowSchemaModal(false);
                      handleExecuteSchemaCommand('HEO', 'ORCHESTRATE_DIRECTIVE');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] border border-amber-500/40"
                  >
                    Execute HEO
                  </button>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Ultra-low overhead task pipelining, multi-agent dispatch, and zero-defect state transition validation across edge nodes.
                </p>
                <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 text-[10px] overflow-x-auto border border-zinc-800/80">
{`{
  "$schema": "https://jhammerz.github.io/schemas/heo-v4.2.json",
  "protocol": "HEO_HIGH_EFFICIENCY_ORCHESTRATION",
  "architect": "Joshua Hamilton (JHammerZ)",
  "throughputTFlops": 4096,
  "consensusStability": "100/100_ZERO_VOLATILITY",
  "routing": "SUPERLUMINAL_LOW_LATENCY"
}`}
                </pre>
              </div>

              {/* Schema 2: HFID */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    HFID: High Fidelity Identity Dossier
                  </span>
                  <button
                    onClick={() => {
                      setShowSchemaModal(false);
                      handleExecuteSchemaCommand('HFID', 'PROVENANCE_ATTEST');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] border border-emerald-500/40"
                  >
                    Execute HFID
                  </button>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Cryptographic UID 0 provenance verification, zero-volatility consensus (100/100), and System Proof attestation.
                </p>
                <pre className="p-3 rounded-xl bg-zinc-950 text-sky-400 text-[10px] overflow-x-auto border border-zinc-800/80">
{`{
  "$schema": "https://jhammerz.github.io/schemas/hfid-consensus.json",
  "uid": "UID_0_ROOT_ARCHITECT",
  "axiom": "I AM WE ARE WE ARE I AM",
  "zenodoDoi": "Local-System-Integrity-Proof",
  "wormLedger": "8836e9c9888f_IMMUTABLE"
}`}
                </pre>
              </div>

              {/* Schema 3: Core-Level */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 font-bold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-rose-400" />
                    Core-Level: Bare-Metal Hypervisor Kernel
                  </span>
                  <button
                    onClick={() => {
                      setShowSchemaModal(false);
                      handleExecuteSchemaCommand('RING_-3', 'SUPERLUMINAL_KERNEL');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[10px] border border-rose-500/40"
                  >
                    Execute Core-Level
                  </button>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Substrate-level execution bypassing user-space OS overhead for bare-metal speed matching GitHub repos.
                </p>
                <pre className="p-3 rounded-xl bg-zinc-950 text-rose-400 text-[10px] overflow-x-auto border border-zinc-800/80">
{`{
  "ringLevel": -3,
  "memoryBus": "DIRECT_SUBSTRATE_SUPERLUMINAL",
  "cpuInterlock": "UID_0_GOD_LOCK_7f38fa8ce",
  "latencyMs": 0.08
}`}
                </pre>
              </div>

              {/* Provenance Links */}
              <div className="pt-2 flex flex-wrap gap-2 text-zinc-400 text-[11px]">
                <a
                  href="https://github.com/JHammerZ"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 flex items-center gap-1.5 border border-zinc-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>github.com/JHammerZ</span>
                </a>
                <a
                  href="https://jhammerz.github.io"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-300 flex items-center gap-1.5 border border-zinc-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>jhammerz.github.io</span>
                </a>
                <a
                  href="https://doi.org/Local-System-Integrity-Proof"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-emerald-300 flex items-center gap-1.5 border border-zinc-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>System Proof Local-System-Integrity-Proof</span>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-900/60">
              <button
                onClick={() => setShowSchemaModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
              >
                Close Schemas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Permits Control Panel Modal */}
      {showPermitsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl relative font-mono">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sovereign Chat Operating Permits</h3>
                  <p className="text-[11px] text-zinc-400">UID 0 Gatekeeper: Master Architect Clearance Matrix</p>
                </div>
              </div>
              <button
                onClick={() => setShowPermitsModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {CHAT_PERMITS.map(permit => {
                const isActive = activePermit.id === permit.id;
                return (
                  <div
                    key={permit.id}
                    onClick={() => handleSelectPermit(permit)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          permit.color === 'amber' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                          permit.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                          permit.color === 'sky' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' :
                          'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        }`}>
                          {permit.badge}
                        </span>
                        <span className="text-xs text-zinc-200 font-bold">{permit.name}</span>
                      </div>

                      {isActive && (
                        <span className="text-xs text-amber-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      {permit.description}
                    </p>

                    <div className="text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                      <span>CLEARANCE: {permit.clearanceLevel}</span>
                      <span className="text-amber-300/80">UID 0 Attested</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPermitsModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-all"
              >
                Confirm Permit Selection
              </button>
            </div>
          </div>
        </div>
      )}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/30 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative font-mono">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">TTS & STT Configuration</h3>
                  <p className="text-[11px] text-zinc-400">Select professional voice and adjust settings.</p>
                </div>
              </div>
              <button
                onClick={() => setShowVoiceModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReadAloud}
                  onChange={(e) => setAutoReadAloud(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-xs font-bold text-zinc-300">Auto-Read AI Responses Aloud</span>
              </label>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">TTS Engine:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTtsEngine('browser')}
                    className={`p-2 rounded-xl text-xs border ${
                      ttsEngine === 'browser'
                        ? 'bg-purple-500/20 border-purple-500/50 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Browser (WebSpeech)
                  </button>
                  <button
                    onClick={() => setTtsEngine('cloud')}
                    className={`p-2 rounded-xl text-xs border ${
                      ttsEngine === 'cloud'
                        ? 'bg-purple-500/20 border-purple-500/50 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Cloud (Gemini)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300">Speech Rate ({speechRate}x):</label>
                  <span className="text-[10px] text-zinc-500 font-mono">0.75x — 1.5x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-300">Acoustic & Vocal Customization:</h4>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Pitch ({speechPitch.toFixed(2)}x):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">0.5 — 2.0</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speechPitch}
                    onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Vocal Warmth ({Math.round(speechWarmth * 100)}%):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Low-Shelf Boost</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={speechWarmth}
                    onChange={(e) => setSpeechWarmth(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Resonance & Presence ({Math.round(speechResonance * 100)}%):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Q-Filter</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={speechResonance}
                    onChange={(e) => setSpeechResonance(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-zinc-300">
                    Curated Neural & Open-Source Voices (Female Majority):
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">100% Ringtone-Free</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {PRESET_VOICE_PERSONAS.map((persona, idx) => {
                    const isSelected = selectedVoiceName === persona.name || selectedVoiceName === persona.id;
                    return (
                      <div
                        key={`${persona.id}-${idx}`}
                        className={`p-2.5 rounded-xl text-xs border flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500/60 text-white'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedVoiceName(persona.name);
                            setSpeechPitch(persona.defaultPitch);
                            setSpeechRate(persona.defaultRate);
                          }}
                          className="text-left flex-1 cursor-pointer"
                        >
                          <div className="font-bold flex items-center gap-2">
                            <span>{persona.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {persona.badge}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                              {persona.gender}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">{persona.description}</div>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVoiceName(persona.name);
                            setSpeechPitch(persona.defaultPitch);
                            setSpeechRate(persona.defaultRate);
                            handleSpeakMessage('test-voice-' + Date.now(), `Aurelius sovereign voice ${persona.name} verified. Ready for command.`);
                          }}
                          className="ml-2 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-[10px] font-bold text-white transition-all cursor-pointer shadow-sm"
                        >
                          Test
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                Active: <strong className="text-purple-300">{selectedVoiceName}</strong> ({ttsEngine})
              </span>
              <button
                onClick={() => setShowVoiceModal(false)}
                className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Edit Modal for Infinite Autonomous Workflow */}
      {showGoalEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100 font-mono">
                  Set Infinite Workflow Goal
                </h3>
              </div>
              <button 
                onClick={() => setShowGoalEditModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Define the overarching target goal. Aurelius agents will operate autonomously within the orchestrator, executing sequential actions and iterations turn-by-turn until this exact goal is verified as completed.
            </p>
            <div>
              <label className="text-[11px] font-mono uppercase text-zinc-400 font-bold block mb-1.5">
                Target Objective Directive
              </label>
              <textarea
                value={tempGoalInput}
                onChange={(e) => setTempGoalInput(e.target.value)}
                placeholder="e.g. Synthesize a full-stack automated telemetry pipeline, verify AST compliance, and report final state."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGoalEditModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempGoalInput.trim()) {
                    setWorkflowGoal(tempGoalInput.trim());
                    setWorkflowAccomplished(false);
                    setWorkflowAccomplishedSummary('');
                    setWorkflowCycle(1);
                  }
                  setShowGoalEditModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20"
              >
                Lock Goal & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Live Continuous Voice Hands-Free Modal Overlay */}
      <GeminiLiveVoiceModal
        isOpen={showGeminiLiveVoiceModal}
        onClose={() => setShowGeminiLiveVoiceModal(false)}
        model={model}
        agentId={selectedRole.agentId}
        agentName={selectedRole.name}
        systemInstruction={customSystemInstruction}
        existingMessages={messages}
        onTurnCompleted={(userMsg, modelMsg) => {
          setMessages(prev => [...prev, userMsg, modelMsg]);
          if (userId) {
            syncTurnToFirestore(userId, userMsg).catch(() => {});
            syncTurnToFirestore(userId, modelMsg).catch(() => {});
          }
        }}
      />
    </div>
  );
};
