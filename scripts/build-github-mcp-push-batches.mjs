/**
 * Writes JSON batch files for GitHub MCP `push_files` (owner/repo/branch/message/files).
 * Run from repo root: node scripts/build-github-mcp-push-batches.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".mcp-github-push-batches");
const OWNER = "Akhiltyagi307";
const REPO = "24Vertex-main";
const BRANCH = "main";
/** Approx max JSON size per batch (MCP / message limits). */
/** Keep each batch JSON under ~95k so it fits in one Read tool call (100k cap). */
const BATCH_MAX_CHARS = 88_000;

const BINARY_EXT = /\.(png|jpe?g|gif|ico|webp|woff2?)$/i;

const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  /** Too large for a single MCP tool payload; push with `git push` after MCP sync. */
  .filter((p) => p !== "pnpm-lock.yaml");

function filePayload(rel) {
  const full = path.join(root, rel);
  const buf = fs.readFileSync(full);
  if (BINARY_EXT.test(rel) || buf.includes(0)) {
    return { path: rel, content: buf.toString("base64") };
  }
  return { path: rel, content: buf.toString("utf8") };
}

const entries = tracked.map(filePayload);

const batches = [];
let cur = [];
let size = 0;
function flush() {
  if (cur.length) batches.push(cur);
  cur = [];
  size = 0;
}
for (const entry of entries) {
  const delta = JSON.stringify(entry).length + 2;
  if (delta > BATCH_MAX_CHARS) {
    flush();
    batches.push([entry]);
    continue;
  }
  if (size + delta > BATCH_MAX_CHARS && cur.length) flush();
  cur.push(entry);
  size += delta;
}
flush();

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

batches.forEach((files, i) => {
  const payload = {
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
    message: `chore: import 24Vertex sources (part ${i + 1}/${batches.length})`,
    files,
  };
  const name = `batch-${String(i + 1).padStart(3, "0")}.json`;
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(payload), "utf8");
});

console.log(JSON.stringify({ batches: batches.length, outDir, files: tracked.length }, null, 0));
