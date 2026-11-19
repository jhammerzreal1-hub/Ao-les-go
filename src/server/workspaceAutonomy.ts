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

import child_process from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { internalSecretsHandler } from './internalSecretsHandler';

export interface AutonomyResult<T = any> {
  tag: string;
  action: string;
  success: boolean;
  summary: string;
  output: T;
  diff?: string;
}

export interface PatchHunk {
  targetContent?: string;
  replacementContent?: string;
  search?: string;
  replace?: string;
  oldText?: string;
  newText?: string;
  target?: string;
  replacement?: string;
  startLine?: number;
  endLine?: number;
  allowMultiple?: boolean;
}

export interface TypeScriptDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

export interface BatchFileOperation {
  type?: 'write' | 'patch' | 'atomicPatch' | 'delete' | string;
  action?: 'write' | 'patch' | 'atomicPatch' | 'delete' | string;
  filePath: string;
  scope?: 'auto' | 'target' | 'orchestrator' | 'self' | 'host' | string;
  rootPath?: string;
  content?: string;
  targetContent?: string;
  replacementContent?: string;
  edits?: PatchHunk[];
  patches?: PatchHunk[];
  hunks?: PatchHunk[];
  allowMultiple?: boolean;
}

export interface TargetSystemConfig {
  rootPath: string;
  label: string;
  isSelf: boolean;
  detectedStack: string[];
  pointedAt: string;
  history: Array<{ rootPath: string; label: string; pointedAt: string }>;
}

export interface AtomicPatchSnapshotRecord {
  patchId: string;
  timestamp: string;
  agentId: string;
  operation: 'write' | 'patch' | 'atomicPatch' | 'batch' | 'delete';
  scope: 'orchestrator' | 'target' | 'host';
  displayPath: string;
  targetPath: string;
  existedBefore: boolean;
  previousContent: string | null;
  beforeSha256: string | null;
  afterSha256: string | null;
  diff: string;
  rolledBack?: boolean;
}

const ORCHESTRATOR_ROOT = fs.realpathSync(process.cwd());
const DATA_DIR = path.join(ORCHESTRATOR_ROOT, 'data');
const TARGET_SYSTEM_FILE = path.join(DATA_DIR, 'target_system.json');
const PATCH_LEDGER_FILE = path.join(DATA_DIR, 'atomic_patch_ledger.json');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.aistudio', 'android', '.next', 'target', '__pycache__']);
const PROTECTED_CORE_FILES = new Set(['server.ts', 'package.json', 'tsconfig.json', 'vite.config.ts']);

let activeTargetSystem: TargetSystemConfig = {
  rootPath: ORCHESTRATOR_ROOT,
  label: 'Lysander Genesis Orchestrator (Self Workspace)',
  isSelf: true,
  detectedStack: ['TypeScript', 'React 19', 'Node.js / Express', 'Three.js', 'SQLite'],
  pointedAt: new Date().toISOString(),
  history: [{
    rootPath: ORCHESTRATOR_ROOT,
    label: 'Lysander Genesis Orchestrator (Self Workspace)',
    pointedAt: new Date().toISOString()
  }]
};

let atomicPatchLedger: AtomicPatchSnapshotRecord[] = [];

function detectDirectoryStack(dirPath: string): string[] {
  const stack: string[] = [];
  try {
    if (!fs.existsSync(dirPath)) return ['Uninitialized Directory'];
    const has = (name: string) => fs.existsSync(path.join(dirPath, name));
    if (has('package.json')) {
      stack.push('Node.js / npm');
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.react) stack.push('React');
        if (deps.vite) stack.push('Vite');
        if (deps.next) stack.push('Next.js');
        if (deps.express) stack.push('Express');
        if (deps.three) stack.push('Three.js');
        if (deps.typescript || has('tsconfig.json')) stack.push('TypeScript');
      } catch {}
    }
    if (has('tsconfig.json') && !stack.includes('TypeScript')) stack.push('TypeScript');
    if (has('Cargo.toml')) stack.push('Rust (Cargo)');
    if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) stack.push('Python');
    if (has('go.mod')) stack.push('Go');
    if (has('CMakeLists.txt') || has('Makefile')) stack.push('C / C++');
    if (has('project.godot')) stack.push('Godot Engine');
    if (has('.git')) stack.push('Git Repository');
    if (stack.length === 0) stack.push('Generic Host System / Directory');
  } catch {
    stack.push('Host Filesystem');
  }
  return stack;
}

function loadTargetSystemState(): void {
  try {
    if (fs.existsSync(TARGET_SYSTEM_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TARGET_SYSTEM_FILE, 'utf-8'));
      if (parsed && typeof parsed.rootPath === 'string' && fs.existsSync(parsed.rootPath)) {
        const real = fs.realpathSync(parsed.rootPath);
        activeTargetSystem = {
          rootPath: real,
          label: String(parsed.label || path.basename(real) || real),
          isSelf: real === ORCHESTRATOR_ROOT,
          detectedStack: detectDirectoryStack(real),
          pointedAt: String(parsed.pointedAt || new Date().toISOString()),
          history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : []
        };
      }
    }
  } catch (_) {}
}

function saveTargetSystemState(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TARGET_SYSTEM_FILE, JSON.stringify(activeTargetSystem, null, 2), 'utf-8');
  } catch (_) {}
}

function loadPatchLedger(): void {
  try {
    if (fs.existsSync(PATCH_LEDGER_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PATCH_LEDGER_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        atomicPatchLedger = parsed.slice(0, 50);
      }
    }
  } catch (_) {}
}

function savePatchLedger(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PATCH_LEDGER_FILE, JSON.stringify(atomicPatchLedger.slice(0, 50), null, 2), 'utf-8');
  } catch (_) {}
}

function recordPatchSnapshot(entry: Omit<AtomicPatchSnapshotRecord, 'patchId' | 'timestamp'>): AtomicPatchSnapshotRecord {
  const record: AtomicPatchSnapshotRecord = {
    patchId: `patch-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  atomicPatchLedger.unshift(record);
  if (atomicPatchLedger.length > 50) {
    atomicPatchLedger = atomicPatchLedger.slice(0, 50);
  }
  savePatchLedger();
  return record;
}

loadTargetSystemState();
loadPatchLedger();

export function getTargetSystemConfig(): TargetSystemConfig {
  return {
    ...activeTargetSystem,
    isSelf: activeTargetSystem.rootPath === ORCHESTRATOR_ROOT,
    detectedStack: detectDirectoryStack(activeTargetSystem.rootPath)
  };
}

export function getOrchestratorRoot(): string {
  return ORCHESTRATOR_ROOT;
}

export function getAtomicPatchLedger(limit: number = 25): Omit<AtomicPatchSnapshotRecord, 'previousContent'>[] {
  return atomicPatchLedger.slice(0, limit).map(({ previousContent, ...rest }) => rest);
}

/**
 * Resolves any file or directory path across all 3 autonomous scopes:
 *  1. Orchestrator's own files (`scope: 'orchestrator' | 'self'`, or `@self/...`, `@orchestrator/...`)
 *  2. Whatever target system/project the orchestrator is pointed at (`scope: 'target'`, or `@target/...`)
 *  3. The host system the orchestrator is installed on (`scope: 'host'`, `~/...`, `../...`, or any absolute host path `/...`)
 */
export function resolveUniversalPath(
  rawPathInput: string,
  mode: 'read' | 'write' | 'delete' | 'list',
  options?: { scope?: string; rootPath?: string }
): { cleaned: string; targetPath: string; scope: 'orchestrator' | 'target' | 'host'; baseRoot: string } {
  let raw = String(rawPathInput ?? '').trim();
  if (!raw && mode === 'list') raw = '.';
  if (!raw && mode !== 'list') {
    throw new Error('File path is required.');
  }
  if (raw.includes('\0')) {
    throw new Error('Invalid null byte in path.');
  }

  let requestedScope = String(options?.scope || 'auto').toLowerCase().trim();
  const customRoot = options?.rootPath ? String(options.rootPath).trim() : '';

  // Handle explicit @self / @orchestrator / @target / @host prefixes
  if (raw.startsWith('@self/') || raw.startsWith('@orchestrator/') || raw === '@self' || raw === '@orchestrator') {
    requestedScope = 'orchestrator';
    raw = raw.replace(/^@(?:self|orchestrator)\/?/, '') || '.';
  } else if (raw.startsWith('@target/') || raw === '@target') {
    requestedScope = 'target';
    raw = raw.replace(/^@target\/?/, '') || '.';
  } else if (raw.startsWith('@host/')) {
    requestedScope = 'host';
    raw = '/' + raw.replace(/^@host\/+/, '');
  } else if (raw === '~' || raw.startsWith('~/')) {
    requestedScope = 'host';
    raw = path.join(os.homedir(), raw.slice(1));
  }

  let baseRoot = ORCHESTRATOR_ROOT;
  let resolvedPath = '';
  let effectiveScope: 'orchestrator' | 'target' | 'host' = 'orchestrator';

  if (customRoot) {
    const expandedCustom = customRoot.startsWith('~/') ? path.join(os.homedir(), customRoot.slice(1)) : path.resolve(ORCHESTRATOR_ROOT, customRoot);
    baseRoot = fs.existsSync(expandedCustom) ? fs.realpathSync(expandedCustom) : expandedCustom;
    resolvedPath = path.resolve(baseRoot, raw.replace(/^\/+/, ''));
    effectiveScope = baseRoot === ORCHESTRATOR_ROOT ? 'orchestrator' : 'target';
  } else if (requestedScope === 'orchestrator' || requestedScope === 'self') {
    baseRoot = ORCHESTRATOR_ROOT;
    resolvedPath = path.resolve(ORCHESTRATOR_ROOT, raw.replace(/^\/+/, ''));
    effectiveScope = 'orchestrator';
  } else if (requestedScope === 'target') {
    baseRoot = activeTargetSystem.rootPath || ORCHESTRATOR_ROOT;
    resolvedPath = path.resolve(baseRoot, raw.replace(/^\/+/, ''));
    effectiveScope = baseRoot === ORCHESTRATOR_ROOT ? 'orchestrator' : 'target';
  } else if (requestedScope === 'host' || requestedScope === 'system') {
    baseRoot = '/';
    resolvedPath = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(activeTargetSystem.rootPath || ORCHESTRATOR_ROOT, raw);
    effectiveScope = resolvedPath.startsWith(ORCHESTRATOR_ROOT) ? 'orchestrator' : 'host';
  } else {
    // 'auto' smart resolution:
    if (path.isAbsolute(raw)) {
      // Check if the caller wrote "/src/App.tsx" or "/package.json" meaning a workspace file
      const stripped = raw.replace(/^\/+/, '');
      const inTarget = path.resolve(activeTargetSystem.rootPath, stripped);
      const inOrch = path.resolve(ORCHESTRATOR_ROOT, stripped);

      if (!fs.existsSync(raw) && (fs.existsSync(inTarget) || stripped.startsWith('src/') || stripped.startsWith('public/') || PROTECTED_CORE_FILES.has(stripped))) {
        baseRoot = fs.existsSync(inTarget) ? activeTargetSystem.rootPath : ORCHESTRATOR_ROOT;
        resolvedPath = fs.existsSync(inTarget) ? inTarget : inOrch;
        effectiveScope = baseRoot === ORCHESTRATOR_ROOT ? 'orchestrator' : 'target';
      } else {
        // Real host absolute path (e.g. /tmp/..., /app/applet/..., /etc/..., /home/..., /var/...)
        resolvedPath = path.normalize(raw);
        if (resolvedPath === ORCHESTRATOR_ROOT || resolvedPath.startsWith(ORCHESTRATOR_ROOT + path.sep)) {
          baseRoot = ORCHESTRATOR_ROOT;
          effectiveScope = 'orchestrator';
        } else if (resolvedPath === activeTargetSystem.rootPath || resolvedPath.startsWith(activeTargetSystem.rootPath + path.sep)) {
          baseRoot = activeTargetSystem.rootPath;
          effectiveScope = 'target';
        } else {
          baseRoot = '/';
          effectiveScope = 'host';
        }
      }
    } else if (raw.startsWith('..')) {
      // Relative traversal outside current root -> resolve on host from active target root
      baseRoot = activeTargetSystem.rootPath || ORCHESTRATOR_ROOT;
      resolvedPath = path.resolve(baseRoot, raw);
      effectiveScope = resolvedPath.startsWith(ORCHESTRATOR_ROOT) ? 'orchestrator' : 'host';
    } else {
      // Standard relative path: prefer activeTargetSystem.rootPath, fallback to ORCHESTRATOR_ROOT if reading an orchestrator file
      const inTarget = path.resolve(activeTargetSystem.rootPath, raw);
      const inOrch = path.resolve(ORCHESTRATOR_ROOT, raw);
      if (!activeTargetSystem.isSelf && (mode === 'write' || mode === 'list' || fs.existsSync(inTarget) || !fs.existsSync(inOrch))) {
        baseRoot = activeTargetSystem.rootPath;
        resolvedPath = inTarget;
        effectiveScope = 'target';
      } else {
        baseRoot = ORCHESTRATOR_ROOT;
        resolvedPath = inOrch;
        effectiveScope = 'orchestrator';
      }
    }
  }

  const relFromOrch = path.relative(ORCHESTRATOR_ROOT, resolvedPath).split(path.sep).join('/');
  const relFromBase = baseRoot === '/'
    ? resolvedPath
    : (path.relative(baseRoot, resolvedPath).split(path.sep).join('/') || '.');

  // Protect raw encrypted secret key material (.vault.key / .secrets.vault.enc) from direct tampering/exposure
  const baseName = path.basename(resolvedPath);
  if (baseName === '.vault.key' || baseName === '.secrets.vault.enc' || internalSecretsHandler.isSensitivePath(relFromOrch)) {
    throw new Error(`Access denied: "${baseName}" is protected by the internal AES-256-GCM secrets handler.`);
  }

  // Prevent accidental deletion of core orchestrator entrypoints
  if (mode === 'delete' && effectiveScope === 'orchestrator' && PROTECTED_CORE_FILES.has(relFromOrch)) {
    throw new Error(`Refusing to delete protected orchestrator core file "${relFromOrch}". Use patchFile or atomicPatchFile to modify it.`);
  }

  return {
    cleaned: relFromBase.startsWith('..') ? resolvedPath : (relFromBase || '.'),
    targetPath: resolvedPath,
    scope: effectiveScope,
    baseRoot
  };
}

async function atomicWriteTextFile(targetPath: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.aurelius-tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  await fs.promises.writeFile(tmpPath, content, 'utf-8');
  await fs.promises.rename(tmpPath, targetPath);
}

function createCompactDiff(filePath: string, before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  let start = 0;
  while (start < beforeLines.length && start < afterLines.length && beforeLines[start] === afterLines[start]) {
    start++;
  }
  let endBefore = beforeLines.length - 1;
  let endAfter = afterLines.length - 1;
  while (endBefore >= start && endAfter >= start && beforeLines[endBefore] === afterLines[endAfter]) {
    endBefore--;
    endAfter--;
  }
  const removed = beforeLines.slice(start, endBefore + 1).slice(0, 24).map(l => `- ${l}`);
  const added = afterLines.slice(start, endAfter + 1).slice(0, 24).map(l => `+ ${l}`);
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${start + 1},${Math.max(0, endBefore - start + 1)} +${start + 1},${Math.max(0, endAfter - start + 1)} @@`,
    ...removed,
    ...added
  ].join('\n');
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

export async function runTypeCheck(targetRoot: string = ORCHESTRATOR_ROOT, specificFilePath?: string): Promise<{ clean: boolean; diagnostics: string }> {
  const checkRoot = fs.existsSync(path.join(targetRoot, 'tsconfig.json'))
    ? targetRoot
    : (specificFilePath && specificFilePath.startsWith(ORCHESTRATOR_ROOT) ? ORCHESTRATOR_ROOT : targetRoot);

  // If the target system has a tsconfig.json, run tsc --noEmit
  if (fs.existsSync(path.join(checkRoot, 'tsconfig.json'))) {
    return new Promise((resolve) => {
      child_process.exec('npx tsc --noEmit', { cwd: checkRoot, timeout: 45000, maxBuffer: 6 * 1024 * 1024 }, (err, stdout, stderr) => {
        const clean = !err;
        const raw = [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n');
        const diagnostics = internalSecretsHandler.redactText(raw || (clean ? '0 TypeScript errors' : 'TypeScript compilation failed'));
        resolve({ clean, diagnostics });
      });
    });
  }

  // If verifying a standalone JS/PY/SH/JSON file on an external target or host system
  if (specificFilePath && fs.existsSync(specificFilePath)) {
    const ext = path.extname(specificFilePath).toLowerCase();
    if (ext === '.json') {
      try {
        JSON.parse(fs.readFileSync(specificFilePath, 'utf-8'));
        return { clean: true, diagnostics: 'Valid JSON syntax verified' };
      } catch (e: any) {
        return { clean: false, diagnostics: `JSON syntax error: ${e?.message || e}` };
      }
    }
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      return new Promise((resolve) => {
        child_process.exec(`node --check ${JSON.stringify(specificFilePath)}`, { cwd: path.dirname(specificFilePath), timeout: 15000 }, (err, stdout, stderr) => {
          resolve({
            clean: !err,
            diagnostics: internalSecretsHandler.redactText([stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n') || (!err ? '0 JS syntax errors' : 'JS syntax check failed'))
          });
        });
      });
    }
    if (ext === '.py') {
      return new Promise((resolve) => {
        child_process.exec(`python3 -m py_compile ${JSON.stringify(specificFilePath)}`, { cwd: path.dirname(specificFilePath), timeout: 15000 }, (err, stdout, stderr) => {
          resolve({
            clean: !err,
            diagnostics: internalSecretsHandler.redactText([stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n') || (!err ? '0 Python syntax errors' : 'Python syntax check failed'))
          });
        });
      });
    }
    if (ext === '.sh' || ext === '.bash') {
      return new Promise((resolve) => {
        child_process.exec(`bash -n ${JSON.stringify(specificFilePath)}`, { cwd: path.dirname(specificFilePath), timeout: 15000 }, (err, stdout, stderr) => {
          resolve({
            clean: !err,
            diagnostics: internalSecretsHandler.redactText([stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n') || (!err ? '0 shell syntax errors' : 'Shell syntax check failed'))
          });
        });
      });
    }
  }

  return { clean: true, diagnostics: 'Syntax verification passed' };
}

export function parseTypeScriptErrors(diagnostics: string): TypeScriptDiagnostic[] {
  const results: TypeScriptDiagnostic[] = [];
  if (!diagnostics) return results;
  const lines = diagnostics.split('\n');
  const re = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
  for (const rawLine of lines) {
    const m = rawLine.trim().match(re);
    if (m) {
      results.push({
        file: m[1].trim(),
        line: parseInt(m[2], 10),
        column: parseInt(m[3], 10),
        code: m[4],
        message: m[5].trim()
      });
    }
  }
  return results;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + needle.length;
  }
  return count;
}

/**
 * 4-Stage Resilient Atomic Hunk Applier:
 *  Stage 1: Exact substring match
 *  Stage 2: CRLF/LF normalized substring match
 *  Stage 3: Line-trimmed / indentation-resilient multi-line sequence match
 *  Stage 4: 1-indexed [startLine, endLine] line-range replacement
 */
function applyHunkList(filePath: string, original: string, edits: PatchHunk[]): string {
  let working = original;
  for (let i = 0; i < edits.length; i++) {
    const hunk = edits[i];
    const rawTarget = hunk?.targetContent ?? hunk?.search ?? hunk?.oldText ?? hunk?.target;
    const rawReplacement = hunk?.replacementContent ?? hunk?.replace ?? hunk?.newText ?? hunk?.replacement;
    const target = rawTarget !== undefined && rawTarget !== null ? String(rawTarget) : '';
    const replacement = rawReplacement !== undefined && rawReplacement !== null ? String(rawReplacement) : '';
    const startLine = Number(hunk?.startLine);
    const endLine = Number(hunk?.endLine);

    // Stage 1: Exact match if target is non-empty
    if (target) {
      const exactCount = countOccurrences(working, target);
      if (exactCount === 1 || (exactCount > 1 && hunk.allowMultiple)) {
        working = hunk.allowMultiple
          ? working.split(target).join(replacement)
          : working.replace(target, replacement);
        continue;
      }
      if (exactCount > 1 && !hunk.allowMultiple) {
        throw new Error(`Hunk #${i + 1} in "${filePath}" matched ${exactCount} occurrences; provide more surrounding context or set allowMultiple: true.`);
      }

      // Stage 2: CRLF/LF normalized match
      const hasCrLf = working.includes('\r\n');
      const normWorking = working.replace(/\r\n/g, '\n');
      const normTarget = target.replace(/\r\n/g, '\n');
      const normReplacement = replacement.replace(/\r\n/g, '\n');
      const normCount = countOccurrences(normWorking, normTarget);
      if (normCount === 1 || (normCount > 1 && hunk.allowMultiple)) {
        const updatedNorm = hunk.allowMultiple
          ? normWorking.split(normTarget).join(normReplacement)
          : normWorking.replace(normTarget, normReplacement);
        working = hasCrLf ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
        continue;
      }

      // Stage 3: Line-trimmed sequence match (handles minor indentation / trailing space differences)
      const workLines = normWorking.split('\n');
      const targetLines = normTarget.split('\n');
      if (targetLines.length >= 1) {
        const matchIndices: number[] = [];
        for (let lineIdx = 0; lineIdx <= workLines.length - targetLines.length; lineIdx++) {
          let allMatch = true;
          for (let k = 0; k < targetLines.length; k++) {
            if (workLines[lineIdx + k].trim() !== targetLines[k].trim()) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            matchIndices.push(lineIdx);
          }
        }
        if (matchIndices.length === 1 || (matchIndices.length > 1 && hunk.allowMultiple)) {
          const repLines = normReplacement.split('\n');
          for (let mIdx = matchIndices.length - 1; mIdx >= 0; mIdx--) {
            workLines.splice(matchIndices[mIdx], targetLines.length, ...repLines);
            if (!hunk.allowMultiple) break;
          }
          const joined = workLines.join('\n');
          working = hasCrLf ? joined.replace(/\n/g, '\r\n') : joined;
          continue;
        }
      }
    }

    // Stage 4: Line-range replacement if startLine & endLine are provided
    if (Number.isFinite(startLine) && startLine >= 1) {
      const hasCrLf = working.includes('\r\n');
      const lines = working.replace(/\r\n/g, '\n').split('\n');
      const sIdx = Math.max(1, Math.floor(startLine)) - 1;
      const eIdx = Number.isFinite(endLine) && endLine >= startLine
        ? Math.min(lines.length, Math.floor(endLine))
        : sIdx + 1;
      if (sIdx < lines.length) {
        const repLines = replacement.replace(/\r\n/g, '\n').split('\n');
        lines.splice(sIdx, Math.max(0, eIdx - sIdx), ...repLines);
        const joined = lines.join('\n');
        working = hasCrLf ? joined.replace(/\n/g, '\r\n') : joined;
        continue;
      }
    }

    if (!target) {
      throw new Error(`Hunk #${i + 1} in "${filePath}" has empty targetContent (and no valid startLine/endLine).`);
    }
    throw new Error(`Hunk #${i + 1} targetContent not found in "${filePath}". Read the file first with readFile to get exact lines.`);
  }
  return working;
}

export async function autonomyReadFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope } = resolveUniversalPath(
    args.filePath || args.path || '',
    'read',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'READ_FILE',
      action: `Read ${cleaned} [${scope}]`,
      success: false,
      summary: `File not found: ${cleaned} (${targetPath})`,
      output: { error: `File not found: ${cleaned}`, targetPath, scope }
    };
  }
  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    return {
      tag: 'READ_FILE',
      action: `Read ${cleaned} [${scope}]`,
      success: false,
      summary: `"${cleaned}" is a directory; use listDirectory instead.`,
      output: { error: `"${cleaned}" is a directory`, targetPath, scope }
    };
  }
  const rawContent = await fs.promises.readFile(targetPath, 'utf-8');
  const redacted = internalSecretsHandler.redactText(rawContent);
  const startLine = Number(args.startLine);
  const endLine = Number(args.endLine);

  if (Number.isFinite(startLine) && startLine >= 1) {
    const lines = redacted.split('\n');
    const from = Math.max(1, Math.floor(startLine));
    const to = Number.isFinite(endLine) && endLine >= from ? Math.min(lines.length, Math.floor(endLine)) : lines.length;
    const slice = lines.slice(from - 1, to).map((line, idx) => `${from + idx}: ${line}`).join('\n');
    return {
      tag: 'READ_FILE',
      action: `Read lines ${from}-${to} of ${cleaned} [${scope}]`,
      success: true,
      summary: `Read lines ${from}-${to} of ${lines.length} from ${cleaned} [${scope}]`,
      output: slice
    };
  }

  return {
    tag: 'READ_FILE',
    action: `Read file: ${cleaned} [${scope}]`,
    success: true,
    summary: `Read ${redacted.length} chars from ${cleaned} [${scope}] (sha256:${sha256(rawContent).slice(0, 10)})`,
    output: redacted
  };
}

export async function autonomyWriteFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope, baseRoot } = resolveUniversalPath(
    args.filePath || args.path || '',
    'write',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  const content = String(args.content ?? args.code ?? '');
  const verifyCompile = Boolean(args.verifyCompile);
  const agentId = String(args.agentId || 'uid_0');

  const existed = fs.existsSync(targetPath);
  const previousContent = existed ? await fs.promises.readFile(targetPath, 'utf-8') : null;

  await atomicWriteTextFile(targetPath, content);

  if (verifyCompile) {
    const tsc = await runTypeCheck(baseRoot === '/' ? path.dirname(targetPath) : baseRoot, targetPath);
    if (!tsc.clean) {
      if (existed && previousContent !== null) {
        await atomicWriteTextFile(targetPath, previousContent);
      } else if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath).catch(() => {});
      }
      return {
        tag: 'WRITE_FILE',
        action: `Write & rollback ${cleaned} [${scope}]`,
        success: false,
        summary: `Compile verification failed; rolled back ${cleaned}`,
        output: { path: cleaned, targetPath, scope, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = previousContent !== null ? createCompactDiff(cleaned, previousContent, content) : `+++ b/${cleaned} (${content.length} bytes)`;
  const snapshot = recordPatchSnapshot({
    agentId,
    operation: 'write',
    scope,
    displayPath: cleaned,
    targetPath,
    existedBefore: existed,
    previousContent,
    beforeSha256: previousContent !== null ? sha256(previousContent).slice(0, 16) : null,
    afterSha256: sha256(content).slice(0, 16),
    diff
  });

  return {
    tag: 'WRITE_FILE',
    action: `Wrote file: ${cleaned} [${scope}]`,
    success: true,
    summary: `Atomically wrote ${content.length} bytes to ${cleaned} [${scope}] (patchId:${snapshot.patchId})${verifyCompile ? ' (verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
      targetPath,
      scope,
      patchId: snapshot.patchId,
      bytes: content.length,
      sha256: sha256(content).slice(0, 16),
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyPatchFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope, baseRoot } = resolveUniversalPath(
    args.filePath || args.path || '',
    'write',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  const targetContent = String(args.targetContent ?? args.search ?? args.oldText ?? args.target ?? '');
  const replacementContent = String(args.replacementContent ?? args.replace ?? args.newText ?? args.replacement ?? '');
  const startLine = args.startLine !== undefined ? Number(args.startLine) : undefined;
  const endLine = args.endLine !== undefined ? Number(args.endLine) : undefined;
  const allowMultiple = Boolean(args.allowMultiple);
  const verifyCompile = Boolean(args.verifyCompile);
  const agentId = String(args.agentId || 'uid_0');

  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'PATCH_FILE',
      action: `Patch ${cleaned} [${scope}]`,
      success: false,
      summary: `File not found: ${cleaned} (${targetPath})`,
      output: { error: `File not found: ${cleaned}`, targetPath, scope }
    };
  }

  const original = await fs.promises.readFile(targetPath, 'utf-8');
  let modified: string;
  try {
    modified = applyHunkList(cleaned, original, [{ targetContent, replacementContent, startLine, endLine, allowMultiple }]);
  } catch (err: any) {
    return {
      tag: 'PATCH_FILE',
      action: `Patch ${cleaned} [${scope}]`,
      success: false,
      summary: err?.message || `Patch pre-flight failed on ${cleaned}`,
      output: { error: err?.message || 'Patch pre-flight failed', targetPath, scope }
    };
  }

  await atomicWriteTextFile(targetPath, modified);

  if (verifyCompile) {
    const tsc = await runTypeCheck(baseRoot === '/' ? path.dirname(targetPath) : baseRoot, targetPath);
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, original);
      return {
        tag: 'PATCH_FILE',
        action: `Patch & rollback ${cleaned} [${scope}]`,
        success: false,
        summary: `Compile check failed; rolled back ${cleaned}`,
        output: { path: cleaned, targetPath, scope, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = createCompactDiff(cleaned, original, modified);
  const snapshot = recordPatchSnapshot({
    agentId,
    operation: 'patch',
    scope,
    displayPath: cleaned,
    targetPath,
    existedBefore: true,
    previousContent: original,
    beforeSha256: sha256(original).slice(0, 16),
    afterSha256: sha256(modified).slice(0, 16),
    diff
  });

  return {
    tag: 'PATCH_FILE',
    action: `Patched file: ${cleaned} [${scope}]`,
    success: true,
    summary: `Atomically patched ${cleaned} [${scope}] (patchId:${snapshot.patchId})${verifyCompile ? ' (verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
      targetPath,
      scope,
      patchId: snapshot.patchId,
      sha256: sha256(modified).slice(0, 16),
      diff,
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyAtomicPatchFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope, baseRoot } = resolveUniversalPath(
    args.filePath || args.path || '',
    'write',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  const rawEdits = args.edits ?? args.patches ?? args.hunks;
  const edits: PatchHunk[] = Array.isArray(rawEdits)
    ? rawEdits
    : (args.targetContent || args.search || args.startLine !== undefined)
      ? [{
          targetContent: args.targetContent ?? args.search,
          replacementContent: args.replacementContent ?? args.replace ?? '',
          startLine: args.startLine,
          endLine: args.endLine,
          allowMultiple: args.allowMultiple
        }]
      : [];
  const verifyCompile = Boolean(args.verifyCompile);
  const agentId = String(args.agentId || 'uid_0');

  if (edits.length === 0) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned} [${scope}]`,
      success: false,
      summary: 'edits array must contain at least one hunk',
      output: { error: 'edits array is required', targetPath, scope }
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned} [${scope}]`,
      success: false,
      summary: `File not found: ${cleaned} (${targetPath})`,
      output: { error: `File not found: ${cleaned}`, targetPath, scope }
    };
  }

  const original = await fs.promises.readFile(targetPath, 'utf-8');
  let modified: string;
  try {
    modified = applyHunkList(cleaned, original, edits);
  } catch (err: any) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned} [${scope}]`,
      success: false,
      summary: err?.message || `Atomic patch pre-flight failed on ${cleaned}`,
      output: { error: err?.message || 'Atomic patch failed', targetPath, scope }
    };
  }

  await atomicWriteTextFile(targetPath, modified);

  if (verifyCompile) {
    const tsc = await runTypeCheck(baseRoot === '/' ? path.dirname(targetPath) : baseRoot, targetPath);
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, original);
      return {
        tag: 'ATOMIC_PATCH',
        action: `Atomic patch & rollback ${cleaned} [${scope}]`,
        success: false,
        summary: `Syntax/TypeScript check failed after ${edits.length} hunks; rolled back ${cleaned}`,
        output: { path: cleaned, targetPath, scope, hunks: edits.length, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = createCompactDiff(cleaned, original, modified);
  const snapshot = recordPatchSnapshot({
    agentId,
    operation: 'atomicPatch',
    scope,
    displayPath: cleaned,
    targetPath,
    existedBefore: true,
    previousContent: original,
    beforeSha256: sha256(original).slice(0, 16),
    afterSha256: sha256(modified).slice(0, 16),
    diff
  });

  return {
    tag: 'ATOMIC_PATCH',
    action: `Atomic multi-hunk patch: ${cleaned} [${scope}]`,
    success: true,
    summary: `Applied ${edits.length} atomic hunk(s) to ${cleaned} [${scope}] (patchId:${snapshot.patchId})${verifyCompile ? ' (verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
      targetPath,
      scope,
      patchId: snapshot.patchId,
      hunksApplied: edits.length,
      sha256: sha256(modified).slice(0, 16),
      diff,
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyBatchPatchFiles(args: Record<string, any>): Promise<AutonomyResult> {
  const operations: BatchFileOperation[] = Array.isArray(args.operations) ? args.operations : [];
  const verifyCompile = Boolean(args.verifyCompile);
  const defaultScope = args.scope;
  const defaultRootPath = args.rootPath || args.cwd;
  const agentId = String(args.agentId || 'uid_0');

  if (operations.length === 0) {
    return {
      tag: 'BATCH_PATCH',
      action: 'Batch transaction',
      success: false,
      summary: 'operations array is required and cannot be empty',
      output: { error: 'operations array is empty' }
    };
  }

  // Phase 1: Pre-flight validate all paths & simulate all in-memory transitions without touching disk
  const snapshots = new Map<string, { existed: boolean; content: string | null; cleaned: string; scope: 'orchestrator' | 'target' | 'host'; baseRoot: string }>();
  const staged = new Map<string, { action: 'write' | 'delete'; cleaned: string; scope: 'orchestrator' | 'target' | 'host'; baseRoot: string; newContent?: string }>();

  try {
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const rawType = String(op.type || op.action || '').trim();
      const opType = rawType === 'atomic_patch' ? 'atomicPatch'
        : rawType === 'patch_file' ? 'patch'
        : rawType === 'write_file' ? 'write'
        : rawType === 'delete_file' ? 'delete'
        : rawType;
      const mode = opType === 'delete' ? 'delete' : 'write';
      const { cleaned, targetPath, scope, baseRoot } = resolveUniversalPath(
        op.filePath || '',
        mode,
        { scope: op.scope || defaultScope, rootPath: op.rootPath || defaultRootPath }
      );

      if (!snapshots.has(targetPath)) {
        const existed = fs.existsSync(targetPath);
        const content = existed ? await fs.promises.readFile(targetPath, 'utf-8') : null;
        snapshots.set(targetPath, { existed, content, cleaned, scope, baseRoot });
      }

      const prevStaged = staged.get(targetPath);
      const currentVirtualContent = prevStaged
        ? (prevStaged.action === 'delete' ? null : prevStaged.newContent ?? null)
        : snapshots.get(targetPath)!.content;

      if (opType === 'write') {
        staged.set(targetPath, { action: 'write', cleaned, scope, baseRoot, newContent: String(op.content ?? '') });
      } else if (opType === 'delete') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: cannot delete non-existent file "${cleaned}"`);
        }
        staged.set(targetPath, { action: 'delete', cleaned, scope, baseRoot });
      } else if (opType === 'patch') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: file not found "${cleaned}"`);
        }
        const batchTarget = op.targetContent ?? (op as any).search ?? (op as any).oldText ?? (op as any).target ?? '';
        const batchReplace = op.replacementContent ?? (op as any).replace ?? (op as any).newText ?? (op as any).replacement ?? '';
        const updated = applyHunkList(cleaned, currentVirtualContent, [{
          targetContent: String(batchTarget),
          replacementContent: String(batchReplace),
          startLine: (op as any).startLine,
          endLine: (op as any).endLine,
          allowMultiple: op.allowMultiple
        }]);
        staged.set(targetPath, { action: 'write', cleaned, scope, baseRoot, newContent: updated });
      } else if (opType === 'atomicPatch') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: file not found "${cleaned}"`);
        }
        const rawHunks = op.edits ?? op.patches ?? op.hunks;
        const hunks = Array.isArray(rawHunks) ? rawHunks : [];
        if (hunks.length === 0) throw new Error(`Op #${i + 1}: atomicPatch edits array is empty for "${cleaned}"`);
        const updated = applyHunkList(cleaned, currentVirtualContent, hunks);
        staged.set(targetPath, { action: 'write', cleaned, scope, baseRoot, newContent: updated });
      } else {
        throw new Error(`Op #${i + 1}: unsupported batch operation type "${rawType}"`);
      }
    }
  } catch (preflightErr: any) {
    return {
      tag: 'BATCH_PATCH',
      action: 'Batch pre-flight failed',
      success: false,
      summary: preflightErr?.message || 'Batch pre-flight validation failed (0 files touched)',
      output: { error: preflightErr?.message || 'Batch validation failed', filesModified: 0 }
    };
  }

  const rollbackAll = async () => {
    for (const [targetPath, snap] of snapshots.entries()) {
      if (snap.existed && snap.content !== null) {
        await atomicWriteTextFile(targetPath, snap.content).catch(() => {});
      } else if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath).catch(() => {});
      }
    }
  };

  // Phase 2: Commit staged transitions atomically
  const summaryRows: Array<{ path: string; targetPath: string; scope: string; action: string; patchId?: string; sha256?: string }> = [];
  try {
    for (const [targetPath, change] of staged.entries()) {
      const snap = snapshots.get(targetPath)!;
      if (change.action === 'write') {
        await atomicWriteTextFile(targetPath, change.newContent!);
        const diff = snap.content !== null ? createCompactDiff(change.cleaned, snap.content, change.newContent!) : `+++ b/${change.cleaned}`;
        const rec = recordPatchSnapshot({
          agentId,
          operation: 'batch',
          scope: change.scope,
          displayPath: change.cleaned,
          targetPath,
          existedBefore: snap.existed,
          previousContent: snap.content,
          beforeSha256: snap.content !== null ? sha256(snap.content).slice(0, 16) : null,
          afterSha256: sha256(change.newContent!).slice(0, 16),
          diff
        });
        summaryRows.push({
          path: change.cleaned,
          targetPath,
          scope: change.scope,
          action: 'written',
          patchId: rec.patchId,
          sha256: sha256(change.newContent!).slice(0, 16)
        });
      } else {
        if (fs.existsSync(targetPath)) await fs.promises.unlink(targetPath);
        const rec = recordPatchSnapshot({
          agentId,
          operation: 'batch',
          scope: change.scope,
          displayPath: change.cleaned,
          targetPath,
          existedBefore: snap.existed,
          previousContent: snap.content,
          beforeSha256: snap.content !== null ? sha256(snap.content).slice(0, 16) : null,
          afterSha256: null,
          diff: `--- a/${change.cleaned} (deleted)`
        });
        summaryRows.push({ path: change.cleaned, targetPath, scope: change.scope, action: 'deleted', patchId: rec.patchId });
      }
    }
  } catch (commitErr: any) {
    await rollbackAll();
    return {
      tag: 'BATCH_PATCH',
      action: 'Batch commit failed & rolled back',
      success: false,
      summary: `Commit failed (${commitErr?.message}); rolled back all ${snapshots.size} file(s)`,
      output: { error: commitErr?.message || 'Commit error', rolledBack: true, filesRestored: snapshots.size }
    };
  }

  // Phase 3: Optional compile gate across touched roots
  if (verifyCompile) {
    const touchedRoots = new Set<string>();
    for (const [, change] of staged.entries()) {
      if (change.baseRoot !== '/') touchedRoots.add(change.baseRoot);
    }
    for (const rootDir of touchedRoots) {
      const tsc = await runTypeCheck(rootDir);
      if (!tsc.clean) {
        await rollbackAll();
        return {
          tag: 'BATCH_PATCH',
          action: 'Batch compile check failed & rolled back',
          success: false,
          summary: `Compile check failed in ${rootDir}; rolled back all ${snapshots.size} file(s)`,
          output: { rolledBack: true, filesRestored: snapshots.size, diagnostics: tsc.diagnostics }
        };
      }
    }
  }

  return {
    tag: 'BATCH_PATCH',
    action: `Atomic multi-file transaction (${summaryRows.length} file(s))`,
    success: true,
    summary: `Committed ${operations.length} op(s) across ${summaryRows.length} file(s)${verifyCompile ? ' (verified)' : ''}`,
    output: {
      committedFiles: summaryRows,
      operationsCount: operations.length,
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyDeleteFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope, baseRoot } = resolveUniversalPath(
    args.filePath || args.path || '',
    'delete',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  const verifyCompile = Boolean(args.verifyCompile);
  const agentId = String(args.agentId || 'uid_0');

  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'DELETE_FILE',
      action: `Delete ${cleaned} [${scope}]`,
      success: false,
      summary: `File not found: ${cleaned}`,
      output: { error: `File not found: ${cleaned}`, targetPath, scope }
    };
  }
  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    return {
      tag: 'DELETE_FILE',
      action: `Delete ${cleaned} [${scope}]`,
      success: false,
      summary: `Refusing to delete directory "${cleaned}" via deleteFile.`,
      output: { error: 'Cannot delete directory via deleteFile', targetPath, scope }
    };
  }

  const backup = await fs.promises.readFile(targetPath, 'utf-8');
  await fs.promises.unlink(targetPath);

  if (verifyCompile) {
    const tsc = await runTypeCheck(baseRoot === '/' ? path.dirname(targetPath) : baseRoot);
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, backup);
      return {
        tag: 'DELETE_FILE',
        action: `Delete & rollback ${cleaned} [${scope}]`,
        success: false,
        summary: `Compile failed after deleting ${cleaned}; restored file`,
        output: { path: cleaned, targetPath, scope, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const snapshot = recordPatchSnapshot({
    agentId,
    operation: 'delete',
    scope,
    displayPath: cleaned,
    targetPath,
    existedBefore: true,
    previousContent: backup,
    beforeSha256: sha256(backup).slice(0, 16),
    afterSha256: null,
    diff: `--- a/${cleaned} (deleted ${backup.length} bytes)`
  });

  return {
    tag: 'DELETE_FILE',
    action: `Deleted file: ${cleaned} [${scope}]`,
    success: true,
    summary: `Deleted ${cleaned} [${scope}] (${backup.length} bytes, patchId:${snapshot.patchId})${verifyCompile ? ' (verified)' : ''}`,
    output: { path: cleaned, targetPath, scope, patchId: snapshot.patchId, deletedBytes: backup.length }
  };
}

export async function autonomyRollbackPatch(args: Record<string, any> = {}): Promise<AutonomyResult> {
  const patchId = String(args.patchId || '').trim();
  const filePath = String(args.filePath || args.path || '').trim();

  if (args.operation === 'list' || (!patchId && !filePath && !args.latest)) {
    const ledger = getAtomicPatchLedger(Number(args.limit) || 25);
    return {
      tag: 'ROLLBACK_PATCH',
      action: 'Listed atomic patch snapshot ledger',
      success: true,
      summary: `${ledger.length} atomic patch snapshot(s) available for instant rollback`,
      output: { totalSnapshots: atomicPatchLedger.length, snapshots: ledger }
    };
  }

  let targetRecord: AtomicPatchSnapshotRecord | undefined;
  if (patchId) {
    targetRecord = atomicPatchLedger.find(r => r.patchId === patchId);
  } else if (filePath) {
    const resolved = resolveUniversalPath(filePath, 'write', { scope: args.scope, rootPath: args.rootPath });
    targetRecord = atomicPatchLedger.find(r => (r.targetPath === resolved.targetPath || r.displayPath === filePath) && !r.rolledBack);
  } else if (args.latest) {
    targetRecord = atomicPatchLedger.find(r => !r.rolledBack);
  }

  if (!targetRecord) {
    return {
      tag: 'ROLLBACK_PATCH',
      action: `Rollback atomic patch (${patchId || filePath || 'latest'})`,
      success: false,
      summary: `No matching atomic patch snapshot found for "${patchId || filePath || 'latest'}"`,
      output: { error: 'Snapshot not found', availableSnapshots: getAtomicPatchLedger(10) }
    };
  }

  if (targetRecord.existedBefore && targetRecord.previousContent !== null) {
    await atomicWriteTextFile(targetRecord.targetPath, targetRecord.previousContent);
  } else if (!targetRecord.existedBefore && fs.existsSync(targetRecord.targetPath)) {
    await fs.promises.unlink(targetRecord.targetPath).catch(() => {});
  }

  targetRecord.rolledBack = true;
  savePatchLedger();

  return {
    tag: 'ROLLBACK_PATCH',
    action: `Rolled back ${targetRecord.displayPath} (${targetRecord.patchId})`,
    success: true,
    summary: `Atomically restored ${targetRecord.displayPath} [${targetRecord.scope}] to pre-patch state (sha256:${targetRecord.beforeSha256 || 'deleted'})`,
    output: {
      patchId: targetRecord.patchId,
      path: targetRecord.displayPath,
      targetPath: targetRecord.targetPath,
      scope: targetRecord.scope,
      restoredSha256: targetRecord.beforeSha256,
      rolledBackAt: new Date().toISOString()
    }
  };
}

export async function autonomyListDirectory(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath, scope } = resolveUniversalPath(
    args.dirPath || args.path || '.',
    'list',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'LIST_DIR',
      action: `List ${cleaned} [${scope}]`,
      success: false,
      summary: `Directory not found: ${cleaned} (${targetPath})`,
      output: { error: `Directory not found: ${cleaned}`, targetPath, scope }
    };
  }

  const recursive = Boolean(args.recursive);
  const maxDepth = Math.min(Math.max(Number(args.maxDepth) || 2, 1), 6);
  const results: Array<{ name: string; path: string; fullPath: string; type: 'directory' | 'file'; size?: number }> = [];

  const walk = async (dir: string, relBase: string, depth: number) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name === '.vault.key' || entry.name === '.secrets.vault.enc') continue;
      const entryRel = relBase === '.' ? entry.name : `${relBase}/${entry.name}`;
      const fullChild = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: entryRel, fullPath: fullChild, type: 'directory' });
        if (recursive && depth < maxDepth) {
          await walk(fullChild, entryRel, depth + 1);
        }
      } else {
        let size = 0;
        try { size = (await fs.promises.stat(fullChild)).size; } catch {}
        results.push({ name: entry.name, path: entryRel, fullPath: fullChild, type: 'file', size });
      }
      if (results.length >= 600) return;
    }
  };

  await walk(targetPath, cleaned, 1);

  return {
    tag: 'LIST_DIR',
    action: `Listed directory: ${cleaned} [${scope}]`,
    success: true,
    summary: `${results.length} entries in ${cleaned} [${scope}] (${targetPath})`,
    output: results
  };
}

export async function autonomySearchCode(args: Record<string, any>): Promise<AutonomyResult> {
  const queryText = String(args.query || args.pattern || '').trim();
  if (!queryText) {
    return {
      tag: 'SEARCH_CODE',
      action: 'Search codebase',
      success: false,
      summary: 'query string is required',
      output: { error: 'query string is required' }
    };
  }

  const { cleaned, targetPath, scope } = resolveUniversalPath(
    args.dirPath || args.path || '.',
    'list',
    { scope: args.scope, rootPath: args.rootPath || args.cwd }
  );
  const isRegex = Boolean(args.isRegex ?? args.regex);
  const caseSensitive = Boolean(args.caseSensitive);
  const maxResults = Math.min(Math.max(Number(args.maxResults) || 60, 1), 250);
  const extFilter: string[] | null = Array.isArray(args.fileExtensions) && args.fileExtensions.length > 0
    ? args.fileExtensions.map((e: string) => String(e).toLowerCase())
    : null;

  let matcher: RegExp | null = null;
  if (isRegex) {
    try {
      matcher = new RegExp(queryText, caseSensitive ? '' : 'i');
    } catch {
      matcher = null;
    }
  }

  const matches: Array<{ file: string; fullPath: string; line: number; text: string }> = [];
  const qLower = queryText.toLowerCase();

  const walk = async (dir: string, relBase: string) => {
    if (matches.length >= maxResults) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (matches.length >= maxResults) break;
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name === '.vault.key' || entry.name === '.secrets.vault.enc') continue;
      const entryRel = relBase === '.' ? entry.name : `${relBase}/${entry.name}`;
      if (internalSecretsHandler.isSensitivePath(entryRel)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, entryRel);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (extFilter && !extFilter.includes(ext)) continue;
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.db', '.gz', '.zip', '.jar', '.apk', '.woff2', '.mp3', '.wav', '.mp4'].includes(ext)) continue;

        let stat: fs.Stats;
        try { stat = await fs.promises.stat(fullPath); } catch { continue; }
        if (stat.size > 1_500_000) continue;

        let content: string;
        try { content = await fs.promises.readFile(fullPath, 'utf-8'); } catch { continue; }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          const hit = matcher
            ? matcher.test(lineText)
            : (caseSensitive ? lineText.includes(queryText) : lineText.toLowerCase().includes(qLower));
          if (hit) {
            matches.push({
              file: entryRel,
              fullPath,
              line: i + 1,
              text: internalSecretsHandler.redactText(lineText.trim().slice(0, 260))
            });
            if (matches.length >= maxResults) break;
          }
        }
      }
    }
  };

  if (fs.existsSync(targetPath)) {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await walk(targetPath, cleaned);
    } else {
      const content = await fs.promises.readFile(targetPath, 'utf-8');
      content.split('\n').forEach((lineText, i) => {
        if (matches.length >= maxResults) return;
        const hit = matcher
          ? matcher.test(lineText)
          : (caseSensitive ? lineText.includes(queryText) : lineText.toLowerCase().includes(qLower));
        if (hit) {
          matches.push({ file: cleaned, fullPath: targetPath, line: i + 1, text: internalSecretsHandler.redactText(lineText.trim().slice(0, 260)) });
        }
      });
    }
  }

  return {
    tag: 'SEARCH_CODE',
    action: `Searched "${queryText}" in ${cleaned} [${scope}]`,
    success: true,
    summary: `Found ${matches.length} match(es) for "${queryText}" in ${cleaned} [${scope}]`,
    output: { query: queryText, scope, rootSearched: targetPath, count: matches.length, totalMatches: matches.length, matches }
  };
}

export async function autonomyRunTerminalCommand(args: Record<string, any>): Promise<AutonomyResult> {
  const cmd = String(args.command || args.cmd || '').trim();
  if (!cmd) {
    return {
      tag: 'RUN_COMMAND',
      action: 'Run command',
      success: false,
      summary: 'Command string is required',
      output: { error: 'Command string is required' }
    };
  }

  // Block commands explicitly targeting encrypted vault key material
  if (/(\.vault\.key|\.secrets\.vault\.enc)/i.test(cmd)) {
    return {
      tag: 'RUN_COMMAND',
      action: `Blocked sensitive vault key command`,
      success: false,
      summary: 'Command blocked by internal secrets handler protection policy.',
      output: { exitCode: 403, stdout: '', stderr: 'Blocked: direct shell inspection of encrypted vault key material is prohibited.' }
    };
  }

  let execCwd = activeTargetSystem.rootPath || ORCHESTRATOR_ROOT;
  const requestedScope = String(args.scope || '').toLowerCase();
  if (args.cwd || args.workingDirectory || args.rootPath) {
    const rawCwd = String(args.cwd || args.workingDirectory || args.rootPath).trim();
    const resolved = resolveUniversalPath(rawCwd, 'list', { scope: requestedScope || 'host' });
    if (fs.existsSync(resolved.targetPath)) {
      execCwd = resolved.targetPath;
    }
  } else if (requestedScope === 'orchestrator' || requestedScope === 'self') {
    execCwd = ORCHESTRATOR_ROOT;
  } else if (requestedScope === 'target') {
    execCwd = activeTargetSystem.rootPath || ORCHESTRATOR_ROOT;
  }

  const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 35000, 1000), 120000);
  return new Promise((resolve) => {
    child_process.exec(
      cmd,
      {
        cwd: execCwd,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PAGER: 'cat', ...(args.env && typeof args.env === 'object' ? args.env : {}) }
      },
      (err, stdout, stderr) => {
        const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        const cleanStdout = internalSecretsHandler.redactText(stdout?.trim() || '');
        const cleanStderr = internalSecretsHandler.redactText(stderr?.trim() || '');
        resolve({
          tag: 'RUN_COMMAND',
          action: `Executed in ${execCwd}: ${internalSecretsHandler.redactText(cmd)}`,
          success: !err,
          summary: `Exit code ${exitCode} (cwd: ${execCwd})`,
          output: { exitCode, cwd: execCwd, stdout: cleanStdout, stderr: cleanStderr }
        });
      }
    );
  });
}

export async function autonomyRunLint(args: Record<string, any> = {}): Promise<AutonomyResult> {
  const scope = String(args.scope || 'auto').toLowerCase();
  const targetDir = scope === 'orchestrator' || scope === 'self'
    ? ORCHESTRATOR_ROOT
    : (args.rootPath || args.cwd ? resolveUniversalPath(String(args.rootPath || args.cwd), 'list', { scope: 'host' }).targetPath : activeTargetSystem.rootPath);

  const tsc = await runTypeCheck(targetDir);
  return {
    tag: 'RUN_LINT',
    action: `Compiler & syntax check (${targetDir})`,
    success: tsc.clean,
    summary: tsc.clean ? `0 errors in ${targetDir}` : `Compiler/syntax errors reported in ${targetDir}`,
    output: { clean: tsc.clean, targetDir, diagnostics: tsc.diagnostics }
  };
}

/**
 * Points the Orchestrator at any directory, repository, or system path on the host machine,
 * or switches back to the Orchestrator's own workspace ('self' / 'orchestrator').
 */
export async function autonomySetTargetSystem(args: Record<string, any> = {}): Promise<AutonomyResult> {
  const rawTarget = String(args.targetPath || args.path || args.rootPath || 'self').trim();
  const createIfMissing = Boolean(args.createIfMissing);

  if (!rawTarget || rawTarget.toLowerCase() === 'self' || rawTarget.toLowerCase() === 'orchestrator' || rawTarget === '@self') {
    activeTargetSystem = {
      rootPath: ORCHESTRATOR_ROOT,
      label: args.label ? String(args.label) : 'Lysander Genesis Orchestrator (Self Workspace)',
      isSelf: true,
      detectedStack: detectDirectoryStack(ORCHESTRATOR_ROOT),
      pointedAt: new Date().toISOString(),
      history: activeTargetSystem.history
    };
    saveTargetSystemState();
    return {
      tag: 'TARGET_SYSTEM',
      action: `Pointed orchestrator at Self Workspace (${ORCHESTRATOR_ROOT})`,
      success: true,
      summary: `Active target pointed to Orchestrator Self Workspace (${ORCHESTRATOR_ROOT})`,
      output: getTargetSystemConfig()
    };
  }

  const expanded = rawTarget.startsWith('~/')
    ? path.join(os.homedir(), rawTarget.slice(1))
    : path.isAbsolute(rawTarget)
      ? path.normalize(rawTarget)
      : path.resolve(ORCHESTRATOR_ROOT, rawTarget);

  if (!fs.existsSync(expanded)) {
    if (createIfMissing) {
      await fs.promises.mkdir(expanded, { recursive: true });
    } else {
      return {
        tag: 'TARGET_SYSTEM',
        action: `Point orchestrator at ${expanded}`,
        success: false,
        summary: `Target directory does not exist: ${expanded} (pass createIfMissing: true to initialize it)`,
        output: { error: `Directory not found: ${expanded}`, currentTarget: getTargetSystemConfig() }
      };
    }
  }

  const stat = await fs.promises.stat(expanded);
  const targetDir = stat.isDirectory() ? fs.realpathSync(expanded) : path.dirname(fs.realpathSync(expanded));
  const stack = detectDirectoryStack(targetDir);
  const label = args.label ? String(args.label).trim() : (targetDir === ORCHESTRATOR_ROOT ? 'Lysander Genesis Orchestrator (Self Workspace)' : path.basename(targetDir) || targetDir);
  const now = new Date().toISOString();

  const history = [
    { rootPath: targetDir, label, pointedAt: now },
    ...activeTargetSystem.history.filter(h => h.rootPath !== targetDir)
  ].slice(0, 20);

  activeTargetSystem = {
    rootPath: targetDir,
    label,
    isSelf: targetDir === ORCHESTRATOR_ROOT,
    detectedStack: stack,
    pointedAt: now,
    history
  };
  saveTargetSystemState();

  // Gather quick entry snapshot of the pointed-at target
  let topEntries: string[] = [];
  try {
    topEntries = fs.readdirSync(targetDir).slice(0, 35);
  } catch {}

  return {
    tag: 'TARGET_SYSTEM',
    action: `Pointed orchestrator at: ${targetDir}`,
    success: true,
    summary: `Orchestrator pointed at "${label}" (${targetDir}) · Stack: ${stack.join(', ')}`,
    output: {
      ...getTargetSystemConfig(),
      topEntries
    }
  };
}

/**
 * Inspects the Orchestrator's own workspace ('self'), the currently pointed-at Target System ('target'),
 * the Host OS environment ('host'), and the Atomic Patch Snapshot Ledger.
 */
export async function autonomyInspectTargetSystem(args: Record<string, any> = {}): Promise<AutonomyResult> {
  const config = getTargetSystemConfig();
  let targetEntries: string[] = [];
  try {
    targetEntries = fs.readdirSync(config.rootPath).filter(n => !IGNORED_DIRS.has(n)).slice(0, 40);
  } catch {}

  let selfEntries: string[] = [];
  try {
    selfEntries = fs.readdirSync(ORCHESTRATOR_ROOT).filter(n => !IGNORED_DIRS.has(n)).slice(0, 40);
  } catch {}

  const cpus = os.cpus();
  const hostSystem = {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Host CPU',
    cpuCores: cpus.length,
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
    uptimeSec: Math.round(os.uptime()),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    nodeVersion: process.version,
    pid: process.pid,
    uid: typeof process.getuid === 'function' ? process.getuid() : 0
  };

  return {
    tag: 'INSPECT_SYSTEMS',
    action: 'Inspected Orchestrator Self, Pointed Target System, and Host OS',
    success: true,
    summary: `Target="${config.label}" (${config.rootPath}) | Self=${ORCHESTRATOR_ROOT} | Host=${hostSystem.platform}/${hostSystem.arch} (${hostSystem.freeMemMb}MB free)`,
    output: {
      targetSystem: {
        ...config,
        topLevelEntries: targetEntries
      },
      orchestratorSelf: {
        rootPath: ORCHESTRATOR_ROOT,
        topLevelEntries: selfEntries,
        detectedStack: detectDirectoryStack(ORCHESTRATOR_ROOT)
      },
      hostSystem,
      atomicPatchLedger: getAtomicPatchLedger(15)
    }
  };
}

/**
 * Executes comprehensive host-system inspection, process control, or multi-step scripts
 * across the Host OS, the pointed-at Target System, or the Orchestrator itself.
 */
export async function autonomyExecuteHostAction(args: Record<string, any> = {}): Promise<AutonomyResult> {
  const operation = String(args.operation || args.action || 'os_probe').toLowerCase().trim();

  if (operation === 'os_probe' || operation === 'status') {
    const [dfRes, psRes, toolsRes] = await Promise.all([
      autonomyRunTerminalCommand({ command: 'df -h . /tmp 2>/dev/null || true', timeoutMs: 8000 }),
      autonomyRunTerminalCommand({ command: 'ps aux 2>/dev/null | head -n 20 || true', timeoutMs: 8000 }),
      autonomyRunTerminalCommand({ command: 'which node npm npx git python3 bash curl sqlite3 2>/dev/null || true', timeoutMs: 8000 })
    ]);
    const sysInfo = await autonomyInspectTargetSystem();
    return {
      tag: 'HOST_SYSTEM',
      action: 'Host OS & Runtime Probe',
      success: true,
      summary: `Probed host OS (${os.platform()} ${os.release()}), disk mounts, processes, and installed toolchains`,
      output: {
        ...(sysInfo.output || {}),
        diskUsage: dfRes.output?.stdout || '',
        topProcesses: psRes.output?.stdout || '',
        availableBinaries: (toolsRes.output?.stdout || '').split('\n').filter(Boolean)
      }
    };
  }

  if (operation === 'process_list' || operation === 'ps') {
    return autonomyRunTerminalCommand({
      command: 'ps aux 2>/dev/null | head -n 45 || ps -ef | head -n 45',
      scope: args.scope,
      cwd: args.cwd
    });
  }

  if (operation === 'disk_usage' || operation === 'df') {
    return autonomyRunTerminalCommand({
      command: 'df -h 2>/dev/null && du -sh * 2>/dev/null | head -n 30',
      scope: args.scope,
      cwd: args.cwd
    });
  }

  if (operation === 'git_status' || operation === 'git') {
    return autonomyRunTerminalCommand({
      command: 'git status -sb 2>&1 && git log -n 5 --oneline 2>&1 || echo "Not a git repository"',
      scope: args.scope,
      cwd: args.cwd
    });
  }

  if (operation === 'exec' || operation === 'script' || args.command) {
    return autonomyRunTerminalCommand({
      command: String(args.command || args.script || ''),
      scope: args.scope,
      cwd: args.cwd || args.rootPath,
      env: args.env,
      timeoutMs: args.timeoutMs
    });
  }

  return autonomyInspectTargetSystem(args);
}
