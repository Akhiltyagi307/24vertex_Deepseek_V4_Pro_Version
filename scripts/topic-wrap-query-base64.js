#!/usr/bin/env node
/**
 * Read {query} from a chunk .arg.json and print a one-line DO block that EXECUTEs
 * the UTF-8 SQL via decode(base64). For Supabase MCP execute_sql size limits.
 */
const fs = require("fs");

const argPath = process.argv[2];
if (!argPath) {
  console.error("Usage: topic-wrap-query-base64.js <path-to.arg.json>");
  process.exit(1);
}
const { query } = JSON.parse(fs.readFileSync(argPath, "utf8"));
const b64 = Buffer.from(query, "utf8").toString("base64");
const tag = "$TOPIC_SYNC_WRAP$";
const sql = `DO ${tag} BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END ${tag};`;
process.stdout.write(sql);
