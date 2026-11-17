import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SecretSpec {
  id: string;
  name: string;
  envVar: string;
  category: 'LLM & AI' | 'Database & Storage' | 'Cloud & Search' | 'Telecom & eSIM' | 'Custom';
  proxyEndpoint: string;
  description: string;
  isPublicEndpoint?: boolean;
  quotaPolicy?: string;
}

export interface SecretTelemetry {
  id: string;
  name: string;
  envVar: string;
  category: string;
  status: 'INJECTED' | 'NOT_CONFIGURED';
  configured: boolean;
  source: 'vault' | 'env' | 'unset';
  maskedValue: string;
  fingerprint: string | null;
  length: number;
  proxyEndpoint: string;
  description: string;
  quotaPolicy?: string;
  updatedAt?: string;
}

interface VaultEntry {
  iv: string;
  tag: string;
  ciphertext: string;
  updatedAt: string;
  label?: string;
  category?: SecretSpec['category'];
  description?: string;
}

interface EncryptedVaultFile {
  version: number;
  algorithm: 'aes-256-gcm';
  updatedAt: string;
  entries: Record<string, VaultEntry>;
}

const WORKSPACE_ROOT = process.cwd();
const DATA_DIR = path.join(WORKSPACE_ROOT, 'data');
const VAULT_KEY_PATH = path.join(DATA_DIR, '.vault.key');
const VAULT_ENC_PATH = path.join(DATA_DIR, '.secrets.vault.enc');

export const CANONICAL_SECRET_SPECS: SecretSpec[] = [
  {
    id: 'gemini',
    name: 'Google Gemini Developer API',
    envVar: 'GEMINI_API_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/gemini/chat',
    quotaPolicy: 'SERVER_SIDE_PROXY',
    description: 'Server-side Gemini API key for chat, tool calling, grounding, and multimodal synthesis'
  },
  {
    id: 'gemini_pool',
    name: 'Gemini Key Rotation Pool (Comma/Newline)',
    envVar: 'GEMINI_API_KEYS',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    quotaPolicy: 'PROXY_LOOP_WHEEL',
    description: 'Comma or newline separated pool of Gemini Developer API keys for automatic wheel rotation'
  },
  {
    id: 'openai',
    name: 'OpenAI Native API',
    envVar: 'OPENAI_API_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/v1/chat/completions',
    description: 'OpenAI API key routed into the Proxy Loop Wheel'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Native API',
    envVar: 'DEEPSEEK_API_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/deepseek/chat',
    description: 'Native DeepSeek R1 and V3 reasoning API key'
  },
  {
    id: 'deepseek_pool',
    name: 'DeepSeek Key Pool',
    envVar: 'DEEPSEEK_API_KEYS',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    description: 'Comma or newline separated DeepSeek API key rotation pool'
  },
  {
    id: 'groq',
    name: 'Groq LPU Acceleration',
    envVar: 'GROQ_API_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/groq/chat',
    description: 'Groq LPU inference API key for Llama and Qwen models'
  },
  {
    id: 'groq_pool',
    name: 'Groq Key Pool',
    envVar: 'GROQ_API_KEYS',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    description: 'Comma or newline separated Groq API key rotation pool'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter MoE Matrix',
    envVar: 'OPENROUTER_API_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/openrouter/chat',
    description: 'Universal OpenRouter API key for open and frontier models'
  },
  {
    id: 'openrouter_pool',
    name: 'OpenRouter Key Pool',
    envVar: 'OPENROUTER_API_KEYS',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    description: 'Comma or newline separated OpenRouter API key rotation pool'
  },
  {
    id: 'custom_proxy_url',
    name: 'Custom OpenAI-Compatible Proxy URL(s)',
    envVar: 'CUSTOM_PROXY_URL',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    isPublicEndpoint: true,
    description: 'One or more OpenAI-compatible upstream /v1 proxy base URLs (comma/newline separated)'
  },
  {
    id: 'custom_proxy_key',
    name: 'Custom Proxy Bearer Key',
    envVar: 'CUSTOM_PROXY_KEY',
    category: 'LLM & AI',
    proxyEndpoint: '/api/proxy-wheel/status',
    description: 'Bearer API key sent to configured CUSTOM_PROXY_URL spokes'
  },
  {
    id: 'ollama',
    name: 'Ollama Host Daemon',
    envVar: 'OLLAMA_HOST',
    category: 'LLM & AI',
    proxyEndpoint: '/api/ollama/chat',
    isPublicEndpoint: true,
    description: 'Local or remote Ollama daemon endpoint URL (e.g. http://127.0.0.1:11434)'
  },
  {
    id: 'firebase',
    name: 'Firebase Web / Admin API Key',
    envVar: 'FIREBASE_API_KEY',
    category: 'Database & Storage',
    proxyEndpoint: '/api/health',
    description: 'Firebase project API credential for auth & Firestore synchronization'
  },
  {
    id: 'github',
    name: 'GitHub Personal Access Token',
    envVar: 'GITHUB_TOKEN',
    category: 'Cloud & Search',
    proxyEndpoint: '/api/github/status',
    description: 'Authenticated GitHub API token for live repository & profile telemetry'
  },
  {
    id: 'twilio_sid',
    name: 'Twilio Account SID',
    envVar: 'TWILIO_ACCOUNT_SID',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Twilio Account SID for PSTN numbers and SMS/Voice webhooks'
  },
  {
    id: 'twilio_token',
    name: 'Twilio Auth Token',
    envVar: 'TWILIO_AUTH_TOKEN',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Twilio Auth Token paired with Account SID for authenticated carrier requests'
  },
  {
    id: 'twilio_supersim',
    name: 'Twilio Super SIM Fleet SID',
    envVar: 'TWILIO_SUPERSIM_FLEET_SID',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Twilio Super SIM Fleet SID for hardware eSIM provisioning'
  },
  {
    id: 'telnyx_key',
    name: 'Telnyx Programmable API Key',
    envVar: 'TELNYX_API_KEY',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Telnyx V2 API key for global PSTN DIDs, SMS, and programmable voice'
  },
  {
    id: 'telnyx_messaging',
    name: 'Telnyx Messaging Profile ID',
    envVar: 'TELNYX_MESSAGING_PROFILE_ID',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Telnyx Messaging Profile UUID for inbound/outbound SMS routing'
  },
  {
    id: 'telnyx_sim_group',
    name: 'Telnyx eSIM Group ID',
    envVar: 'TELNYX_SIM_GROUP_ID',
    category: 'Telecom & eSIM',
    proxyEndpoint: '/api/sim/carrier/status',
    description: 'Telnyx SIM Card Group ID for programmatic carrier eSIM orchestration'
  }
];

const PROVIDER_TO_ENV: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  google: 'GEMINI_API_KEY',
  gemini_pool: 'GEMINI_API_KEYS',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  deepseek_pool: 'DEEPSEEK_API_KEYS',
  groq: 'GROQ_API_KEY',
  groq_pool: 'GROQ_API_KEYS',
  openrouter: 'OPENROUTER_API_KEY',
  openrouter_pool: 'OPENROUTER_API_KEYS',
  custom_proxy_url: 'CUSTOM_PROXY_URL',
  custom_proxy_key: 'CUSTOM_PROXY_KEY',
  ollama: 'OLLAMA_HOST',
  firebase: 'FIREBASE_API_KEY',
  github: 'GITHUB_TOKEN',
  twilio: 'TWILIO_ACCOUNT_SID',
  twilio_sid: 'TWILIO_ACCOUNT_SID',
  twilio_token: 'TWILIO_AUTH_TOKEN',
  twilio_supersim: 'TWILIO_SUPERSIM_FLEET_SID',
  telnyx: 'TELNYX_API_KEY',
  telnyx_key: 'TELNYX_API_KEY',
  telnyx_messaging: 'TELNYX_MESSAGING_PROFILE_ID',
  telnyx_sim_group: 'TELNYX_SIM_GROUP_ID'
};

const SENSITIVE_RELATIVE_PATHS = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'data/.vault.key',
  'data/.secrets.vault.enc',
  '.vault.key',
  '.secrets.vault.enc'
]);

const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,95}$/;

class InternalSecretsHandler {
  private masterKey: Buffer | null = null;
  private vaultCache: EncryptedVaultFile | null = null;
  private plaintextSecrets = new Map<string, string>();
  private initialEnvKeys = new Set<string>();
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.loadOrCreateMasterKey();
    this.loadVaultFromDisk();

    // Capture env vars present before vault hydration
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string' && v.trim().length > 0 && (ENV_KEY_PATTERN.test(k) || k.includes('SECRET') || k.includes('KEY') || k.includes('TOKEN') || k.includes('SID'))) {
        this.initialEnvKeys.add(k);
        this.plaintextSecrets.set(k, v.trim());
      }
    }

    // Decrypt vault entries into memory & hydrate process.env (do not overwrite existing non-empty env vars unless vault has newer explicit override)
    if (this.vaultCache && this.masterKey) {
      for (const [envVar, entry] of Object.entries(this.vaultCache.entries)) {
        try {
          const decrypted = this.decryptEntry(entry);
          if (decrypted) {
            this.plaintextSecrets.set(envVar, decrypted);
            process.env[envVar] = decrypted;
          }
        } catch {
          // Skip corrupted entry cleanly without crashing startup
        }
      }
    }

    this.initialized = true;
  }

  private ensureInit(): void {
    if (!this.initialized) this.init();
  }

  private loadOrCreateMasterKey(): void {
    if (this.masterKey) return;
    if (fs.existsSync(VAULT_KEY_PATH)) {
      const hex = fs.readFileSync(VAULT_KEY_PATH, 'utf-8').trim();
      const buf = Buffer.from(hex, 'hex');
      if (buf.length === 32) {
        this.masterKey = buf;
        try { fs.chmodSync(VAULT_KEY_PATH, 0o600); } catch {}
        return;
      }
    }
    const freshKey = crypto.randomBytes(32);
    const tmpKey = `${VAULT_KEY_PATH}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpKey, freshKey.toString('hex'), { mode: 0o600 });
    fs.renameSync(tmpKey, VAULT_KEY_PATH);
    try { fs.chmodSync(VAULT_KEY_PATH, 0o600); } catch {}
    this.masterKey = freshKey;
  }

  private loadVaultFromDisk(): void {
    if (fs.existsSync(VAULT_ENC_PATH)) {
      try {
        const raw = fs.readFileSync(VAULT_ENC_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
          this.vaultCache = parsed as EncryptedVaultFile;
          return;
        }
      } catch {
        // Fall through to empty vault
      }
    }
    this.vaultCache = {
      version: 1,
      algorithm: 'aes-256-gcm',
      updatedAt: new Date().toISOString(),
      entries: {}
    };
  }

  private persistVaultAtomic(): void {
    if (!this.vaultCache) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.vaultCache.updatedAt = new Date().toISOString();
    const tmpPath = `${VAULT_ENC_PATH}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.vaultCache, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, VAULT_ENC_PATH);
    try { fs.chmodSync(VAULT_ENC_PATH, 0o600); } catch {}
  }

  private encryptValue(plaintext: string, meta?: { label?: string; category?: SecretSpec['category']; description?: string }): VaultEntry {
    this.loadOrCreateMasterKey();
    if (!this.masterKey) throw new Error('Vault master key unavailable');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      updatedAt: new Date().toISOString(),
      ...(meta?.label ? { label: meta.label } : {}),
      ...(meta?.category ? { category: meta.category } : {}),
      ...(meta?.description ? { description: meta.description } : {})
    };
  }

  private decryptEntry(entry: VaultEntry): string {
    if (!this.masterKey) return '';
    const iv = Buffer.from(entry.iv, 'hex');
    const tag = Buffer.from(entry.tag, 'hex');
    const ciphertext = Buffer.from(entry.ciphertext, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  public resolveEnvVarName(keyOrProvider: string): string {
    const trimmed = String(keyOrProvider || '').trim();
    const lower = trimmed.toLowerCase();
    if (PROVIDER_TO_ENV[lower]) return PROVIDER_TO_ENV[lower];
    const upper = trimmed.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    return upper;
  }

  public maskSecret(value?: string | null, opts?: { isPublicEndpoint?: boolean }): string {
    if (!value || !value.trim()) return 'Not Configured';
    const v = value.trim();

    if (opts?.isPublicEndpoint) {
      // Mask embedded credentials if URL has user:pass@, otherwise return host cleanly
      try {
        const parsed = new URL(v);
        if (parsed.username || parsed.password) {
          parsed.username = '***';
          parsed.password = '***';
          return parsed.toString();
        }
        return parsed.toString().replace(/\/$/, '');
      } catch {
        return v;
      }
    }

    if (v.length <= 4) return '••••';
    if (v.length <= 10) return `${v.slice(0, 2)}••••${v.slice(-2)}`;
    const prefixLen = Math.min(4, Math.floor(v.length / 4));
    const suffixLen = Math.min(4, Math.floor(v.length / 4));
    const hiddenCount = Math.max(6, Math.min(16, v.length - prefixLen - suffixLen));
    return `${v.slice(0, prefixLen)}${'•'.repeat(hiddenCount)}${v.slice(-suffixLen)}`;
  }

  public fingerprintSecret(value?: string | null): string | null {
    if (!value || !value.trim()) return null;
    return `sha256:${crypto.createHash('sha256').update(value.trim()).digest('hex').slice(0, 12)}`;
  }

  public getSecret(envVarOrProvider: string): string | undefined {
    this.ensureInit();
    const envVar = this.resolveEnvVarName(envVarOrProvider);
    const val = this.plaintextSecrets.get(envVar) ?? process.env[envVar];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  public getSecretPool(
    primaryEnvVar: string,
    poolEnvVar?: string,
    numberedPrefix?: string,
    opts?: { isPublicEndpoint?: boolean }
  ): Array<{ slot: string; masked: string; value: string; envSource: string }> {
    this.ensureInit();
    const seenValues = new Set<string>();
    const results: Array<{ slot: string; masked: string; value: string; envSource: string }> = [];

    const pushCandidate = (raw: string | undefined, envSource: string) => {
      if (!raw || typeof raw !== 'string') return;
      const parts = raw
        .split(/[\r\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const item of parts) {
        if (seenValues.has(item)) continue;
        seenValues.add(item);
        results.push({
          slot: `slot-${results.length}`,
          masked: this.maskSecret(item, opts),
          value: item,
          envSource
        });
      }
    };

    pushCandidate(this.getSecret(primaryEnvVar), primaryEnvVar);
    if (poolEnvVar) {
      pushCandidate(this.getSecret(poolEnvVar), poolEnvVar);
    }
    const prefix = numberedPrefix || `${primaryEnvVar}_`;
    for (let i = 1; i <= 12; i++) {
      const k = `${prefix}${i}`;
      pushCandidate(this.getSecret(k), k);
    }

    return results;
  }

  public setSecret(
    envVarOrProvider: string,
    rawValue: string,
    meta?: { label?: string; category?: SecretSpec['category']; description?: string }
  ): SecretTelemetry {
    this.ensureInit();
    const envVar = this.resolveEnvVarName(envVarOrProvider);
    if (!ENV_KEY_PATTERN.test(envVar)) {
      throw new Error(`Invalid environment variable name "${envVar}". Use uppercase letters, digits, and underscores (2-96 chars).`);
    }
    const cleanVal = String(rawValue ?? '').trim();
    if (!cleanVal) {
      throw new Error(`Secret value for ${envVar} cannot be empty. Use DELETE to remove a secret.`);
    }

    const entry = this.encryptValue(cleanVal, meta);
    if (!this.vaultCache) this.loadVaultFromDisk();
    this.vaultCache!.entries[envVar] = entry;
    this.persistVaultAtomic();

    this.plaintextSecrets.set(envVar, cleanVal);
    process.env[envVar] = cleanVal;

    return this.getTelemetryForEnvVar(envVar);
  }

  public deleteSecret(envVarOrProvider: string): { deleted: boolean; envVar: string } {
    this.ensureInit();
    const envVar = this.resolveEnvVarName(envVarOrProvider);
    let existed = false;
    if (this.vaultCache && this.vaultCache.entries[envVar]) {
      delete this.vaultCache.entries[envVar];
      this.persistVaultAtomic();
      existed = true;
    }
    if (this.plaintextSecrets.has(envVar)) {
      this.plaintextSecrets.delete(envVar);
      existed = true;
    }
    if (process.env[envVar] !== undefined) {
      delete process.env[envVar];
      existed = true;
    }
    return { deleted: existed, envVar };
  }

  public isSensitivePath(relOrAbsPath: string): boolean {
    const normalized = String(relOrAbsPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const base = path.posix.basename(normalized);
    if (SENSITIVE_RELATIVE_PATHS.has(normalized) || SENSITIVE_RELATIVE_PATHS.has(base)) {
      return true;
    }
    if (/^\.env(\..+)?$/i.test(base) && base !== '.env.example') {
      return true;
    }
    if (base.endsWith('.pem') || base.endsWith('.key') || base === '.vault.key' || base === '.secrets.vault.enc') {
      return true;
    }
    return false;
  }

  public redactText(input: string): string {
    this.ensureInit();
    if (!input || typeof input !== 'string') return input;
    let out = input;

    // 1. Scrub all live secret values >= 6 chars currently tracked (including pooled sub-keys)
    const entries: Array<[string, string]> = [];
    const pushSecretForRedaction = (envVar: string, rawVal: string | undefined) => {
      if (!rawVal) return;
      const spec = CANONICAL_SECRET_SPECS.find(s => s.envVar === envVar);
      if (spec?.isPublicEndpoint) return;
      if (rawVal.length >= 6) entries.push([envVar, rawVal]);
      if (envVar.endsWith('_KEYS') || rawVal.includes(',') || rawVal.includes('\n')) {
        for (const sub of rawVal.split(/[\r\n,;]+/).map(s => s.trim()).filter(s => s.length >= 6)) {
          entries.push([envVar, sub]);
        }
      }
    };
    for (const [envVar, val] of this.plaintextSecrets.entries()) {
      pushSecretForRedaction(envVar, val);
    }
    for (const spec of CANONICAL_SECRET_SPECS) {
      pushSecretForRedaction(spec.envVar, process.env[spec.envVar]);
    }

    // Replace longest secrets first to prevent partial remnants
    entries.sort((a, b) => b[1].length - a[1].length);
    for (const [envVar, secretVal] of entries) {
      if (out.includes(secretVal)) {
        out = out.split(secretVal).join(`[REDACTED:${envVar}]`);
      }
    }

    // 2. Scrub recognizable token shapes even if external to vault
    out = out
      .replace(/AIza[0-9A-Za-z\-_]{25,}/g, '[REDACTED:GOOGLE_API_KEY]')
      .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED:GITHUB_TOKEN]')
      .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED:GITHUB_TOKEN]')
      .replace(/\bsk-(?:or-v1-|proj-)?[A-Za-z0-9\-_]{20,}\b/g, '[REDACTED:API_KEY]')
      .replace(/\bgsk_[A-Za-z0-9]{20,}\b/g, '[REDACTED:GROQ_API_KEY]')
      .replace(/\bKEY[A-Za-z0-9_]{24,}\b/g, '[REDACTED:TELNYX_KEY]');

    return out;
  }

  public redactObject<T>(value: T): T {
    if (typeof value === 'string') {
      return this.redactText(value) as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.redactObject(item)) as unknown as T;
    }
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value as Record<string, any>)) {
        result[k] = this.redactObject(v);
      }
      return result as T;
    }
    return value;
  }

  public getTelemetryForEnvVar(envVar: string): SecretTelemetry {
    this.ensureInit();
    const spec = CANONICAL_SECRET_SPECS.find(s => s.envVar === envVar);
    const vaultEntry = this.vaultCache?.entries[envVar];
    const currentValue = this.getSecret(envVar);
    const configured = !!currentValue;
    const source: SecretTelemetry['source'] = !configured
      ? 'unset'
      : vaultEntry
        ? 'vault'
        : 'env';

    return {
      id: spec?.id || `custom_${envVar.toLowerCase()}`,
      name: spec?.name || vaultEntry?.label || envVar,
      envVar,
      category: spec?.category || vaultEntry?.category || 'Custom',
      status: configured ? 'INJECTED' : 'NOT_CONFIGURED',
      configured,
      source,
      maskedValue: configured ? this.maskSecret(currentValue, { isPublicEndpoint: spec?.isPublicEndpoint }) : 'Not Configured',
      fingerprint: configured ? this.fingerprintSecret(currentValue) : null,
      length: configured ? currentValue!.length : 0,
      proxyEndpoint: spec?.proxyEndpoint || '/api/secrets',
      description: spec?.description || vaultEntry?.description || `Encrypted custom environment secret (${envVar})`,
      ...(spec?.quotaPolicy ? { quotaPolicy: spec.quotaPolicy } : {}),
      ...(vaultEntry?.updatedAt ? { updatedAt: vaultEntry.updatedAt } : {})
    };
  }

  public listSecretTelemetry(): SecretTelemetry[] {
    this.ensureInit();
    const seen = new Set<string>();
    const list: SecretTelemetry[] = [];

    for (const spec of CANONICAL_SECRET_SPECS) {
      seen.add(spec.envVar);
      list.push(this.getTelemetryForEnvVar(spec.envVar));
    }

    if (this.vaultCache) {
      for (const envVar of Object.keys(this.vaultCache.entries)) {
        if (!seen.has(envVar)) {
          seen.add(envVar);
          list.push(this.getTelemetryForEnvVar(envVar));
        }
      }
    }

    return list;
  }

  public getVaultHealth() {
    this.ensureInit();
    const all = this.listSecretTelemetry();
    return {
      algorithm: 'AES-256-GCM',
      vaultFileExists: fs.existsSync(VAULT_ENC_PATH),
      masterKeyProtected: fs.existsSync(VAULT_KEY_PATH),
      totalTracked: all.length,
      configuredCount: all.filter(s => s.configured).length,
      vaultStoredCount: all.filter(s => s.source === 'vault').length,
      envInjectedCount: all.filter(s => s.source === 'env').length
    };
  }
}

export const internalSecretsHandler = new InternalSecretsHandler();
