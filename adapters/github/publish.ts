import * as fs from "node:fs";
import * as path from "node:path";
import { Octokit } from "@octokit/rest";
import simpleGit, { type SimpleGit } from "simple-git";

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
  prUrl?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Parse owner and repo from a git remote URL.
 * Supports SSH (git@github.com:owner/repo.git) and
 * HTTPS (https://github.com/owner/repo.git) formats.
 */
const parseOwnerRepo = (
  remoteUrl: string
): { owner: string; repo: string } => {
  const cleaned = remoteUrl.trim();

  // SSH: git@github.com:owner/repo.git
  const sshMatch = cleaned.match(/git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = cleaned.match(
    /https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  throw new Error(
    `Unable to parse owner/repo from remote URL: "${cleaned}". ` +
      "Expected SSH (git@github.com:owner/repo.git) or " +
      "HTTPS (https://github.com/owner/repo.git) format."
  );
};

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a git push call with clear error messages for common failure modes.
 */
async function safePush(
  git: SimpleGit,
  remote: string,
  branch: string
): Promise<void> {
  try {
    await git.push(remote, branch, ["--set-upstream"]);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);

    if (
      message.includes("Authentication failed") ||
      message.includes("could not read Username") ||
      message.includes("invalid credentials")
    ) {
      throw new Error(
        "Push failed: authentication error. " +
          "Verify that GITHUB_TOKEN has write access to the repository."
      );
    }

    if (
      message.includes("protected branch") ||
      message.includes("required status check")
    ) {
      throw new Error(
        `Push failed: branch protection rules prevented the push to "${branch}". ` +
          "Check the repository's branch protection settings."
      );
    }

    if (
      message.includes("Permission") ||
      message.includes("permission") ||
      message.includes("denied") ||
      message.includes("403")
    ) {
      throw new Error(
        "Push failed: insufficient permissions. " +
          "Ensure your token has the 'repo' scope and you have write access."
      );
    }

    if (
      message.includes("Could not resolve host") ||
      message.includes("unable to access") ||
      message.includes("Network is unreachable") ||
      message.includes("Connection refused")
    ) {
      throw new Error(
        "Push failed: network error. " +
          "Check your internet connection and that the remote URL is correct."
      );
    }

    throw new Error(`Push failed: ${message}`);
  }
}

/**
 * Type guard for Octokit-style errors that carry an HTTP status code.
 */
function isHttpError(
  err: unknown
): err is Error & { status: number; response?: { headers?: Record<string, string> } } {
  return (
    err instanceof Error &&
    typeof (err as unknown as Record<string, unknown>).status === "number"
  );
}

/**
 * Extract a clear error message from an Octokit / HTTP error.
 */
function formatApiError(err: unknown, action: string): Error {
  if (isHttpError(err)) {
    const status = err.status;

    if (status === 401) {
      return new Error(
        `GitHub API ${action} failed: bad credentials (401). ` +
          "Verify that GITHUB_TOKEN is valid and not expired."
      );
    }

    if (status === 403) {
      const headers = err.response?.headers;
      const rateLimitRemaining = headers?.["x-ratelimit-remaining"];
      const rateLimitReset = headers?.["x-ratelimit-reset"];

      if (rateLimitRemaining === "0" && rateLimitReset) {
        const resetDate = new Date(Number(rateLimitReset) * 1000);
        return new Error(
          `GitHub API ${action} failed: rate limit exceeded (403). ` +
            `Limit resets at ${resetDate.toISOString()}. Wait and retry.`
        );
      }

      return new Error(
        `GitHub API ${action} failed: forbidden (403). ` +
          "Ensure your token has the 'repo' scope."
      );
    }

    if (status === 404) {
      return new Error(
        `GitHub API ${action} failed: repository not found (404). ` +
          "Verify the origin remote URL points to an existing GitHub repository " +
          "and your token has access to it."
      );
    }

    if (status === 422) {
      const detail = err.message || "validation failed";
      return new Error(
        `GitHub API ${action} failed: ${detail} (422). ` +
          "This usually means the head branch doesn't exist on the remote or " +
          "the base branch is invalid."
      );
    }

    return new Error(
      `GitHub API ${action} failed: ${err.message} (${status}).`
    );
  }

  if (err instanceof Error) {
    if (
      err.message.includes("ENOTFOUND") ||
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("fetch failed")
    ) {
      return new Error(
        `GitHub API ${action} failed: network error. ` +
          "Check your internet connection."
      );
    }

    return new Error(`GitHub API ${action} failed: ${err.message}`);
  }

  return new Error(`GitHub API ${action} failed: ${String(err)}`);
}

// ---------------------------------------------------------------------------
// Shared commit logic (used by commit-only and pr modes)
// ---------------------------------------------------------------------------

async function commitFiles(
  git: SimpleGit,
  params: PublishParams,
  baseBranch: string,
  deletedPaths: string[]
): Promise<string> {
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
  return commitHash;
}

// ---------------------------------------------------------------------------
// Main publish function
// ---------------------------------------------------------------------------

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

  // -- dry-run: nothing to write ----------------------------------------
  if (params.mode === "dry-run") {
    return {
      created,
      modified,
      deleted,
      paths: changedPaths,
      diff: diffChunks.join("\n"),
    };
  }

  // -- commit-only: branch + commit locally -----------------------------
  if (params.mode === "commit-only") {
    const git = simpleGit(params.repoPath);
    const commitHash = await commitFiles(git, params, baseBranch, deletedPaths);
    console.log(`Branch: ${params.headBranch}`);
    console.log(`Commit: ${commitHash}`);
    return {
      created,
      modified,
      deleted,
      paths: changedPaths,
      diff: diffChunks.join("\n"),
    };
  }

  // -- pr: branch + commit + push + open PR -----------------------------
  if (params.mode === "pr") {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN is not set. " +
          "Create a Personal Access Token with repo scope and set it as an environment variable."
      );
    }

    const git = simpleGit(params.repoPath);

    // Resolve origin remote
    let remoteUrl: string;
    try {
      remoteUrl = await git.remote(["get-url", "origin"]) as string;
    } catch {
      throw new Error(
        "No origin remote configured. " +
          'Add one with: git remote add origin <url>'
      );
    }

    if (!remoteUrl || remoteUrl.trim().length === 0) {
      throw new Error(
        "No origin remote configured. " +
          'Add one with: git remote add origin <url>'
      );
    }

    const { owner, repo } = parseOwnerRepo(remoteUrl);

    // Branch + commit
    const commitHash = await commitFiles(git, params, baseBranch, deletedPaths);
    console.log(`Branch: ${params.headBranch}`);
    console.log(`Commit: ${commitHash}`);

    // Push to origin
    console.log(`Pushing to origin/${params.headBranch}...`);
    await safePush(git, "origin", params.headBranch);
    console.log("Pushed.");

    // Check for existing PR
    const octokit = new Octokit({ auth: token });

    let existingPrs: Awaited<
      ReturnType<typeof octokit.rest.pulls.list>
    >["data"];
    try {
      const response = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${params.headBranch}`,
        state: "open",
      });
      existingPrs = response.data;
    } catch (err: unknown) {
      throw formatApiError(err, "list pull requests");
    }

    if (existingPrs.length > 0) {
      const existingUrl = existingPrs[0].html_url;
      console.log(`\nPR already exists: ${existingUrl}`);
      return {
        created,
        modified,
        deleted,
        paths: changedPaths,
        diff: diffChunks.join("\n"),
        prUrl: existingUrl,
      };
    }

    // Create PR
    let prUrl: string;
    try {
      const { data: pr } = await octokit.rest.pulls.create({
        owner,
        repo,
        title: params.title,
        body: params.body ?? "",
        head: params.headBranch,
        base: baseBranch,
      });
      prUrl = pr.html_url;
    } catch (err: unknown) {
      throw formatApiError(err, "create pull request");
    }

    console.log(`\nPR created: ${prUrl}`);
    return {
      created,
      modified,
      deleted,
      paths: changedPaths,
      diff: diffChunks.join("\n"),
      prUrl,
    };
  }

  // Fallback (should never reach here)
  return {
    created,
    modified,
    deleted,
    paths: changedPaths,
    diff: diffChunks.join("\n"),
  };
}
