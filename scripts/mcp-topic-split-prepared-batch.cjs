#!/usr/bin/env node
/**
 * Splits a prepared batch JSON file { query: "INSERT...jsonb_to_recordset($TQ$[...]$TQ$::jsonb)...", o?: number }
 * into smaller {query} JSON files for MCP execute_sql.
 *
 * Usage: node scripts/mcp-topic-split-prepared-batch.cjs <batch-XX-o-O.json> [chunkSize] [outDir]
 * Prints NDJSON: {"chunk":0,"path":"..."} per file.
 */
const fs = require("fs");
const path = require("path");

const batchPath = process.argv[2];
const chunkSize = Number(process.argv[3] || 35);
const outDir = process.argv[4] || ".topic-sync-out/mcp-args";

if (!batchPath) {
  console.error("Usage: mcp-topic-split-prepared-batch.cjs <batch.json> [chunkSize] [outDir]");
  process.exit(1);
}

const obj = JSON.parse(fs.readFileSync(batchPath, "utf8"));
const sql = obj && obj.query;
if (typeof sql !== "string" || !sql.includes("jsonb_to_recordset")) {
  console.error("Invalid batch: missing string .query with jsonb_to_recordset");
  process.exit(1);
}

const m = sql.match(/jsonb_to_recordset\(\$TQ\$([\s\S]*)\$TQ\$::jsonb\)/);
if (!m) {
  console.error("Could not find $TQ$...$TQ$::jsonb payload in query");
  process.exit(1);
}

let arr;
try {
  arr = JSON.parse(m[1]);
} catch (e) {
  console.error("Failed to parse JSON array inside jsonb_to_recordset:", e.message);
  process.exit(1);
}

if (!Array.isArray(arr) || arr.length === 0) {
  process.stdout.write(JSON.stringify({ skipped: true, reason: "empty array" }) + "\n");
  process.exit(0);
}

const prefix = sql.slice(0, m.index);
const suffix = sql.slice(m.index + m[0].length);

function buildUpsertSql(payloadText) {
  const candidates = ["$TQ$", "$EDU_TOPIC_SYNC$", "$TQ_TOPIC_BATCH$", "$_TOPIC_JSON_$"];
  const tag = candidates.find((t) => !payloadText.includes(t)) ?? "$EDU_RARE_TAG_7f3a$";
  return (
    prefix +
    `jsonb_to_recordset(${tag}${payloadText}${tag}::jsonb)` +
    suffix
  );
}

const stem = path.basename(batchPath, path.extname(batchPath));
fs.mkdirSync(outDir, { recursive: true });

for (let i = 0, c = 0; i < arr.length; i += chunkSize, c += 1) {
  const part = arr.slice(i, i + chunkSize);
  const payloadText = JSON.stringify(part);
  const chunkSql = buildUpsertSql(payloadText);
  const fname = `${stem}-c-${c}.json`;
  const fpath = path.join(outDir, fname);
  fs.writeFileSync(fpath, JSON.stringify({ query: chunkSql }));
  process.stdout.write(JSON.stringify({ chunk: c, path: fpath }) + "\n");
}
