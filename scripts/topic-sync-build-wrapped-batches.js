#!/usr/bin/env node
/**
 * Build .sql files: each file is one DO block with N EXECUTE convert_from(decode(...))
 * statements, one per chunk, preserving exact UTF-8 SQL from each .arg.json {query}.
 *
 * Usage: node scripts/topic-sync-build-wrapped-batches.js <argDir> <outDir> [batchSize]
 */
const fs = require("fs");
const path = require("path");

const argDir = process.argv[2];
const outDir = process.argv[3];
const batchSize = Math.max(1, parseInt(process.argv[4] || "3", 10));

if (!argDir || !outDir) {
  console.error(
    "Usage: topic-sync-build-wrapped-batches.js <argDir> <outDir> [batchSize]",
  );
  process.exit(1);
}

const files = fs
  .readdirSync(argDir)
  .filter((f) => f.endsWith(".arg.json"))
  .sort();

fs.mkdirSync(outDir, { recursive: true });

const tag = "$TOPIC_BATCH$";
let batchIdx = 0;
for (let i = 0; i < files.length; i += batchSize) {
  const slice = files.slice(i, i + batchSize);
  const parts = [];
  for (const fname of slice) {
    const { query } = JSON.parse(
      fs.readFileSync(path.join(argDir, fname), "utf8"),
    );
    const b64 = Buffer.from(query, "utf8").toString("base64");
    parts.push(
      `EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8')`,
    );
  }
  const sql = `DO ${tag} BEGIN\n${parts.map((p) => `  ${p};`).join("\n")}\nEND ${tag};`;
  const outName = `${String(batchIdx).padStart(4, "0")}_batch_${slice[0].replace(".arg.json", "")}_to_${slice[slice.length - 1].replace(".arg.json", "")}.sql`;
  fs.writeFileSync(path.join(outDir, outName), sql, "utf8");
  console.log(outName, slice.length);
  batchIdx += 1;
}
