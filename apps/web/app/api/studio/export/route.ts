import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import archiver from "archiver";
import { Readable } from "node:stream";

const ROOT_DIR = path.resolve(process.cwd(), "../..");

// Files/dirs to include in a project zip
const ZIP_ENTRIES = [
  "apps/web/app",
  "apps/web/components/generated",
  "spec",
  "tokens",
  "package.json",
  "tailwind.config.ts",
  "tsconfig.json",
];

function addDirectoryToArchive(
  archive: archiver.Archiver,
  dirPath: string,
  archivePath: string
) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryArchivePath = path.join(archivePath, entry.name);
    if (entry.isDirectory()) {
      addDirectoryToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath });
    }
  }
}

function generateDockerfile(): string {
  return `FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`;
}

function generateDockerCompose(): string {
  return `version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
`;
}

function generateVercelConfig(): string {
  return JSON.stringify(
    {
      framework: "nextjs",
      buildCommand: "pnpm build",
      outputDirectory: ".next",
    },
    null,
    2
  );
}

export async function POST(request: Request) {
  try {
    const { format } = await request.json();

    if (format === "zip" || format === "docker") {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      // Collect archive data into memory
      const streamPromise = new Promise<Buffer>((resolve, reject) => {
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);
      });

      // Add project files
      for (const entry of ZIP_ENTRIES) {
        const fullPath = path.resolve(ROOT_DIR, entry);
        if (!fs.existsSync(fullPath)) continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addDirectoryToArchive(archive, fullPath, entry);
        } else {
          archive.file(fullPath, { name: entry });
        }
      }

      // Docker format: add Dockerfile and docker-compose.yml
      if (format === "docker") {
        archive.append(generateDockerfile(), { name: "Dockerfile" });
        archive.append(generateDockerCompose(), { name: "docker-compose.yml" });
      }

      await archive.finalize();
      const buffer = await streamPromise;

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="studio-project${format === "docker" ? "-docker" : ""}.zip"`,
        },
      });
    }

    if (format === "vercel") {
      // Return Vercel config files for manual deploy
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      const streamPromise = new Promise<Buffer>((resolve, reject) => {
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);
      });

      for (const entry of ZIP_ENTRIES) {
        const fullPath = path.resolve(ROOT_DIR, entry);
        if (!fs.existsSync(fullPath)) continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addDirectoryToArchive(archive, fullPath, entry);
        } else {
          archive.file(fullPath, { name: entry });
        }
      }

      archive.append(generateVercelConfig(), { name: "vercel.json" });
      await archive.finalize();
      const buffer = await streamPromise;

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="studio-project-vercel.zip"',
        },
      });
    }

    if (format === "expo") {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      const streamPromise = new Promise<Buffer>((resolve, reject) => {
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);
      });

      // Include spec and tokens
      for (const entry of ["spec", "tokens"]) {
        const fullPath = path.resolve(ROOT_DIR, entry);
        if (!fs.existsSync(fullPath)) continue;
        addDirectoryToArchive(archive, fullPath, entry);
      }

      // Add generated components (from Expo emitter)
      const genDir = path.resolve(ROOT_DIR, "apps/web/components/generated");
      if (fs.existsSync(genDir)) {
        addDirectoryToArchive(archive, genDir, "src/screens");
      }

      // Add Expo boilerplate files
      const appJson = JSON.stringify({
        expo: {
          name: "studio-project",
          slug: "studio-project",
          version: "1.0.0",
          orientation: "portrait",
          sdkVersion: "52.0.0",
          platforms: ["ios", "android", "web"],
          ios: { bundleIdentifier: "com.studio.project" },
          android: { package: "com.studio.project" },
        },
      }, null, 2);

      const packageJson = JSON.stringify({
        name: "studio-project",
        version: "1.0.0",
        main: "node_modules/expo/AppEntry.js",
        scripts: {
          start: "expo start",
          android: "expo start --android",
          ios: "expo start --ios",
          web: "expo start --web",
        },
        dependencies: {
          expo: "~52.0.0",
          "expo-status-bar": "~2.0.0",
          react: "18.3.1",
          "react-native": "0.76.0",
        },
        devDependencies: {
          "@types/react": "~18.3.0",
          typescript: "~5.3.0",
        },
      }, null, 2);

      const appTsx = `import React from "react";
import { SafeAreaView, StatusBar } from "react-native";

// Import your generated screens
// import { Home } from "./src/screens/Home.generated";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {/* <Home /> */}
    </SafeAreaView>
  );
}
`;

      archive.append(appJson, { name: "app.json" });
      archive.append(packageJson, { name: "package.json" });
      archive.append(appTsx, { name: "App.tsx" });
      archive.append('{ "compilerOptions": { "strict": true, "jsx": "react-native" } }', { name: "tsconfig.json" });

      await archive.finalize();
      const buffer = await streamPromise;

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="studio-project-expo.zip"',
        },
      });
    }

    if (format === "github") {
      // Return instructions and a pre-formatted push script
      const repoName = "studio-project";
      const script = `#!/bin/bash
# Initialize a new repo and push
git init
git add .
git commit -m "Initial commit from Studio UI"
gh repo create ${repoName} --public --source=. --push
`;
      return NextResponse.json({
        message: "GitHub export ready. Unzip the project and run the script below, or push manually.",
        script,
        instructions: [
          "1. Download the project zip first (use 'zip' format)",
          "2. Unzip it to a folder",
          "3. Run the script above, or manually git init + push",
          "4. Make sure you have 'gh' CLI installed and authenticated",
        ],
      });
    }

    return NextResponse.json(
      { error: "format must be one of: zip, expo, docker, vercel, github" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
