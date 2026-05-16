#!/usr/bin/env node
/**
 * Reads raw MCP execute_sql stdout (or file with same shape) and prints a full
 * INSERT ... ON CONFLICT upsert for public.topics. Exits 2 if j is null (empty batch).
 */
const fs = require("fs");

const path = process.argv[2];
if (!path) {
  console.error("Usage: mcp-topic-build-dev-upsert.cjs <mcp-output.txt>");
  process.exit(1);
}

const text = fs.readFileSync(path, "utf8");
let body = text;
try {
  const o = JSON.parse(text);
  if (typeof o.result === "string") body = o.result;
} catch {
  /* raw tool output */
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
  process.exit(2);
}

const candidates = ["$TQ$", "$EDU_TOPIC_SYNC$", "$TQ_TOPIC_BATCH$", "$_TOPIC_JSON_$"];
const tag = candidates.find((t) => !j.includes(t)) ?? "$EDU_RARE_TAG_7f3a$";

const sql = `INSERT INTO public.topics (
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
FROM jsonb_to_recordset(${tag}${j}${tag}::jsonb) AS x(
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

process.stdout.write(sql);
