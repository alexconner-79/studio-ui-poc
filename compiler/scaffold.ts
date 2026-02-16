/**
 * Spec scaffolding CLI -- creates new screen spec files from a template.
 *
 * Usage: ts-node compiler/scaffold.ts add screen <name>
 *   e.g. pnpm studio add screen checkout
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, resolveFromRoot } from "./config";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/** Convert a kebab/snake-cased name to Title Case for the heading text. */
function toTitleCase(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Build the route from the screen name. */
function toRoute(name: string): string {
  // Normalise to kebab-case
  const slug = name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
  return `/${slug}`;
}

// -------------------------------------------------------------------------
// Template
// -------------------------------------------------------------------------

function buildTemplate(name: string): string {
  const route = toRoute(name);
  const title = toTitleCase(name);

  const spec = {
    version: 1,
    route,
    meta: { layout: "default", auth: "public" },
    tree: {
      id: "root",
      type: "Stack",
      props: { gap: "md", padding: "lg" },
      children: [
        {
          id: "heading_1",
          type: "Heading",
          props: { text: title },
        },
      ],
    },
  };

  return JSON.stringify(spec, null, 2) + "\n";
}

// -------------------------------------------------------------------------
// Command handling
// -------------------------------------------------------------------------

function printUsage(): void {
  console.log("Usage: pnpm studio add screen <name>");
  console.log("");
  console.log("Examples:");
  console.log("  pnpm studio add screen checkout");
  console.log("  pnpm studio add screen user-profile");
  console.log("  pnpm studio add screen settings");
}

function addScreen(name: string): void {
  if (!name || name.trim().length === 0) {
    console.error("Error: Screen name is required.\n");
    printUsage();
    process.exit(1);
  }

  // Validate name format
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    console.error(
      `Error: Invalid screen name "${name}". Use letters, numbers, hyphens, or underscores.`
    );
    process.exit(1);
  }

  const config = loadConfig();
  const screensDir = resolveFromRoot(config.screensDir);
  const fileName = `${name}.screen.json`;
  const filePath = path.join(screensDir, fileName);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.error(`Error: ${fileName} already exists at ${filePath}`);
    process.exit(1);
  }

  // Ensure screens directory exists
  fs.mkdirSync(screensDir, { recursive: true });

  // Write the template
  const contents = buildTemplate(name);
  fs.writeFileSync(filePath, contents, "utf8");

  const relPath = path.relative(process.cwd(), filePath);
  console.log(`Created ${relPath}`);
  console.log(`  route: ${toRoute(name)}`);
  console.log(`\nRun \`pnpm compile\` to generate the component.`);
}

// -------------------------------------------------------------------------
// CLI entry point
// -------------------------------------------------------------------------

function main(): void {
  // pnpm studio add screen <name>
  // argv: [node, scaffold.ts, add, screen, <name>]
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  if (args[0] === "add" && args[1] === "screen") {
    const name = args[2];
    addScreen(name);
    return;
  }

  console.error(`Unknown command: ${args.join(" ")}\n`);
  printUsage();
  process.exit(1);
}

if (require.main === module) {
  main();
}

export { addScreen, buildTemplate };
