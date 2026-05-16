#!/usr/bin/env node
/**
 * Write a JSON array of execute_sql argument objects for one batch.
 * Usage: node scripts/topic-sync-write-batch-array.cjs <allExecuteNdjson> <batchIndex0based> <batchSize> <outPath>
 */
const fs = require("fs");

const allPath = process.argv[2];
const batchIdx = parseInt(process.argv[3], 10);
const size = parseInt(process.argv[4], 10);
const outPath = process.argv[5];

const lines = fs.readFileSync(allPath, "utf8").trim().split("\n");
const slice = lines
  .slice(batchIdx * size, batchIdx * size + size)
  .map((l) => JSON.parse(l));
fs.writeFileSync(outPath, JSON.stringify(slice), "utf8");
console.log(slice.length);
