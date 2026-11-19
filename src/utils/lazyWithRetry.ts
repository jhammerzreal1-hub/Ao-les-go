import React, { lazy } from 'react';

const RELOAD_GUARD_KEY = 'sovereign_os_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 15000;

export function isDynamicImportError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to load module script')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resilient React.lazy wrapper that retries transient dynamic import failures
 * (e.g. during dev server restarts, hot-swapped module reloads, or Cloud Run proxy blips)
 * instead of letting React.lazy permanently cache a single failed Promise.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  moduleLabel?: string,
  maxRetries = 3
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [350, 900, 1800];
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (!isDynamicImportError(err) || attempt === maxRetries) {
          break;
        }
        const waitMs = delays[attempt] ?? 1500;
        console.warn(
          `[OS Module Loader] Transient import retry ${attempt + 1}/${maxRetries} for ${moduleLabel || 'module'} in ${waitMs}ms...`
        );
        await sleep(waitMs);
      }
    }

    // If all retries failed due to stale dev/chunk URLs after a server restart, do a single safe reload
    if (typeof window !== 'undefined' && isDynamicImportError(lastError)) {
      try {
        const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
        const now = Date.now();
        if (!Number.isFinite(lastReload) || now - lastReload > RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
          console.warn(`[OS Module Loader] Refreshing session once to sync updated module graph (${moduleLabel || 'module'}).`);
          window.location.reload();
          // Keep Suspense pending while browser reloads so ErrorBoundary never flashes
          return new Promise<{ default: T }>(() => {});
        }
      } catch {
        // sessionStorage blocked — fall through to ErrorBoundary with Retry button
      }
    }

    throw lastError;
  });
}
