import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Key,
  Copy,
  Check,
  Download,
  Bot,
  UserCheck,
  Plus,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  TrendingUp,
  Activity,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { ModuleType } from '../types';

interface PortfolioHolding {
  symbol: string;
  name: string;
  chain: 'BITCOIN' | 'ETHEREUM' | 'SOLANA' | 'MULTI';
  quantity: number;
  avgEntryPriceUsd: number;
  currentPriceUsd: number;
  marketValueUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  onChainBalanceNative: number;
  lastSyncedAt: string;
}

interface SignedCryptoTransaction {
  id: string;
  walletId: string;
  walletRole: 'PERSONAL_INVESTOR' | 'AGENTIC_AUTONOMOUS';
  timestamp: string;
  type: 'ONCHAIN_TRANSFER' | 'MARKET_BUY' | 'MARKET_SELL' | 'AUTONOMOUS_5M_SIGNAL_EXEC' | 'DEVNET_AIRDROP';
  chain: 'BITCOIN' | 'ETHEREUM' | 'SOLANA';
  symbol: string;
  amountNative: number;
  priceUsdAtExec: number;
  totalValueUsd: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  signatureHex: string;
  signatureAlgorithm?: 'ECDSA-secp256k1-Keccak256' | 'ECDSA-secp256k1-SHA256' | 'Ed25519-RFC8032';
  signerPublicKey?: string;
  signatureVerified?: boolean;
  triggerReason: string;
  conformalCertaintyPct: number;
  broadcastStatus: string;
  explorerUrl: string;
}

interface AutonomousAgenticPolicy {
  enabled: boolean;
  executionMode: 'LIVE_SIGNED_PORTFOLIO' | 'MAINNET_RPC_BROADCAST';
  maxSingleTradeUsd: number;
  minConformalCertaintyPct: number;
  autoActOn5mSignals: boolean;
  allowedActions: string[];
  stopLossProtectPct: number;
  lastAutonomousScanAt: string;
  totalAutonomousTradesExecuted: number;
  cumulativeAutonomousProfitUsd: number;
}

interface SovereignCryptoWallet {
  id: string;
  label: string;
  role: 'PERSONAL_INVESTOR' | 'AGENTIC_AUTONOMOUS';
  createdAt: string;
  encryptionCipher: 'AES-256-GCM';
  addresses: {
    ethereumEip55: string;
    bitcoinSegwit: string;
    bitcoinLegacy: string;
    solanaBase58: string;
  };
  publicKeys: {
    ethereumUncompressedHex: string;
    bitcoinCompressedHex: string;
    solanaHex: string;
  };
  secrets: {
    mnemonic12: string;
    ethereumPrivateKeyHex: string;
    bitcoinWifPrivateKey: string;
    solanaSecretKeyBase58: string;
  };
  cashReserveUsd: number;
  holdings: PortfolioHolding[];
  onChainLiveTelemetry: {
    ethMainnetBalanceEth: number;
    ethGasGwei: number;
    ethBlockNumber: number;
    btcConfirmedSats: number;
    btcUnconfirmedSats: number;
    btcFastestFeeSatVb: number;
    solMainnetBalanceSol: number;
    solDevnetBalanceSol: number;
    solSlot: number;
    lastRpcPollAt: string;
  };
  agenticPolicy?: AutonomousAgenticPolicy;
}

interface SovereignCryptoWalletModuleProps {
  onSelectModule?: (mod: ModuleType) => void;
  onInjectIntoChat?: (prompt: string) => void;
}

export const SovereignCryptoWalletModule: React.FC<SovereignCryptoWalletModuleProps> = ({
  onSelectModule
}) => {
  const [wallets, setWallets] = useState<SovereignCryptoWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('personal-sovereign-vault');
  const [transactions, setTransactions] = useState<SignedCryptoTransaction[]>([]);
  const [livePrices, setLivePrices] = useState<
    Record<string, { price: number; changePct: number; forecast5mPct: number; conformal99Pct: number }>
  >({});
  const [syncingRpc, setSyncingRpc] = useState(false);
  const [runningAgenticCycle, setRunningAgenticCycle] = useState(false);
  const [airdropBusy, setAirdropBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'trade-transfer' | 'agentic-policy' | 'keystore' | 'new-wallet'
  >('overview');

  const [orderAction, setOrderAction] = useState<'BUY' | 'SELL' | 'ONCHAIN_TRANSFER'>('BUY');
  const [orderSymbol, setOrderSymbol] = useState<'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE'>('BTC');
  const [orderAmountUsd, setOrderAmountUsd] = useState<string>('1000');
  const [orderQuantityNative, setOrderQuantityNative] = useState<string>('0.02');
  const [transferToAddress, setTransferToAddress] = useState<string>('');
  const [executingOrder, setExecutingOrder] = useState(false);

  const [revealSecrets, setRevealSecrets] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [connectedBrowserWallet, setConnectedBrowserWallet] = useState<{
    provider: string;
    address: string;
  } | null>(null);

  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [newWalletRole, setNewWalletRole] = useState<'PERSONAL_INVESTOR' | 'AGENTIC_AUTONOMOUS'>(
    'PERSONAL_INVESTOR'
  );
  const [newWalletCash, setNewWalletCash] = useState('15000');
  const [importPrivKeyHex, setImportPrivKeyHex] = useState('');

  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch('/api/crypto/wallets');
      const data = await res.json();
      if (data?.success && Array.isArray(data.wallets)) {
        setWallets(data.wallets);
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        if (data.livePrices) setLivePrices(data.livePrices);
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: `Failed to load Sovereign Crypto Vaults: ${err?.message || 'Error'}`
      });
    }
  }, []);

  useEffect(() => {
    fetchWallets();
    const interval = setInterval(fetchWallets, 8000);
    return () => clearInterval(interval);
  }, [fetchWallets]);

  const activeWallet =
    wallets.find((w) => w.id === selectedWalletId) || wallets[0] || null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSyncOnChainRpc = async () => {
    try {
      setSyncingRpc(true);
      setBanner({
        type: 'info',
        text: 'Polling live Ethereum Mainnet RPC, Bitcoin Mempool.space API, and Solana Mainnet/Devnet RPC nodes...'
      });
      const res = await fetch('/api/crypto/wallets/sync', { method: 'POST' });
      const data = await res.json();
      if (data?.success) {
        setWallets(data.wallets || []);
        setTransactions(data.transactions || []);
        if (data.livePrices) setLivePrices(data.livePrices);
        setBanner({
          type: 'success',
          text: 'Synchronized live on-chain balances, block heights, gas/sat fees, and Laplace-14 (h=2s) market valuations.'
        });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: `RPC Sync error: ${err?.message}` });
    } finally {
      setSyncingRpc(false);
    }
  };

  const handleExecuteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    try {
      setExecutingOrder(true);
      const res = await fetch('/api/crypto/wallets/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: activeWallet.id,
          action: orderAction,
          symbol: orderSymbol,
          amountUsd: orderAction === 'BUY' ? Number(orderAmountUsd) : undefined,
          quantityNative:
            orderAction === 'SELL' || orderAction === 'ONCHAIN_TRANSFER'
              ? Number(orderQuantityNative)
              : undefined,
          toAddress: orderAction === 'ONCHAIN_TRANSFER' ? transferToAddress : undefined
        })
      });
      const data = await res.json();
      if (data?.success) {
        if (Array.isArray(data.wallets)) setWallets(data.wallets);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        setBanner({ type: 'success', text: data.message });
      } else {
        setBanner({ type: 'error', text: data?.message || data?.error || 'Order failed' });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: `Execution error: ${err?.message}` });
    } finally {
      setExecutingOrder(false);
    }
  };

  const handleRunAgenticCycle = async () => {
    try {
      setRunningAgenticCycle(true);
      setBanner({
        type: 'info',
        text: 'UID 0 Agentic Treasury evaluating Laplace-14 (h=2s) 5-minute trajectories & 99% Conformal bounds...'
      });
      const res = await fetch('/api/crypto/wallets/agentic-cycle', { method: 'POST' });
      const data = await res.json();
      if (data?.success) {
        if (Array.isArray(data.wallets)) setWallets(data.wallets);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        setBanner({
          type: 'success',
          text:
            data.actionsLog?.[0] ||
            `Autonomous Agentic cycle completed (${data.executedCount} signed executions).`
        });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: `Agentic cycle error: ${err?.message}` });
    } finally {
      setRunningAgenticCycle(false);
    }
  };

  const handleSolanaDevnetAirdrop = async () => {
    if (!activeWallet) return;
    try {
      setAirdropBusy(true);
      setBanner({
        type: 'info',
        text: `Requesting live 1.0 SOL Devnet airdrop for ${activeWallet.addresses.solanaBase58} via https://api.devnet.solana.com...`
      });
      const res = await fetch('/api/crypto/wallets/sol-airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: activeWallet.id })
      });
      const data = await res.json();
      if (Array.isArray(data?.wallets)) setWallets(data.wallets);
      if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
      setBanner({
        type: data?.success ? 'success' : 'info',
        text: data?.message || 'Solana Devnet airdrop request completed.'
      });
    } catch (err: any) {
      setBanner({ type: 'error', text: `Airdrop notice: ${err?.message}` });
    } finally {
      setAirdropBusy(false);
    }
  };

  const handleConnectBrowserWeb3 = async (type: 'ethereum' | 'solana') => {
    try {
      const win = window as any;
      if (type === 'ethereum') {
        if (!win.ethereum) {
          setBanner({
            type: 'info',
            text: 'No injected EVM browser extension (MetaMask/Rabby) detected in this window; using Sovereign OS native secp256k1 self-custody vault.'
          });
          return;
        }
        const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
        if (Array.isArray(accounts) && accounts[0]) {
          setConnectedBrowserWallet({ provider: 'MetaMask / Web3 EVM', address: accounts[0] });
          setBanner({
            type: 'success',
            text: `Linked external Web3 EVM hardware/browser wallet: ${accounts[0]}`
          });
        }
      } else {
        if (!win.solana) {
          setBanner({
            type: 'info',
            text: 'No injected Solana browser extension (Phantom) detected; using Sovereign OS native ed25519 self-custody vault.'
          });
          return;
        }
        const resp = await win.solana.connect();
        const pub = resp?.publicKey?.toString();
        if (pub) {
          setConnectedBrowserWallet({ provider: 'Phantom / Solana', address: pub });
          setBanner({
            type: 'success',
            text: `Linked external Phantom Solana wallet: ${pub}`
          });
        }
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: `Web3 connection notice: ${err?.message}` });
    }
  };

  const handleCreateCustomWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/crypto/wallets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newWalletLabel || 'Custom Sovereign Multi-Chain Vault',
          role: newWalletRole,
          initialCashUsd: Number(newWalletCash) || 10000,
          importPrivateKeyHex: importPrivKeyHex.trim() || undefined
        })
      });
      const data = await res.json();
      if (data?.success && data.wallet) {
        if (Array.isArray(data.wallets)) setWallets(data.wallets);
        setSelectedWalletId(data.wallet.id);
        setActiveTab('overview');
        setNewWalletLabel('');
        setImportPrivKeyHex('');
        setBanner({
          type: 'success',
          text: `Created & encrypted new multi-chain vault "${data.wallet.label}" (ETH: ${data.wallet.addresses.ethereumEip55.slice(0, 12)}..., BTC: ${data.wallet.addresses.bitcoinSegwit.slice(0, 12)}..., SOL: ${data.wallet.addresses.solanaBase58.slice(0, 12)}...).`
        });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: `Failed to create wallet: ${err?.message}` });
    }
  };

  const handleDownloadKeystoreJson = () => {
    if (!activeWallet) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      os: 'Lysander Sovereign OS · UID 0 Self-Custody Keystore',
      architect: 'Joshua Hamilton (JHammerZ) <https://jhammerz.github.io>',
      license: 'MIT License & JHammerZ Custom Sovereign License (TWENTY 47 PROTOCOL - GENESIS NODE / H-FID v1.1)',
      zenodoDoi: 'https://doi.org/10.5281/zenodo.20778079',
      cipher: activeWallet.encryptionCipher,
      walletId: activeWallet.id,
      label: activeWallet.label,
      role: activeWallet.role,
      addresses: activeWallet.addresses,
      publicKeys: activeWallet.publicKeys,
      secrets: activeWallet.secrets
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWallet.id}-keystore-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const holdingsMarketValue = activeWallet
    ? activeWallet.holdings.reduce((acc, h) => acc + h.marketValueUsd, 0)
    : 0;
  const totalNetWorthUsd = activeWallet
    ? activeWallet.cashReserveUsd + holdingsMarketValue
    : 0;
  const totalUnrealizedPnlUsd = activeWallet
    ? activeWallet.holdings.reduce((acc, h) => acc + h.unrealizedPnlUsd, 0)
    : 0;

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100 flex flex-col h-full overflow-hidden font-mono">
      {/* Top Bar */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-zinc-100">
                SOVEREIGN DUAL-VAULT CRYPTO WALLETS & AGENTIC TREASURY
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                secp256k1 + ed25519 · AES-256-GCM
              </span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-jhammerz-license'))}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer"
                title="Inspect official MIT & JHammerZ Custom Sovereign License Charter (jhammerz.github.io)"
              >
                MIT & JHammerZ License · jhammerz.github.io
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Personal Investor Self-Custody Vault + UID 0 Agentic Autonomous Treasury · Live BTC, ETH & SOL Mainnet RPCs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncOnChainRpc}
            disabled={syncingRpc}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${syncingRpc ? 'animate-spin' : ''}`} />
            <span>{syncingRpc ? 'Polling RPCs...' : 'Sync On-Chain RPCs'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunAgenticCycle}
            disabled={runningAgenticCycle}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Bot className={`w-3.5 h-3.5 ${runningAgenticCycle ? 'animate-spin' : ''}`} />
            <span>
              {runningAgenticCycle ? 'Executing 5m Signal...' : 'Run Agentic 5m Execution'}
            </span>
          </button>
        </div>
      </div>

      {/* Status Notification */}
      {banner && (
        <div
          className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 shrink-0 ${
            banner.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : banner.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              : 'bg-sky-500/15 border-sky-500/40 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            )}
            <span className="truncate font-semibold">{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[11px] px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 text-zinc-300 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Vault Selector Strip */}
      <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">Active Vault:</span>
          {wallets.map((w) => {
            const isSelected = activeWallet?.id === w.id;
            const isAgentic = w.role === 'AGENTIC_AUTONOMOUS';
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWalletId(w.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                  isSelected
                    ? isAgentic
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                      : 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-md'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
                }`}
              >
                {isAgentic ? (
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{w.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-zinc-300">
                  {isAgentic ? 'UID 0 AGENTIC' : 'PERSONAL'}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveTab('new-wallet')}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>New / Import Key</span>
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'overview', label: 'Portfolio & Addresses' },
              { id: 'trade-transfer', label: 'Invest / Buy / Sell / Send' },
              { id: 'agentic-policy', label: 'Agentic 5m Policy' },
              { id: 'keystore', label: 'Private Keys & Seed Backup' }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                activeTab === t.id
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {activeWallet && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Valuation & Multi-Chain Address Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Net Worth Card */}
              <div className="rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-amber-500/30 p-5 flex flex-col justify-between gap-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-amber-300">
                    {activeWallet.role === 'AGENTIC_AUTONOMOUS'
                      ? 'UID 0 AGENTIC TREASURY VALUE'
                      : 'PERSONAL INVESTOR NET WORTH'}
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                    ${totalNetWorthUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span
                      className={`font-bold flex items-center gap-0.5 ${
                        totalUnrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {totalUnrealizedPnlUsd >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {totalUnrealizedPnlUsd >= 0 ? '+' : ''}$
                      {totalUnrealizedPnlUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      Unrealized PnL
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Liquid USD Reserve:</span>
                  <span className="font-bold text-emerald-300">
                    ${activeWallet.cashReserveUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Bitcoin Native SegWit Address Card */}
              <div className="rounded-2xl bg-zinc-900/80 border border-orange-500/30 p-4 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-bold">
                    BITCOIN SEGWIT (BIP-173 · secp256k1)
                  </span>
                  <a
                    href={`https://mempool.space/address/${activeWallet.addresses.bitcoinSegwit}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-orange-300 hover:underline flex items-center gap-1"
                  >
                    <span>Mempool</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex items-center justify-between gap-2">
                  <code className="text-[11px] text-zinc-200 truncate">
                    {activeWallet.addresses.bitcoinSegwit}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(activeWallet.addresses.bitcoinSegwit, 'btc-addr')}
                    className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'btc-addr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>On-Chain Sats: {activeWallet.onChainLiveTelemetry.btcConfirmedSats}</span>
                  <span className="text-orange-300">
                    Fee: {activeWallet.onChainLiveTelemetry.btcFastestFeeSatVb} sat/vB
                  </span>
                </div>
              </div>

              {/* Ethereum EIP-55 Address Card */}
              <div className="rounded-2xl bg-zinc-900/80 border border-sky-500/30 p-4 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                    ETHEREUM / EVM (EIP-55 · Keccak-256)
                  </span>
                  <a
                    href={`https://etherscan.io/address/${activeWallet.addresses.ethereumEip55}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-300 hover:underline flex items-center gap-1"
                  >
                    <span>Etherscan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex items-center justify-between gap-2">
                  <code className="text-[11px] text-zinc-200 truncate">
                    {activeWallet.addresses.ethereumEip55}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(activeWallet.addresses.ethereumEip55, 'eth-addr')}
                    className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'eth-addr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Block #{activeWallet.onChainLiveTelemetry.ethBlockNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleConnectBrowserWeb3('ethereum')}
                    className="text-sky-300 hover:underline cursor-pointer"
                  >
                    {connectedBrowserWallet?.provider.includes('MetaMask')
                      ? `Linked: ${connectedBrowserWallet.address.slice(0, 8)}...`
                      : 'Link MetaMask'}
                  </button>
                </div>
              </div>

              {/* Solana Ed25519 Address Card */}
              <div className="rounded-2xl bg-zinc-900/80 border border-purple-500/30 p-4 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                    SOLANA (Ed25519 · Base58)
                  </span>
                  <a
                    href={`https://solscan.io/account/${activeWallet.addresses.solanaBase58}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-purple-300 hover:underline flex items-center gap-1"
                  >
                    <span>Solscan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex items-center justify-between gap-2">
                  <code className="text-[11px] text-zinc-200 truncate">
                    {activeWallet.addresses.solanaBase58}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(activeWallet.addresses.solanaBase58, 'sol-addr')}
                    className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'sol-addr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Devnet: {activeWallet.onChainLiveTelemetry.solDevnetBalanceSol.toFixed(2)} SOL
                  </span>
                  <button
                    type="button"
                    disabled={airdropBusy}
                    onClick={handleSolanaDevnetAirdrop}
                    className="text-purple-300 hover:underline font-bold cursor-pointer"
                  >
                    {airdropBusy ? 'Airdropping...' : '+1 SOL Devnet Airdrop'}
                  </button>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* TAB: PORTFOLIO OVERVIEW & SIGNED TRANSACTION LEDGER           */}
            {/* ============================================================= */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-zinc-900/75 border border-zinc-800 overflow-hidden shadow-xl">
                  <div className="px-5 py-3.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <h2 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                        Multi-Chain Crypto Holdings & Live Laplace-14 (h=2s) 5-Minute Forecasts
                      </h2>
                    </div>
                    {onSelectModule && (
                      <button
                        type="button"
                        onClick={() => onSelectModule('macro-telemetry')}
                        className="text-xs text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>View Overlapped 20-Market & Crypto Graph</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Asset</th>
                          <th className="py-3 px-4">Quantity</th>
                          <th className="py-3 px-4">Avg Entry</th>
                          <th className="py-3 px-4">Live Price</th>
                          <th className="py-3 px-4">Market Value</th>
                          <th className="py-3 px-4">Unrealized PnL</th>
                          <th className="py-3 px-4">5m Laplace-14 Forecast</th>
                          <th className="py-3 px-4 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {activeWallet.holdings.map((h) => {
                          const lp = livePrices[h.symbol];
                          const forecast5m = lp?.forecast5mPct ?? 0;
                          const cert99 = lp?.conformal99Pct ?? 99.8;
                          return (
                            <tr key={h.symbol} className="hover:bg-zinc-800/40">
                              <td className="py-3 px-4 font-bold text-zinc-100">
                                <div>{h.symbol}</div>
                                <div className="text-[10px] text-zinc-500 font-normal">{h.name}</div>
                              </td>
                              <td className="py-3 px-4 tabular-nums font-semibold">
                                {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                              </td>
                              <td className="py-3 px-4 tabular-nums text-zinc-400">
                                ${h.avgEntryPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-3 px-4 tabular-nums font-bold text-zinc-100">
                                ${h.currentPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-3 px-4 tabular-nums font-bold text-amber-300">
                                ${h.marketValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 tabular-nums">
                                <span
                                  className={`font-bold ${
                                    h.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {h.unrealizedPnlUsd >= 0 ? '+' : ''}$
                                  {h.unrealizedPnlUsd.toLocaleString(undefined, {
                                    minimumFractionDigits: 2
                                  })}{' '}
                                  ({h.unrealizedPnlPct >= 0 ? '+' : ''}
                                  {h.unrealizedPnlPct.toFixed(2)}%)
                                </span>
                              </td>
                              <td className="py-3 px-4 tabular-nums">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                    forecast5m >= 0
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {forecast5m >= 0 ? '+' : ''}
                                  {forecast5m.toFixed(2)}% (5m · {cert99}% Cert)
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrderSymbol(h.symbol as any);
                                      setOrderAction('BUY');
                                      setActiveTab('trade-transfer');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    Buy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrderSymbol(h.symbol as any);
                                      setOrderAction('SELL');
                                      setOrderQuantityNative(String(Number((h.quantity * 0.25).toFixed(4))));
                                      setActiveTab('trade-transfer');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    Sell
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cryptographically Signed Transaction & Execution Ledger */}
                <div className="rounded-2xl bg-zinc-900/75 border border-zinc-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>
                        Cryptographically Signed Transactions & Autonomous Execution Proofs (
                        {transactions.length})
                      </span>
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Signed via secp256k1 / Ed25519 Private Keys
                    </span>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="rounded-xl bg-zinc-950/90 border border-zinc-800/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.walletRole === 'AGENTIC_AUTONOMOUS'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {tx.walletRole === 'AGENTIC_AUTONOMOUS' ? 'UID 0 AGENTIC' : 'PERSONAL'}
                            </span>
                            <span className="font-bold text-zinc-100">
                              {tx.type} · {tx.amountNative} {tx.symbol} ($
                              {tx.totalValueUsd.toLocaleString()})
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(tx.timestamp).toLocaleTimeString()}
                            </span>
                            {tx.signatureAlgorithm && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-mono">
                                {tx.signatureAlgorithm} · {tx.signatureVerified !== false ? 'VERIFIED' : 'UNVERIFIED'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-300">{tx.triggerReason}</p>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">
                            TxHash: <span className="text-sky-400">{tx.txHash}</span> · Sig:{' '}
                            <span className="text-emerald-400">{tx.signatureHex.slice(0, 28)}...</span>
                          </div>
                        </div>
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-sky-300 flex items-center gap-1 shrink-0 self-start sm:self-center"
                        >
                          <span>Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB: INVEST / BUY / SELL / ON-CHAIN TRANSFER DESK             */}
            {/* ============================================================= */}
            {activeTab === 'trade-transfer' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-4">
                  <h2 className="text-base font-black text-zinc-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>Execute Signed Investment Order or On-Chain Transfer</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Executing inside:{' '}
                    <strong className="text-amber-300">{activeWallet.label}</strong> (Available Cash
                    Reserve: <strong className="text-emerald-300">${activeWallet.cashReserveUsd.toLocaleString()}</strong>)
                  </p>

                  <form onSubmit={handleExecuteOrder} className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {(['BUY', 'SELL', 'ONCHAIN_TRANSFER'] as const).map((act) => (
                        <button
                          key={act}
                          type="button"
                          onClick={() => setOrderAction(act)}
                          className={`py-2.5 rounded-xl font-black text-xs cursor-pointer border transition-all ${
                            orderAction === act
                              ? act === 'BUY'
                                ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                                : act === 'SELL'
                                ? 'bg-rose-500 text-white border-rose-400'
                                : 'bg-sky-500 text-zinc-950 border-sky-400'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {act === 'BUY'
                            ? 'BUY / INVEST'
                            : act === 'SELL'
                            ? 'SELL / TAKE PROFIT'
                            : 'ON-CHAIN SEND'}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-300">
                        Select Crypto Asset
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'] as const).map((sym) => (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => setOrderSymbol(sym)}
                            className={`py-2 rounded-xl font-bold text-xs cursor-pointer border ${
                              orderSymbol === sym
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                            }`}
                          >
                            {sym}
                          </button>
                        ))}
                      </div>
                    </div>

                    {orderAction === 'BUY' ? (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-300">
                          Investment Amount in USD ($)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          required
                          value={orderAmountUsd}
                          onChange={(e) => setOrderAmountUsd(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-300">
                          Token Quantity ({orderSymbol})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.00001"
                          required
                          value={orderQuantityNative}
                          onChange={(e) => setOrderQuantityNative(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100"
                        />
                      </div>
                    )}

                    {orderAction === 'ONCHAIN_TRANSFER' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-300">
                          Recipient On-Chain Address ({orderSymbol === 'BTC' ? 'bc1q... / 1...' : orderSymbol === 'ETH' ? '0x...' : 'Base58'})
                        </label>
                        <input
                          type="text"
                          required
                          value={transferToAddress}
                          onChange={(e) => setTransferToAddress(e.target.value)}
                          placeholder={
                            orderSymbol === 'BTC'
                              ? 'bc1q...'
                              : orderSymbol === 'ETH'
                              ? '0x...'
                              : 'Solana Base58 address...'
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={executingOrder}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {executingOrder
                          ? 'Cryptographically Signing & Executing...'
                          : `Sign & Execute ${orderAction} (${orderSymbol})`}
                      </span>
                    </button>
                  </form>
                </div>

                {/* Direct DEX & On-Ramp Liquidity Bridges */}
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-4">
                  <h3 className="text-base font-black text-zinc-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span>Direct On-Chain DEX & Fiat On-Ramp Bridges</span>
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Fund your Sovereign Self-Custody addresses directly from major exchanges or swap tokens on decentralized liquidity protocols using your wallet addresses above.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        name: 'Uniswap V3 (Ethereum EVM)',
                        desc: 'Swap ETH & ERC-20 tokens directly on Mainnet',
                        url: 'https://app.uniswap.org/swap'
                      },
                      {
                        name: 'Jupiter Aggregator (Solana)',
                        desc: 'Best-price Solana DEX routing & limit orders',
                        url: 'https://jup.ag/'
                      },
                      {
                        name: '1inch DeFi Aggregator',
                        desc: 'Multi-chain EVM liquidity router',
                        url: 'https://app.1inch.io/'
                      },
                      {
                        name: 'Mempool.space Bitcoin Explorer',
                        desc: 'Track real-time BTC SegWit UTXOs & fees',
                        url: `https://mempool.space/address/${activeWallet.addresses.bitcoinSegwit}`
                      }
                    ].map((bridge) => (
                      <a
                        key={bridge.name}
                        href={bridge.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 flex flex-col justify-between gap-2 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-amber-300">{bridge.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                        <p className="text-[11px] text-zinc-400">{bridge.desc}</p>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB: AGENTIC 5M AUTONOMOUS EXECUTION POLICY                   */}
            {/* ============================================================= */}
            {activeTab === 'agentic-policy' && (
              <div className="rounded-2xl bg-zinc-900/80 border border-amber-500/30 p-6 space-y-5 max-w-4xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <Bot className="w-5 h-5 text-amber-400" />
                      <span>UID 0 Autonomous Agentic Crypto Treasury Policy</span>
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Driven by the Multi-Kernel Laplace-14 Close (`h = 2s`) 99% Conformal 5-Minute Early-Warning Engine.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunAgenticCycle}
                    disabled={runningAgenticCycle}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Trigger Autonomous 5m Execution Cycle Now</span>
                  </button>
                </div>

                {wallets
                  .filter((w) => w.role === 'AGENTIC_AUTONOMOUS')
                  .map((aw) => (
                    <div key={aw.id} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                          <div className="text-[10px] text-zinc-500 uppercase">
                            Max Single Autonomous Trade
                          </div>
                          <div className="text-lg font-black text-amber-300 mt-1">
                            ${aw.agenticPolicy?.maxSingleTradeUsd.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                          <div className="text-[10px] text-zinc-500 uppercase">
                            Required Conformal Certainty
                          </div>
                          <div className="text-lg font-black text-emerald-400 mt-1">
                            &ge; {aw.agenticPolicy?.minConformalCertaintyPct.toFixed(1)}% (α = 0.01)
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                          <div className="text-[10px] text-zinc-500 uppercase">
                            Cumulative Realized Agentic Profit
                          </div>
                          <div className="text-lg font-black text-emerald-300 mt-1">
                            +${(aw.agenticPolicy?.cumulativeAutonomousProfitUsd || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB: SELF-CUSTODY PRIVATE KEYS & BIP-39 SEED BACKUP           */}
            {/* ============================================================= */}
            {activeTab === 'keystore' && (
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-5 max-w-4xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100 flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      <span>Self-Custody Cryptographic Keys & AES-256-GCM Keystore Backup</span>
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Real derived `secp256k1` (Ethereum & Bitcoin WIF) and `ed25519` (Solana Base58) keys for{' '}
                      <strong className="text-zinc-200">{activeWallet.label}</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealSecrets((r) => !r)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {revealSecrets ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>{revealSecrets ? 'Hide Private Keys' : 'Reveal Private Keys'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadKeystoreJson}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Keystore JSON</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    {
                      label: '12-Word BIP-39 Recovery Seed Phrase',
                      val: activeWallet.secrets.mnemonic12,
                      id: 'seed'
                    },
                    {
                      label: 'Ethereum / EVM Private Key (secp256k1 32-Byte Hex — Importable to MetaMask/Rabby)',
                      val: activeWallet.secrets.ethereumPrivateKeyHex,
                      id: 'eth-priv'
                    },
                    {
                      label: 'Bitcoin Compressed WIF Private Key (Base58Check — Importable to Electrum/Sparrow)',
                      val: activeWallet.secrets.bitcoinWifPrivateKey,
                      id: 'btc-wif'
                    },
                    {
                      label: 'Solana 64-Byte Ed25519 Secret Key (Base58 — Importable to Phantom/Solflare)',
                      val: activeWallet.secrets.solanaSecretKeyBase58,
                      id: 'sol-priv'
                    }
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="font-bold text-[11px]">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => copyText(item.val, item.id)}
                          className="text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === item.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-xs text-emerald-300 break-all">
                        {revealSecrets ? item.val : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB: CREATE OR IMPORT NEW MULTI-CHAIN VAULT                   */}
            {/* ============================================================= */}
            {activeTab === 'new-wallet' && (
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-4 max-w-2xl">
                <h2 className="text-base font-black text-zinc-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  <span>Create New Multi-Chain Vault or Import Existing Private Key</span>
                </h2>
                <form onSubmit={handleCreateCustomWallet} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-300">Vault Label</label>
                    <input
                      type="text"
                      required
                      value={newWalletLabel}
                      onChange={(e) => setNewWalletLabel(e.target.value)}
                      placeholder="e.g. Long-Term Cold Storage Vault or High-Frequency Agentic Sub-Vault"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-300">Vault Role</label>
                      <select
                        value={newWalletRole}
                        onChange={(e) => setNewWalletRole(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100"
                      >
                        <option value="PERSONAL_INVESTOR">Personal Investor Self-Custody</option>
                        <option value="AGENTIC_AUTONOMOUS">UID 0 Autonomous Agentic Treasury</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-300">Initial USD Cash Allocation ($)</label>
                      <input
                        type="number"
                        value={newWalletCash}
                        onChange={(e) => setNewWalletCash(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-300">
                      Import Existing 32-Byte Hex Private Key (Optional — leave blank to generate fresh CSPRNG keys)
                    </label>
                    <input
                      type="text"
                      value={importPrivKeyHex}
                      onChange={(e) => setImportPrivKeyHex(e.target.value)}
                      placeholder="0x... (optional 64-hex-character secp256k1 private key)"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs cursor-pointer"
                  >
                    Generate & Encrypt Multi-Chain Vault (AES-256-GCM)
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
