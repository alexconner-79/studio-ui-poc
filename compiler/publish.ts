import { compile } from "./compile";
import {
  publishToGitHub,
  type PublishMode,
} from "../adapters/github/publish";

const modeFromArgs = (): PublishMode => {
  if (process.argv.includes("--commit")) {
    return "commit-only";
  }
  if (process.argv.includes("--dry")) {
    return "dry-run";
  }
  const arg = process.argv.find((item) => item.startsWith("--mode="));
  if (!arg) {
    return "dry-run";
  }
  const value = arg.split("=")[1];
  if (value === "commit-only" || value === "dry-run" || value === "pr") {
    return value;
  }
  return "dry-run";
};

const formatSummaryTable = (summary: {
  created: number;
  modified: number;
  deleted: number;
}): string => {
  const lines = [
    "Summary",
    "-------",
    `created:  ${summary.created}`,
    `modified: ${summary.modified}`,
    `deleted:  ${summary.deleted}`,
  ];
  return lines.join("\n");
};

export async function publish(): Promise<void> {
  const files = await compile({ write: false });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mode = modeFromArgs();
  const result = await publishToGitHub({
    repoPath: process.cwd(),
    baseBranch: "main",
    headBranch: `studio/spec-update-${timestamp}`,
    title: "Update generated UI",
    body: "Generated updates from studio compiler.",
    mode,
    files,
  });

  console.log(formatSummaryTable(result));
  if (result.paths.length > 0) {
    console.log("\nChanged files:");
    result.paths.forEach((filePath) => console.log(`- ${filePath}`));
  }

  if (mode === "dry-run" && result.diff.length > 0) {
    console.log("\nDiff:\n");
    console.log(result.diff);
  }
}

if (require.main === module) {
  publish().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
