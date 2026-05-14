#!/usr/bin/env node
const fs = require("fs");
const batch = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });
batch.forEach((args, i) => {
  fs.writeFileSync(`${outDir}/arg_${i}.json`, JSON.stringify(args), "utf8");
});
console.log(batch.length);
