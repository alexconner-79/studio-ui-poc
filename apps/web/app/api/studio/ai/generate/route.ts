import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// System prompt that describes the spec schema for the LLM
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a UI specification generator for Studio UI. You generate valid JSON screen specifications.

A screen spec has this structure:
{
  "version": 1,
  "route": "/route-name",
  "meta": { "layout": "default" },
  "tree": { ... root node ... }
}

Each node has: id (string, unique), type (string), props (object, optional), children (array of nodes, optional).

Available node types:
- Layout: Stack (gap, padding, direction: "row"|"column"), Grid (columns, gap), Section (padding), ScrollArea (height), Spacer (size), Card (padding)
- Content: Heading (text, level: 1-6), Text (text, variant: "body"|"muted"), Image (src, alt, width, height), Input (placeholder, type, label), Link (href, text), Divider, List (items: string[], ordered: boolean)
- Components: Button (label, intent: "primary"|"secondary"|"destructive"|"outline"|"ghost"|"link", size: "default"|"xs"|"sm"|"lg"|"icon")
- Form (action, method), Modal (title, open), Tabs (tabs: {label, id}[]), Nav (items: {label, href}[], orientation), DataTable (columns: {key, label}[], rows: object[])

Token values for gap/padding/size: "xs", "sm", "md", "lg", "xl"

Container types (accept children): Stack, Grid, Section, ScrollArea, Card, Form, Modal, Tabs, Nav
Leaf types (no children): Spacer, Heading, Text, Image, Input, Link, Divider, List, Button, DataTable

Rules:
- Each node must have a unique id in the format: type_purpose (e.g. "heading_title", "stack_main")
- The root node should typically be a Stack with direction "column"
- Use semantic grouping with sections and cards
- Respond ONLY with valid JSON, no explanation, no markdown fences

Example:
{
  "version": 1,
  "route": "/login",
  "meta": { "layout": "default" },
  "tree": {
    "id": "root",
    "type": "Stack",
    "props": { "gap": "lg", "padding": "lg", "direction": "column" },
    "children": [
      { "id": "heading_title", "type": "Heading", "props": { "text": "Login", "level": 1 } },
      { "id": "input_email", "type": "Input", "props": { "label": "Email", "type": "email", "placeholder": "Enter your email" } },
      { "id": "input_password", "type": "Input", "props": { "label": "Password", "type": "password", "placeholder": "Enter your password" } },
      { "id": "button_submit", "type": "Button", "props": { "label": "Sign In", "intent": "primary" } }
    ]
  }
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AIProvider = "openai" | "anthropic";

function getProviderConfig(): { provider: AIProvider; apiKey: string; model: string } | null {
  const provider = (process.env.STUDIO_AI_PROVIDER ?? "openai") as AIProvider;
  const apiKey = process.env.STUDIO_AI_API_KEY ?? "";
  if (!apiKey) return null;

  const model = provider === "anthropic"
    ? (process.env.STUDIO_AI_MODEL ?? "claude-sonnet-4-20250514")
    : (process.env.STUDIO_AI_MODEL ?? "gpt-4o");

  return { provider, apiKey, model };
}

async function callOpenAI(apiKey: string, model: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, model: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
  return textBlock?.text ?? "";
}

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Try to find the first { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt as string;
    const screenName = body.screenName as string | undefined;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'prompt' field" },
        { status: 400 }
      );
    }

    const config = getProviderConfig();
    if (!config) {
      return NextResponse.json(
        { error: "AI is not configured. Set STUDIO_AI_PROVIDER and STUDIO_AI_API_KEY in .env.local" },
        { status: 503 }
      );
    }

    // Build the user prompt
    let userPrompt = `Generate a UI screen specification for: ${prompt.trim()}`;
    if (screenName) {
      userPrompt += `\nThe screen name is "${screenName}", use an appropriate route like "/${screenName}".`;
    }

    // Call the appropriate provider
    let rawResponse: string;
    if (config.provider === "anthropic") {
      rawResponse = await callAnthropic(config.apiKey, config.model, userPrompt);
    } else {
      rawResponse = await callOpenAI(config.apiKey, config.model, userPrompt);
    }

    // Parse the response
    const jsonStr = extractJSON(rawResponse);
    let spec;
    try {
      spec = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: rawResponse },
        { status: 502 }
      );
    }

    // Basic validation
    if (!spec.version || !spec.route || !spec.tree) {
      return NextResponse.json(
        { error: "AI returned an incomplete spec (missing version, route, or tree)", spec },
        { status: 502 }
      );
    }

    return NextResponse.json({ spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
