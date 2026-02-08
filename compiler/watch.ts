import * as fs from "node:fs";
import * as path from "node:path";
import chokidar from "chokidar";
import { compile } from "./compile";

const SPEC_GLOB = "spec/**/*.json";
const DEBOUNCE_MS = 150;
const POLL_MS = 1000;

let timer: NodeJS.Timeout | undefined;
let pollTimer: NodeJS.Timeout | undefined;
const lastStats = new Map<string, number>();

const logCompiledAt = () => {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  console.log(`Compiled at ${time}`);
};

const runCompile = (event?: string, filePath?: string) => {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(async () => {
    try {
      if (event && filePath) {
        console.log(`${event} ${filePath}`);
      }
      await compile();
      logCompiledAt();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`Compile failed: ${message}`);
    }
  }, DEBOUNCE_MS);
};

const listJsonFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
};

const startPollingFallback = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  const specRoot = path.resolve(process.cwd(), "spec");

  pollTimer = setInterval(() => {
    let files: string[] = [];
    try {
      files = listJsonFiles(specRoot);
    } catch {
      return;
    }

    for (const file of files) {
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(file).mtimeMs;
      } catch {
        continue;
      }

      const prev = lastStats.get(file);
      if (prev !== undefined && prev !== mtimeMs) {
        const relPath = path.relative(process.cwd(), file);
        runCompile("change", relPath);
      }
      lastStats.set(file, mtimeMs);
    }
  }, POLL_MS);
};

const start = async () => {
  console.log("Watching spec/**/*.json...");

  try {
    await compile();
    logCompiledAt();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`Compile failed: ${message}`);
  }

  chokidar
    .watch(SPEC_GLOB, {
      cwd: process.cwd(),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      usePolling: true,
      interval: 200,
      binaryInterval: 300,
      alwaysStat: true,
      atomic: false,
      followSymlinks: true,
    })
    .on("add", (filePath) => runCompile("add", filePath))
    .on("change", (filePath) => runCompile("change", filePath))
    .on("unlink", (filePath) => runCompile("unlink", filePath));

  startPollingFallback();
};

void start();
