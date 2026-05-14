#!/usr/bin/env node
/**
 * Writes one <basename>.mcp.json per chunk under outDir, each: {"query":"..."}
 */
const fs = require("fs");
const path = require("path");

const chunksDir = process.argv[2];
const outDir = process.argv[3];

const files = fs
  .readdirSync(chunksDir)
  .filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "_manifest.json" &&
      f !== "0000_batch00_rows20.json",
  )
  .sort();

fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const { query } = JSON.parse(fs.readFileSync(path.join(chunksDir, f), "utf8"));
  const base = f.replace(/\.json$/, "");
  fs.writeFileSync(
    path.join(outDir, `${base}.mcp.json`),
    JSON.stringify({ query }),
    "utf8",
  );
}

console.log("wrote", files.length, "files to", outDir);
