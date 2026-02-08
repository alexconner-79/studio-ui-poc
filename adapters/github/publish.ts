import * as fs from "node:fs";
import * as path from "node:path";
import simpleGit from "simple-git";

export type PublishMode = "dry-run" | "commit-only" | "pr";

export type EmittedFile = {
  path: string;
  contents: string;
};

export type PublishParams = {
  repoPath: string;
  baseBranch?: string;
  headBranch: string;
  title: string;
  body?: string;
  mode: PublishMode;
  files: EmittedFile[];
  deletedPaths?: string[];
};

export type PublishSummary = {
  created: number;
  modified: number;
  deleted: number;
  paths: string[];
  diff: string;
};

const normalizeNewlines = (value: string): string =>
  value.replace(/\r\n/g, "\n");

const splitLines = (value: string): string[] => {
  const normalized = normalizeNewlines(value);
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};

const formatUnifiedDiff = (
  filePath: string,
  oldText: string | null,
  newText: string | null
): string => {
  const oldLines = oldText === null ? [] : splitLines(oldText);
  const newLines = newText === null ? [] : splitLines(newText);
  const oldCount = oldLines.length;
  const newCount = newLines.length;

  const header = [
    `diff --git a/${filePath} b/${filePath}`,
    oldText === null ? "new file mode 100644" : null,
    newText === null ? "deleted file mode 100644" : null,
    `--- ${oldText === null ? "/dev/null" : `a/${filePath}`}`,
    `+++ ${newText === null ? "/dev/null" : `b/${filePath}`}`,
    `@@ -1,${oldCount} +1,${newCount} @@`,
  ]
    .filter(Boolean)
    .join("\n");

  const removed = oldLines.map((line) => `-${line}`).join("\n");
  const added = newLines.map((line) => `+${line}`).join("\n");
  const body = [removed, added].filter((part) => part.length > 0).join("\n");
  return `${header}\n${body}\n`;
};

const readFileIfExists = (absPath: string): string | null => {
  if (!fs.existsSync(absPath)) {
    return null;
  }
  return fs.readFileSync(absPath, "utf8");
};

export async function publishToGitHub(
  params: PublishParams
): Promise<PublishSummary> {
  const baseBranch = params.baseBranch ?? "main";
  const deletedPaths = params.deletedPaths ?? [];
  const diffChunks: string[] = [];
  const changedPaths: string[] = [];
  let created = 0;
  let modified = 0;
  let deleted = 0;

  for (const file of params.files) {
    const absPath = path.resolve(params.repoPath, file.path);
    const existing = readFileIfExists(absPath);
    if (existing === null) {
      created += 1;
      diffChunks.push(formatUnifiedDiff(file.path, null, file.contents));
      changedPaths.push(file.path);
      continue;
    }

    if (normalizeNewlines(existing) === normalizeNewlines(file.contents)) {
      continue;
    }

    modified += 1;
    diffChunks.push(formatUnifiedDiff(file.path, existing, file.contents));
    changedPaths.push(file.path);
  }

  for (const deletedPath of deletedPaths) {
    const absPath = path.resolve(params.repoPath, deletedPath);
    const existing = readFileIfExists(absPath);
    if (existing === null) {
      continue;
    }
    deleted += 1;
    diffChunks.push(formatUnifiedDiff(deletedPath, existing, null));
    changedPaths.push(deletedPath);
  }

  if (params.mode === "commit-only") {
    const git = simpleGit(params.repoPath);
    const status = await git.status();
    if (!status.isClean()) {
      throw new Error("Working tree is not clean. Commit or stash changes.");
    }

    const branches = await git.branchLocal();
    if (!branches.all.includes(baseBranch)) {
      throw new Error(`Base branch "${baseBranch}" does not exist locally.`);
    }

    await git.checkout(baseBranch);
    if (branches.all.includes(params.headBranch)) {
      await git.checkout(params.headBranch);
    } else {
      await git.checkoutLocalBranch(params.headBranch);
    }

    for (const file of params.files) {
      const absPath = path.resolve(params.repoPath, file.path);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, file.contents, "utf8");
    }

    for (const deletedPath of deletedPaths) {
      const absPath = path.resolve(params.repoPath, deletedPath);
      if (fs.existsSync(absPath)) {
        fs.rmSync(absPath);
      }
    }

    const pathsToStage = [
      ...params.files.map((file) => file.path),
      ...deletedPaths,
    ];
    if (pathsToStage.length > 0) {
      await git.add(pathsToStage);
    }
    await git.commit("chore(studio): regenerate UI");
    const commitHash = await git.revparse(["HEAD"]);
    console.log(`Branch: ${params.headBranch}`);
    console.log(`Commit: ${commitHash}`);
  }

  return {
    created,
    modified,
    deleted,
    paths: changedPaths,
    diff: diffChunks.join("\n"),
  };
}
