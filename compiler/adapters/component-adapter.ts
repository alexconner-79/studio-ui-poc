/**
 * Component library adapter interface.
 *
 * Maps logical component names (Button, Card, Input) to library-specific
 * imports and prop transformations. This decouples the emitters from any
 * specific component library.
 */

export type ImportSpec = {
  specifier: string;
  source: string;
  isDefault?: boolean;
};

export type PropTransform = {
  /** Rename a spec prop to the component's expected prop name. */
  rename?: Record<string, string>;
  /** Map spec prop values to component-specific values. */
  valueMap?: Record<string, Record<string, string>>;
};

export interface ComponentAdapter {
  /** Human-readable name for logging. */
  name: string;

  /**
   * Resolve the import for a component type.
   * Returns null if the type is not handled by this adapter.
   */
  resolveImport(
    nodeType: string,
    importAlias: string
  ): ImportSpec | null;

  /**
   * Transform spec props into the component library's prop names/values.
   * Returns the transformed props object.
   */
  transformProps(
    nodeType: string,
    props: Record<string, unknown>
  ): Record<string, unknown>;

  /**
   * Get the JSX tag name for a component type.
   * Returns null to use the default (the type name itself).
   */
  getTagName(nodeType: string): string | null;
}
