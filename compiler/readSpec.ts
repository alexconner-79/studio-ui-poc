import * as fs from "node:fs";
import * as path from "node:path";
import type { ScreenSpec } from "./types";

const SPEC_PATH = path.resolve(process.cwd(), "spec", "screens", "home.json");

export function readSpec(): ScreenSpec {
  let raw: string;

  try {
    raw = fs.readFileSync(SPEC_PATH, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`Spec file not found at ${SPEC_PATH}`);
    }
    throw new Error(`Failed to read spec file at ${SPEC_PATH}`);
  }

  try {
    return JSON.parse(raw) as ScreenSpec;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid JSON in spec file at ${SPEC_PATH}: ${message}`);
  }
}
