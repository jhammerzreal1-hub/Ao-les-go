import fs from 'fs';
import path from 'path';
import type { SovereignQuantumKernel } from '../utils/sovereignQuantumKernel';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kernel_production.db');

let activeDb: any = null;

export async function initKernelSqliteBridge(kernel: SovereignQuantumKernel): Promise<any> {
  if (activeDb) return activeDb;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Dynamic import avoids bundler/type errors and works natively on Node 22+
    const sqliteMod: any = await import('node:sqlite' as any);
    const DatabaseSync = sqliteMod?.DatabaseSync;
    if (!DatabaseSync) return null;

    const db = new DatabaseSync(DB_FILE);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS trajectories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        step INTEGER NOT NULL,
        axiom TEXT NOT NULL,
        entropy REAL NOT NULL,
        confidence REAL NOT NULL,
        quantum_signature TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS kernel_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agentic_memory (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS evolutive_axioms (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        principle TEXT NOT NULL,
        context TEXT NOT NULL,
        origin_turn TEXT,
        weight REAL DEFAULT 1.0,
        evolution_count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS dream_cycles (
        id TEXT PRIMARY KEY,
        trigger_source TEXT NOT NULL,
        memories_replayed INTEGER DEFAULT 0,
        axioms_evolved INTEGER DEFAULT 0,
        tools_audited INTEGER DEFAULT 0,
        healing_applied INTEGER DEFAULT 0,
        summary TEXT NOT NULL,
        insights_json TEXT,
        proof_hash TEXT NOT NULL,
        elapsed_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    activeDb = db;
    kernel.attachServerDb(db);
    console.info(`[SQLITE] Connected persistent kernel database: ${DB_FILE}`);
    return db;
  } catch (err: any) {
    console.warn('[SQLITE] Falling back to in-memory/JSON kernel store:', err?.message || err);
    return null;
  }
}

export function getKernelDb(): any {
  return activeDb;
}
