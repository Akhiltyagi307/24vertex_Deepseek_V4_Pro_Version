#!/usr/bin/env node
/**
 * Reads MAIN execute_sql MCP envelope; expects inner JSON array of rows with batch
 * column `j` (json_agg text) and optional `o` / offset.
 * Prints NDJSON lines: {"o":0,"skip":true} or {"o":0,"sql":"INSERT ..."}
 */
const fs = require("fs");

function readInput(path) {
  if (path === "-" || !path) return fs.readFileSync(0, "utf8");
  return fs.readFileSync(path, "utf8");
}

function extractUntrustedJson(body) {
  const m = body.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data[^>]*>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

function buildUpsertSql(payload) {
  const candidates = ["$TQ$", "$EDU_TOPIC_SYNC$", "$TOPIC_SYNC_MAY14_2026_K7$"];
  let tag = candidates.find((t) => !payload.includes(t));
  if (!tag) tag = "$TOPIC_SYNC_FALLBACK_ZZ9$";

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
FROM jsonb_to_recordset(${tag}${payload}${tag}::jsonb) AS x(
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

const raw = readInput(process.argv[2]);
let outer;
try {
  outer = JSON.parse(raw);
} catch (e) {
  console.error("outer JSON parse failed", e.message);
  process.exit(1);
}
const body = typeof outer.result === "string" ? outer.result : raw;
const rows = extractUntrustedJson(body);
if (!rows || !Array.isArray(rows)) {
  console.error("no untrusted-data rows");
  process.exit(1);
}

for (const row of rows) {
  const o = row.o ?? row.offset_val ?? row.offset ?? null;
      const j = row.j;
  const skip =
    j == null ||
    j === "" ||
    String(j) === "null";
  if (skip) {
    process.stdout.write(JSON.stringify({ o, skip: true }) + "\n");
    continue;
  }
  process.stdout.write(
    JSON.stringify({ o, skip: false, sql: buildUpsertSql(String(j)) }) + "\n"
  );
}
