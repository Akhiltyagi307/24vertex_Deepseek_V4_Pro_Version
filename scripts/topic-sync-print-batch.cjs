#!/usr/bin/env node
/**
 * Prints one NDJSON line per chunk: {"file":"...","query":"..."}
 * Usage: node scripts/topic-sync-print-batch.cjs <chunksDir> <startIndex> <batchSize>
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const start = parseInt(process.argv[3], 10);
const size = parseInt(process.argv[4], 10);

const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "_manifest.json" &&
      f !== "0000_batch00_rows20.json",
  )
  .sort();

const slice = files.slice(start, start + size);
for (const f of slice) {
  const { query } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  process.stdout.write(JSON.stringify({ file: f, query }) + "\n");
}
