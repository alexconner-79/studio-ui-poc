import type { ScreenSpec } from "../types";
import type { StudioConfig } from "../config";

/**
 * A single file emitted by the compiler.
 */
export type EmittedFile = {
  path: string;
  contents: string;
};

/**
 * Result of emitting a single screen.
 */
export type EmitScreenResult = {
  files: EmittedFile[];
  componentName: string;
};

/**
 * Emitter interface -- each target framework implements this.
 */
export interface Emitter {
  /** Human-readable name for logging. */
  name: string;

  /** Emit the files for a single screen spec. */
  emitScreen(spec: ScreenSpec, config: StudioConfig): EmitScreenResult;

  /** Emit a barrel index re-exporting all generated components. */
  emitBarrelIndex(componentNames: string[], config: StudioConfig): EmittedFile;
}
