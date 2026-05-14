#!/usr/bin/env node
/**
 * Reads MAIN execute_sql MCP output; extracts j (json_agg text); splits JSON array
 * into chunks of chunkSize rows; writes one-line JSON files {"query":"..."} per chunk
 * for call_mcp_tool(execute_sql). Prints NDJSON lines: {"offset":n,"chunk":k,"path":"..."}
 */
const fs = require("fs");
const path = require("path");

const mcpPath = process.argv[2];
const offset = Number(process.argv[3]);
const chunkSize = Number(process.argv[4] || 35);
const outDir = process.argv[5] || ".topic-sync-out/mcp-args";

if (!mcpPath || !Number.isFinite(offset)) {
  console.error(
    "Usage: mcp-topic-chunked-dev-upserts.cjs <mcp-output.txt> <offset> [chunkSize] [outDir]",
  );
  process.exit(1);
}

const text = fs.readFileSync(mcpPath, "utf8");
let body = text;
try {
  const o = JSON.parse(text);
  if (typeof o.result === "string") body = o.result;
} catch (_) {
  /* raw */
}

const block = body.match(
  /<untrusted-data-[a-f0-9-]+>\n(\[[\s\S]*?)\n<\/untrusted-data-[a-f0-9-]+>/,
);
if (!block) {
  console.error("No untrusted-data JSON block found");
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(block[1].trim());
} catch (e) {
  console.error("Failed to parse untrusted JSON:", e.message);
  process.exit(1);
}

const j = rows[0] && rows[0].j;
if (j == null || j === "" || j === "null") {
  process.stdout.write(JSON.stringify({ offset, skipped: true }) + "\n");
  process.exit(0);
}

let arr;
try {
  arr = JSON.parse(j);
} catch (e) {
  console.error("Failed to parse j JSON array:", e.message);
  process.exit(1);
}

function buildUpsertSql(payloadText) {
  const candidates = ["$TQ$", "$EDU_TOPIC_SYNC$", "$TQ_TOPIC_BATCH$", "$_TOPIC_JSON_$"];
  const tag = candidates.find((t) => !payloadText.includes(t)) ?? "$EDU_RARE_TAG_7f3a$";
  return `INSERT INTO public.topics (
  id, subject_id, grade, unit_name, unit_number,
  chapter_name, chapter_number, topic_name, topic_number,
  description, learning_objectives, metadata,
  is_active, created_at, updated_at
)
SELECT
  x.id,
  x.subject_id,
  x.grade,
  x.unit_name,
  x.unit_number,
  x.chapter_name,
  x.chapter_number,
  x.topic_name,
  x.topic_number,
  x.description,
  CASE WHEN x.learning_objectives IS NULL THEN NULL::text[]
       ELSE ARRAY(SELECT jsonb_array_elements_text(x.learning_objectives))
  END,
  COALESCE(x.metadata, '{}'::jsonb),
  x.is_active,
  x.created_at::timestamptz,
  x.updated_at::timestamptz
FROM jsonb_to_recordset(${tag}${payloadText}${tag}::jsonb) AS x(
  id uuid,
  subject_id uuid,
  grade int,
  unit_name text,
  unit_number int,
  chapter_name text,
  chapter_number int,
  topic_name text,
  topic_number int,
  description text,
  learning_objectives jsonb,
  metadata jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  grade = EXCLUDED.grade,
  unit_name = EXCLUDED.unit_name,
  unit_number = EXCLUDED.unit_number,
  chapter_name = EXCLUDED.chapter_name,
  chapter_number = EXCLUDED.chapter_number,
  topic_name = EXCLUDED.topic_name,
  topic_number = EXCLUDED.topic_number,
  description = EXCLUDED.description,
  learning_objectives = EXCLUDED.learning_objectives,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;`;
}

fs.mkdirSync(outDir, { recursive: true });

for (let i = 0, c = 0; i < arr.length; i += chunkSize, c += 1) {
  const part = arr.slice(i, i + chunkSize);
  const payloadText = JSON.stringify(part);
  const sql = buildUpsertSql(payloadText);
  const fname = `arg-o-${offset}-c-${c}.json`;
  const fpath = path.join(outDir, fname);
  fs.writeFileSync(fpath, JSON.stringify({ query: sql }));
  process.stdout.write(JSON.stringify({ offset, chunk: c, path: fpath }) + "\n");
}
