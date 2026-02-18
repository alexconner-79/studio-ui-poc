#!/usr/bin/env node

import prompts from "prompts";
import path from "path";
import fs from "fs";

const TEMPLATES_DIR = path.resolve(__dirname, "..", "templates");

interface ProjectOptions {
  name: string;
  framework: "nextjs" | "vue" | "svelte" | "html" | "expo";
  includeSamples: boolean;
  includeSupabase: boolean;
}

async function main() {
  console.log("\n  Studio UI - Create a new project\n");

  const nameArg = process.argv[2];

  const response = await prompts(
    [
      {
        type: nameArg ? null : "text",
        name: "name",
        message: "Project name:",
        initial: "my-studio-app",
        validate: (v: string) => (v.trim().length > 0 ? true : "Name is required"),
      },
      {
        type: "select",
        name: "framework",
        message: "Framework:",
        choices: [
          { title: "Next.js (Web)", value: "nextjs" },
          { title: "Vue (Web)", value: "vue" },
          { title: "Svelte (Web)", value: "svelte" },
          { title: "HTML/CSS (Static)", value: "html" },
          { title: "Expo (React Native)", value: "expo" },
        ],
      },
      {
        type: "confirm",
        name: "includeSamples",
        message: "Include sample screens?",
        initial: true,
      },
      {
        type: "confirm",
        name: "includeSupabase",
        message: "Include Supabase auth setup?",
        initial: false,
      },
    ],
    { onCancel: () => process.exit(0) }
  );

  const opts: ProjectOptions = {
    name: nameArg || response.name,
    framework: response.framework,
    includeSamples: response.includeSamples,
    includeSupabase: response.includeSupabase,
  };

  const targetDir = path.resolve(process.cwd(), opts.name);

  if (fs.existsSync(targetDir)) {
    console.error(`\n  Error: Directory "${opts.name}" already exists.\n`);
    process.exit(1);
  }

  console.log(`\n  Creating project in ${targetDir}...\n`);
  fs.mkdirSync(targetDir, { recursive: true });

  writeStudioConfig(targetDir, opts);
  writePackageJson(targetDir, opts);
  writeTsconfig(targetDir);
  writeGitignore(targetDir);
  writeSpecDirs(targetDir, opts);

  if (opts.includeSupabase) {
    writeEnvExample(targetDir);
  }

  console.log("  Done! Next steps:\n");
  console.log(`    cd ${opts.name}`);
  console.log("    npm install");
  if (opts.includeSupabase) {
    console.log("    # Copy .env.local.example to .env.local and fill in Supabase credentials");
  }
  console.log("    npm run dev\n");
}

function writeStudioConfig(dir: string, opts: ProjectOptions) {
  const appDirs: Record<string, string> = {
    nextjs: "app", vue: "src/pages", svelte: "src/routes", html: "public", expo: "src/screens",
  };
  const aliases: Record<string, string> = {
    nextjs: "@/", vue: "@/", svelte: "$lib/", html: "./", expo: "./",
  };
  const config = {
    framework: opts.framework,
    appDir: appDirs[opts.framework] || "app",
    componentsDir: "components",
    generatedDir: "components/generated",
    screensDir: "spec/screens",
    schemaPath: "spec/schema/screen.schema.json",
    importAlias: aliases[opts.framework] || "@/",
    fonts: [],
  };
  fs.writeFileSync(path.join(dir, "studio.config.json"), JSON.stringify(config, null, 2) + "\n");
}

function writePackageJson(dir: string, opts: ProjectOptions) {
  const base: Record<string, unknown> = {
    name: opts.name,
    version: "0.1.0",
    private: true,
    scripts: {} as Record<string, string>,
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
  };

  const scripts = base.scripts as Record<string, string>;
  const deps = base.dependencies as Record<string, string>;
  const devDeps = base.devDependencies as Record<string, string>;

  switch (opts.framework) {
    case "nextjs":
      scripts.dev = "next dev";
      scripts.build = "next build";
      scripts.start = "next start";
      deps.next = "^15.0.0";
      deps.react = "^19.0.0";
      deps["react-dom"] = "^19.0.0";
      deps["tailwind-merge"] = "^3.0.0";
      deps["lucide-react"] = "^0.500.0";
      devDeps.typescript = "^5";
      devDeps.tailwindcss = "^4";
      devDeps["@types/react"] = "^19";
      break;
    case "vue":
      scripts.dev = "vite dev";
      scripts.build = "vite build";
      deps.vue = "^3.5.0";
      deps["vue-router"] = "^4.5.0";
      devDeps["@vitejs/plugin-vue"] = "^5.0.0";
      devDeps.vite = "^6.0.0";
      devDeps.typescript = "^5";
      break;
    case "svelte":
      scripts.dev = "vite dev";
      scripts.build = "vite build";
      deps.svelte = "^5.0.0";
      devDeps["@sveltejs/vite-plugin-svelte"] = "^4.0.0";
      devDeps.vite = "^6.0.0";
      devDeps.typescript = "^5";
      break;
    case "html":
      scripts.dev = "npx serve public";
      scripts.build = "echo 'Static HTML -- no build needed'";
      break;
    case "expo":
      scripts.start = "expo start";
      scripts.android = "expo run:android";
      scripts.ios = "expo run:ios";
      deps.expo = "~52.0.0";
      deps.react = "^19.0.0";
      deps["react-native"] = "~0.77.0";
      devDeps.typescript = "^5";
      devDeps["@types/react"] = "^19";
      break;
  }

  if (opts.includeSupabase) {
    (base.dependencies as Record<string, string>)["@supabase/supabase-js"] = "^2.95.0";
    (base.dependencies as Record<string, string>)["@supabase/ssr"] = "^0.8.0";
  }

  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(base, null, 2) + "\n");
}

function writeTsconfig(dir: string) {
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      paths: { "@/*": ["./*"] },
    },
    include: ["**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  };
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");
}

function writeGitignore(dir: string) {
  fs.writeFileSync(
    path.join(dir, ".gitignore"),
    ["node_modules", ".next", ".env.local", "dist", ".turbo", ""].join("\n")
  );
}

function writeSpecDirs(dir: string, opts: ProjectOptions) {
  const screensDir = path.join(dir, "spec", "screens");
  const tokensDir = path.join(dir, "tokens");
  fs.mkdirSync(screensDir, { recursive: true });
  fs.mkdirSync(tokensDir, { recursive: true });

  // Default tokens
  const tokens = {
    spacing: {
      xs: { value: "4px" },
      sm: { value: "8px" },
      md: { value: "16px" },
      lg: { value: "24px" },
      xl: { value: "32px" },
    },
    color: {
      primary: { value: "#2563eb" },
      secondary: { value: "#64748b" },
      background: { value: "#ffffff" },
      foreground: { value: "#0f172a" },
    },
    borderRadius: {
      sm: { value: "4px" },
      md: { value: "8px" },
      lg: { value: "12px" },
      full: { value: "9999px" },
    },
  };
  fs.writeFileSync(path.join(tokensDir, "design-tokens.json"), JSON.stringify(tokens, null, 2) + "\n");

  if (opts.includeSamples) {
    const sampleScreen = {
      version: 1,
      route: "/",
      tree: {
        id: "root",
        type: "Stack",
        props: { direction: "column", gap: "lg", padding: "lg" },
        children: [
          {
            id: "heading",
            type: "Heading",
            props: { text: `Welcome to ${opts.name}`, level: 1, variant: "hero" },
          },
          {
            id: "description",
            type: "Text",
            props: { text: "Built with Studio UI. Open the editor to start designing.", variant: "muted" },
          },
          {
            id: "cta",
            type: "Button",
            props: { label: "Get Started", variant: "primary" },
          },
        ],
      },
    };
    fs.writeFileSync(path.join(screensDir, "home.screen.json"), JSON.stringify(sampleScreen, null, 2) + "\n");
  }

  // Copy bundled template files if they exist
  const frameworkTemplate = path.join(TEMPLATES_DIR, opts.framework);
  if (fs.existsSync(frameworkTemplate)) {
    copyDirRecursive(frameworkTemplate, dir);
  }
}

function writeEnvExample(dir: string) {
  fs.writeFileSync(
    path.join(dir, ".env.local.example"),
    [
      "# Supabase credentials -- https://supabase.com/dashboard/project/_/settings/api",
      "NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY",
      "",
    ].join("\n")
  );
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
