/**
 * Incremental compilation cache for filesystem mode.
 *
 * Tracks the last-modified timestamp of each screen spec file.
 * Screens that haven't changed since the last compile are skipped,
 * reducing compile time proportionally to the number of unchanged screens.
 *
 * Cache is filesystem-only. Supabase mode compiles in-memory and is fast
 * enough that caching is not needed (permanent constraint, not planned for change).
 */

import * as fs from "node:fs";
import * as path from "node:path";

type CacheEntry = {
  /** fs.statSync().mtimeMs at the time this screen was last compiled */
  mtimeMs: number;
};

type CacheFile = Record<string, CacheEntry>;

const CACHE_FILENAME = ".compile-cache.json";

function getCachePath(rootDir: string): string {
  return path.join(rootDir, CACHE_FILENAME);
}

/** Load the existing cache, or return an empty object if it doesn't exist / is invalid */
export function loadCache(rootDir: string): CacheFile {
  const cachePath = getCachePath(rootDir);
  if (!fs.existsSync(cachePath)) return {};
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return {};
  }
}

/** Persist the cache to disk */
export function saveCache(rootDir: string, cache: CacheFile): void {
  const cachePath = getCachePath(rootDir);
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // Non-fatal: if we can't write the cache, compilation still succeeds
  }
}

/**
 * Filter a list of screen files, returning only those that have changed
 * since the last compile. Also returns the updated cache with current mtimes.
 */
export function filterChangedScreens(
  screensDir: string,
  screenFiles: string[],
  cache: CacheFile,
): {
  changedFiles: string[];
  updatedCache: CacheFile;
} {
  const updatedCache: CacheFile = { ...cache };
  const changedFiles: string[] = [];

  for (const file of screenFiles) {
    const fullPath = path.join(screensDir, file);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(fullPath).mtimeMs;
    } catch {
      // File may have been deleted; include it so the compiler handles the error
      changedFiles.push(file);
      continue;
    }

    const cached = cache[file];
    if (!cached || cached.mtimeMs !== mtimeMs) {
      changedFiles.push(file);
    }

    updatedCache[file] = { mtimeMs };
  }

  // Remove cache entries for files that no longer exist
  for (const key of Object.keys(updatedCache)) {
    if (!screenFiles.includes(key)) {
      delete updatedCache[key];
    }
  }

  return { changedFiles, updatedCache };
}
