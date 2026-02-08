import * as fs from "node:fs";
import * as path from "node:path";
import * as prettier from "prettier";

import { readSpec } from "./readSpec";
import { validateSpec } from "./validate";
import { emitHome } from "./emitters/home";

type EmittedFile = { path: string; contents: string };

function ensureDirForFile(absFilePath: string) {
  const dir = path.dirname(absFilePath);
  fs.mkdirSync(dir, { recursive: true });
}

async function formatWithPrettier(contents: string, absFilePath: string) {
  const config = (await prettier.resolveConfig(process.cwd())) ?? {};
  const isTsx = absFilePath.endsWith(".tsx");
  const isTs = absFilePath.endsWith(".ts");
  const parser = isTsx || isTs ? "typescript" : undefined;
  return prettier.format(contents, {
    ...config,
    filepath: absFilePath,
    ...(parser ? { parser } : {}),
  });
}

export async function compile(options?: { write?: boolean }) {
  const spec = readSpec();
  validateSpec(spec);

  const files: EmittedFile[] = emitHome(spec);
  const shouldWrite = options?.write !== false;

  const formattedFiles: EmittedFile[] = [];

  for (const file of files) {
    const absPath = path.resolve(process.cwd(), file.path);
    const formatted = await formatWithPrettier(file.contents, absPath);
    formattedFiles.push({ path: file.path, contents: formatted });

    if (shouldWrite) {
      ensureDirForFile(absPath);
      fs.writeFileSync(absPath, formatted, "utf8");
      console.log(`Generated: ${file.path}`);
    }
  }

  return formattedFiles;
}

// Allow `ts-node compiler/compile.ts`
if (require.main === module) {
  compile().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
