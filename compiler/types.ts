export type Gap = "xs" | "sm" | "md" | "lg" | "xl";

export type ScreenSpec = {
  id: string;
  layout: "stack";
  gap?: Gap;
  children: Node[];
};

export type Node =
  | { type: "stack"; gap?: Gap; children: Node[] }
  | { type: "heading"; text: string; variant?: "heading" }
  | { type: "text"; text: string; variant?: "body" | "muted" }
  | { type: "card"; children: Node[] }
  | { type: "button"; label: string; intent?: "primary" };
