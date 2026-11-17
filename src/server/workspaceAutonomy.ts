import child_process from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
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
  content?: string;
  targetContent?: string;
  replacementContent?: string;
  edits?: PatchHunk[];
  patches?: PatchHunk[];
  hunks?: PatchHunk[];
  allowMultiple?: boolean;
}

const WORKSPACE_ROOT = fs.realpathSync(process.cwd());
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.aistudio', 'android']);
const PROTECTED_CORE_FILES = new Set(['server.ts', 'package.json', 'tsconfig.json', 'vite.config.ts']);

function resolveWorkspacePath(relPath: string, mode: 'read' | 'write' | 'delete' | 'list'): { cleaned: string; targetPath: string } {
  const raw = String(relPath ?? '').trim();
  const cleaned = raw.replace(/^\/+/, '') || (mode === 'list' ? '.' : '');
  if (!cleaned && mode !== 'list') {
    throw new Error('File path is required.');
  }
  if (cleaned.includes('\0')) {
    throw new Error('Invalid null byte in path.');
  }

  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  const relFromRoot = path.relative(WORKSPACE_ROOT, resolved);

  if (relFromRoot === '..' || relFromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relFromRoot)) {
    throw new Error(`Access denied outside workspace bounds: ${raw}`);
  }

  const normalizedRel = relFromRoot.split(path.sep).join('/');

  if (internalSecretsHandler.isSensitivePath(normalizedRel)) {
    throw new Error(`Access denied: "${normalizedRel || cleaned}" is protected by the internal secrets handler.`);
  }

  // Verify symlink targets cannot escape workspace bounds
  let checkTarget = resolved;
  while (!fs.existsSync(checkTarget)) {
    const parent = path.dirname(checkTarget);
    if (parent === checkTarget) break;
    checkTarget = parent;
  }
  if (fs.existsSync(checkTarget)) {
    const realTarget = fs.realpathSync(checkTarget);
    const realRel = path.relative(WORKSPACE_ROOT, realTarget);
    if (realRel === '..' || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel)) {
      throw new Error(`Symlink escape denied outside workspace bounds: ${raw}`);
    }
  }

  if (mode === 'delete' && PROTECTED_CORE_FILES.has(normalizedRel)) {
    throw new Error(`Refusing to delete protected core manifest/entry file "${normalizedRel}".`);
  }

  return { cleaned: normalizedRel || '.', targetPath: resolved };
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
  const removed = beforeLines.slice(start, endBefore + 1).slice(0, 20).map(l => `- ${l}`);
  const added = afterLines.slice(start, endAfter + 1).slice(0, 20).map(l => `+ ${l}`);
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

export async function runTypeCheck(): Promise<{ clean: boolean; diagnostics: string }> {
  return new Promise((resolve) => {
    child_process.exec('npx tsc --noEmit', { cwd: WORKSPACE_ROOT, timeout: 45000, maxBuffer: 6 * 1024 * 1024 }, (err, stdout, stderr) => {
      const clean = !err;
      const raw = [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n');
      const diagnostics = internalSecretsHandler.redactText(raw || (clean ? '0 TypeScript errors' : 'TypeScript compilation failed'));
      resolve({ clean, diagnostics });
    });
  });
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

function applyHunkList(filePath: string, original: string, edits: PatchHunk[]): string {
  let working = original;
  for (let i = 0; i < edits.length; i++) {
    const hunk = edits[i];
    const rawTarget = hunk?.targetContent ?? hunk?.search ?? hunk?.oldText ?? hunk?.target;
    const rawReplacement = hunk?.replacementContent ?? hunk?.replace ?? hunk?.newText ?? hunk?.replacement;
    const target = rawTarget !== undefined && rawTarget !== null ? String(rawTarget) : '';
    const replacement = rawReplacement !== undefined && rawReplacement !== null ? String(rawReplacement) : '';
    if (!target) {
      throw new Error(`Hunk #${i + 1} in "${filePath}" has empty targetContent.`);
    }
    const occurrences = countOccurrences(working, target);
    if (occurrences === 0) {
      throw new Error(`Hunk #${i + 1} targetContent not found in "${filePath}".`);
    }
    if (occurrences > 1 && !hunk.allowMultiple) {
      throw new Error(`Hunk #${i + 1} in "${filePath}" matched ${occurrences} occurrences; provide more surrounding context or set allowMultiple: true.`);
    }
    working = hunk.allowMultiple
      ? working.split(target).join(replacement)
      : working.replace(target, replacement);
  }
  return working;
}

export async function autonomyReadFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.filePath || args.path || '', 'read');
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'READ_FILE',
      action: `Read ${cleaned}`,
      success: false,
      summary: `File not found: ${cleaned}`,
      output: { error: `File not found: ${cleaned}` }
    };
  }
  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    return {
      tag: 'READ_FILE',
      action: `Read ${cleaned}`,
      success: false,
      summary: `"${cleaned}" is a directory; use listDirectory instead.`,
      output: { error: `"${cleaned}" is a directory` }
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
      action: `Read lines ${from}-${to} of ${cleaned}`,
      success: true,
      summary: `Read lines ${from}-${to} of ${lines.length} from ${cleaned}`,
      output: slice
    };
  }

  return {
    tag: 'READ_FILE',
    action: `Read file: ${cleaned}`,
    success: true,
    summary: `Read ${redacted.length} chars from ${cleaned} (sha256:${sha256(rawContent).slice(0, 10)})`,
    output: redacted
  };
}

export async function autonomyWriteFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.filePath || args.path || '', 'write');
  const content = String(args.content ?? '');
  const verifyCompile = Boolean(args.verifyCompile);

  const existed = fs.existsSync(targetPath);
  const previousContent = existed ? await fs.promises.readFile(targetPath, 'utf-8') : null;

  await atomicWriteTextFile(targetPath, content);

  if (verifyCompile) {
    const tsc = await runTypeCheck();
    if (!tsc.clean) {
      // Rollback automatically
      if (existed && previousContent !== null) {
        await atomicWriteTextFile(targetPath, previousContent);
      } else if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath).catch(() => {});
      }
      return {
        tag: 'WRITE_FILE',
        action: `Write & rollback ${cleaned}`,
        success: false,
        summary: `Compile verification failed; rolled back ${cleaned}`,
        output: { path: cleaned, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = previousContent !== null ? createCompactDiff(cleaned, previousContent, content) : `+++ b/${cleaned} (${content.length} bytes)`;
  return {
    tag: 'WRITE_FILE',
    action: `Wrote file: ${cleaned}`,
    success: true,
    summary: `Atomically wrote ${content.length} bytes to ${cleaned}${verifyCompile ? ' (tsc verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
      bytes: content.length,
      sha256: sha256(content).slice(0, 16),
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyPatchFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.filePath || args.path || '', 'write');
  const targetContent = String(args.targetContent ?? args.search ?? '');
  const replacementContent = String(args.replacementContent ?? args.replace ?? '');
  const allowMultiple = Boolean(args.allowMultiple);
  const verifyCompile = Boolean(args.verifyCompile);

  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'PATCH_FILE',
      action: `Patch ${cleaned}`,
      success: false,
      summary: `File not found: ${cleaned}`,
      output: { error: `File not found: ${cleaned}` }
    };
  }

  const original = await fs.promises.readFile(targetPath, 'utf-8');
  let modified: string;
  try {
    modified = applyHunkList(cleaned, original, [{ targetContent, replacementContent, allowMultiple }]);
  } catch (err: any) {
    return {
      tag: 'PATCH_FILE',
      action: `Patch ${cleaned}`,
      success: false,
      summary: err?.message || `Patch pre-flight failed on ${cleaned}`,
      output: { error: err?.message || 'Patch pre-flight failed' }
    };
  }

  await atomicWriteTextFile(targetPath, modified);

  if (verifyCompile) {
    const tsc = await runTypeCheck();
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, original);
      return {
        tag: 'PATCH_FILE',
        action: `Patch & rollback ${cleaned}`,
        success: false,
        summary: `Compile check failed; rolled back ${cleaned}`,
        output: { path: cleaned, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = createCompactDiff(cleaned, original, modified);
  return {
    tag: 'PATCH_FILE',
    action: `Patched file: ${cleaned}`,
    success: true,
    summary: `Atomically patched ${cleaned}${verifyCompile ? ' (tsc verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
      sha256: sha256(modified).slice(0, 16),
      diff,
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyAtomicPatchFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.filePath || args.path || '', 'write');
  const rawEdits = args.edits ?? args.patches ?? args.hunks;
  const edits: PatchHunk[] = Array.isArray(rawEdits) ? rawEdits : [];
  const verifyCompile = Boolean(args.verifyCompile);

  if (edits.length === 0) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned}`,
      success: false,
      summary: 'edits array must contain at least one hunk',
      output: { error: 'edits array is required' }
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned}`,
      success: false,
      summary: `File not found: ${cleaned}`,
      output: { error: `File not found: ${cleaned}` }
    };
  }

  const original = await fs.promises.readFile(targetPath, 'utf-8');
  let modified: string;
  try {
    modified = applyHunkList(cleaned, original, edits);
  } catch (err: any) {
    return {
      tag: 'ATOMIC_PATCH',
      action: `Atomic patch ${cleaned}`,
      success: false,
      summary: err?.message || `Atomic patch pre-flight failed on ${cleaned}`,
      output: { error: err?.message || 'Atomic patch failed' }
    };
  }

  await atomicWriteTextFile(targetPath, modified);

  if (verifyCompile) {
    const tsc = await runTypeCheck();
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, original);
      return {
        tag: 'ATOMIC_PATCH',
        action: `Atomic patch & rollback ${cleaned}`,
        success: false,
        summary: `TypeScript check failed after ${edits.length} hunks; rolled back ${cleaned}`,
        output: { path: cleaned, hunks: edits.length, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  const diff = createCompactDiff(cleaned, original, modified);
  return {
    tag: 'ATOMIC_PATCH',
    action: `Atomic multi-hunk patch: ${cleaned}`,
    success: true,
    summary: `Applied ${edits.length} atomic hunk(s) to ${cleaned}${verifyCompile ? ' (tsc verified)' : ''}`,
    diff,
    output: {
      path: cleaned,
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
  const snapshots = new Map<string, { existed: boolean; content: string | null; cleaned: string }>();
  const staged = new Map<string, { action: 'write' | 'delete'; cleaned: string; newContent?: string }>();

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
      const { cleaned, targetPath } = resolveWorkspacePath(op.filePath || '', mode);

      if (!snapshots.has(targetPath)) {
        const existed = fs.existsSync(targetPath);
        const content = existed ? await fs.promises.readFile(targetPath, 'utf-8') : null;
        snapshots.set(targetPath, { existed, content, cleaned });
      }

      const prevStaged = staged.get(targetPath);
      const currentVirtualContent = prevStaged
        ? (prevStaged.action === 'delete' ? null : prevStaged.newContent ?? null)
        : snapshots.get(targetPath)!.content;

      if (opType === 'write') {
        staged.set(targetPath, { action: 'write', cleaned, newContent: String(op.content ?? '') });
      } else if (opType === 'delete') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: cannot delete non-existent file "${cleaned}"`);
        }
        staged.set(targetPath, { action: 'delete', cleaned });
      } else if (opType === 'patch') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: file not found "${cleaned}"`);
        }
        const batchTarget = op.targetContent ?? (op as any).search ?? (op as any).oldText ?? (op as any).target ?? '';
        const batchReplace = op.replacementContent ?? (op as any).replace ?? (op as any).newText ?? (op as any).replacement ?? '';
        const updated = applyHunkList(cleaned, currentVirtualContent, [{
          targetContent: String(batchTarget),
          replacementContent: String(batchReplace),
          allowMultiple: op.allowMultiple
        }]);
        staged.set(targetPath, { action: 'write', cleaned, newContent: updated });
      } else if (opType === 'atomicPatch') {
        if (currentVirtualContent === null) {
          throw new Error(`Op #${i + 1}: file not found "${cleaned}"`);
        }
        const rawHunks = op.edits ?? op.patches ?? op.hunks;
        const hunks = Array.isArray(rawHunks) ? rawHunks : [];
        if (hunks.length === 0) throw new Error(`Op #${i + 1}: atomicPatch edits array is empty for "${cleaned}"`);
        const updated = applyHunkList(cleaned, currentVirtualContent, hunks);
        staged.set(targetPath, { action: 'write', cleaned, newContent: updated });
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

  // Helper to restore all touched files identically
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
  const summaryRows: Array<{ path: string; action: string; sha256?: string }> = [];
  try {
    for (const [targetPath, change] of staged.entries()) {
      if (change.action === 'write') {
        await atomicWriteTextFile(targetPath, change.newContent!);
        summaryRows.push({ path: change.cleaned, action: 'written', sha256: sha256(change.newContent!).slice(0, 16) });
      } else {
        if (fs.existsSync(targetPath)) await fs.promises.unlink(targetPath);
        summaryRows.push({ path: change.cleaned, action: 'deleted' });
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

  // Phase 3: Optional TypeScript compile gate across entire transaction
  if (verifyCompile) {
    const tsc = await runTypeCheck();
    if (!tsc.clean) {
      await rollbackAll();
      return {
        tag: 'BATCH_PATCH',
        action: 'Batch compile check failed & rolled back',
        success: false,
        summary: `Compile check failed; rolled back all ${snapshots.size} file(s)`,
        output: { rolledBack: true, filesRestored: snapshots.size, diagnostics: tsc.diagnostics }
      };
    }
  }

  return {
    tag: 'BATCH_PATCH',
    action: `Atomic multi-file transaction (${summaryRows.length} file(s))`,
    success: true,
    summary: `Committed ${operations.length} op(s) across ${summaryRows.length} file(s)${verifyCompile ? ' (tsc verified)' : ''}`,
    output: {
      committedFiles: summaryRows,
      operationsCount: operations.length,
      verifiedCompile: verifyCompile
    }
  };
}

export async function autonomyDeleteFile(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.filePath || args.path || '', 'delete');
  const verifyCompile = Boolean(args.verifyCompile);

  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'DELETE_FILE',
      action: `Delete ${cleaned}`,
      success: false,
      summary: `File not found: ${cleaned}`,
      output: { error: `File not found: ${cleaned}` }
    };
  }
  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    return {
      tag: 'DELETE_FILE',
      action: `Delete ${cleaned}`,
      success: false,
      summary: `Refusing to delete directory "${cleaned}" via deleteFile.`,
      output: { error: 'Cannot delete directory via deleteFile' }
    };
  }

  const backup = await fs.promises.readFile(targetPath, 'utf-8');
  await fs.promises.unlink(targetPath);

  if (verifyCompile) {
    const tsc = await runTypeCheck();
    if (!tsc.clean) {
      await atomicWriteTextFile(targetPath, backup);
      return {
        tag: 'DELETE_FILE',
        action: `Delete & rollback ${cleaned}`,
        success: false,
        summary: `Compile failed after deleting ${cleaned}; restored file`,
        output: { path: cleaned, rolledBack: true, diagnostics: tsc.diagnostics }
      };
    }
  }

  return {
    tag: 'DELETE_FILE',
    action: `Deleted file: ${cleaned}`,
    success: true,
    summary: `Deleted ${cleaned} (${backup.length} bytes)${verifyCompile ? ' (tsc verified)' : ''}`,
    output: { path: cleaned, deletedBytes: backup.length }
  };
}

export async function autonomyListDirectory(args: Record<string, any>): Promise<AutonomyResult> {
  const { cleaned, targetPath } = resolveWorkspacePath(args.dirPath || args.path || '.', 'list');
  if (!fs.existsSync(targetPath)) {
    return {
      tag: 'LIST_DIR',
      action: `List ${cleaned}`,
      success: false,
      summary: `Directory not found: ${cleaned}`,
      output: { error: `Directory not found: ${cleaned}` }
    };
  }

  const recursive = Boolean(args.recursive);
  const maxDepth = Math.min(Math.max(Number(args.maxDepth) || 2, 1), 5);
  const results: Array<{ name: string; path: string; type: 'directory' | 'file'; size?: number }> = [];

  const walk = async (dir: string, relBase: string, depth: number) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const entryRel = relBase === '.' ? entry.name : `${relBase}/${entry.name}`;
      if (internalSecretsHandler.isSensitivePath(entryRel)) continue;

      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: entryRel, type: 'directory' });
        if (recursive && depth < maxDepth) {
          await walk(path.join(dir, entry.name), entryRel, depth + 1);
        }
      } else {
        let size = 0;
        try { size = (await fs.promises.stat(path.join(dir, entry.name))).size; } catch {}
        results.push({ name: entry.name, path: entryRel, type: 'file', size });
      }
      if (results.length >= 500) return;
    }
  };

  await walk(targetPath, cleaned, 1);

  return {
    tag: 'LIST_DIR',
    action: `Listed directory: ${cleaned}`,
    success: true,
    summary: `${results.length} entries in ${cleaned}`,
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

  const { cleaned, targetPath } = resolveWorkspacePath(args.dirPath || args.path || '.', 'list');
  const isRegex = Boolean(args.isRegex);
  const caseSensitive = Boolean(args.caseSensitive);
  const maxResults = Math.min(Math.max(Number(args.maxResults) || 60, 1), 200);
  const extFilter: string[] | null = Array.isArray(args.fileExtensions) && args.fileExtensions.length > 0
    ? args.fileExtensions.map((e: string) => String(e).toLowerCase())
    : null;

  let matcher: RegExp | null = null;
  if (isRegex) {
    matcher = new RegExp(queryText, caseSensitive ? '' : 'i');
  }

  const matches: Array<{ file: string; line: number; text: string }> = [];
  const qLower = queryText.toLowerCase();

  const walk = async (dir: string, relBase: string) => {
    if (matches.length >= maxResults) return;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (matches.length >= maxResults) break;
      if (IGNORED_DIRS.has(entry.name)) continue;
      const entryRel = relBase === '.' ? entry.name : `${relBase}/${entry.name}`;
      if (internalSecretsHandler.isSensitivePath(entryRel)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, entryRel);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (extFilter && !extFilter.includes(ext)) continue;
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.db', '.gz', '.zip', '.jar', '.apk', '.woff2'].includes(ext)) continue;

        let stat: fs.Stats;
        try { stat = await fs.promises.stat(fullPath); } catch { continue; }
        if (stat.size > 1_200_000) continue; // skip huge binaries

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
          matches.push({ file: cleaned, line: i + 1, text: internalSecretsHandler.redactText(lineText.trim().slice(0, 260)) });
        }
      });
    }
  }

  return {
    tag: 'SEARCH_CODE',
    action: `Searched "${queryText}" in ${cleaned}`,
    success: true,
    summary: `Found ${matches.length} match(es) for "${queryText}"`,
    output: { query: queryText, count: matches.length, totalMatches: matches.length, matches }
  };
}

export async function autonomyRunTerminalCommand(args: Record<string, any>): Promise<AutonomyResult> {
  const cmd = String(args.command || '').trim();
  if (!cmd) {
    return {
      tag: 'RUN_COMMAND',
      action: 'Run command',
      success: false,
      summary: 'Command string is required',
      output: { error: 'Command string is required' }
    };
  }

  // Block commands explicitly targeting protected secret storage or raw env dumps
  if (/(\.vault\.key|\.secrets\.vault\.enc|\bprintenv\b|\benv\b\s*($|\|)|\.env\b(?!\.example))/i.test(cmd)) {
    return {
      tag: 'RUN_COMMAND',
      action: `Blocked sensitive shell command`,
      success: false,
      summary: 'Command blocked by internal secrets handler protection policy.',
      output: { exitCode: 403, stdout: '', stderr: 'Blocked: direct shell inspection of secret files/env is prohibited.' }
    };
  }

  const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 30000, 1000), 60000);
  return new Promise((resolve) => {
    child_process.exec(cmd, { cwd: WORKSPACE_ROOT, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      const cleanStdout = internalSecretsHandler.redactText(stdout?.trim() || '');
      const cleanStderr = internalSecretsHandler.redactText(stderr?.trim() || '');
      resolve({
        tag: 'RUN_COMMAND',
        action: `Executed: ${internalSecretsHandler.redactText(cmd)}`,
        success: !err,
        summary: `Exit code ${exitCode}`,
        output: { exitCode, stdout: cleanStdout, stderr: cleanStderr }
      });
    });
  });
}

export async function autonomyRunLint(): Promise<AutonomyResult> {
  const tsc = await runTypeCheck();
  return {
    tag: 'RUN_LINT',
    action: 'TypeScript compiler check (tsc --noEmit)',
    success: tsc.clean,
    summary: tsc.clean ? '0 TypeScript errors' : 'TypeScript compiler errors reported',
    output: { clean: tsc.clean, diagnostics: tsc.diagnostics }
  };
}
