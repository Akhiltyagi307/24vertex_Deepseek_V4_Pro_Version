#!/usr/bin/env node
/**
 * Reads a user-supabase-main execute_sql result file (JSON envelope with untrusted block)
 * and prints the DEV upsert SQL (jsonb_to_recordset + dollar-quoted JSON).
 * Prints "SKIP" if j is null/absent.
 *
 * Usage:
 *   node mcp-topic-export-to-dev-upsert.cjs <mcp-result.json>
 * Or stdin:  node mcp-topic-export-to-dev-upsert.cjs - < mcp-result.json
 */
const fs = require("fs");

function readInput(path) {
  if (path === "-") return fs.readFileSync(0, "utf8");
  if (!path) {
    console.error("usage: node mcp-topic-export-to-dev-upsert.cjs <file|-");
    process.exit(1);
  }
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

function payloadFromMcpText(raw) {
  const outer = JSON.parse(raw);
  const body = typeof outer.result === "string" ? outer.result : raw;
  const rows = extractUntrustedJson(body);
  if (!rows) return { error: "no untrusted-data block" };
  if (!Array.isArray(rows) || rows.length === 0) return { skip: true };
  const first = rows[0];
  if (first && Object.prototype.hasOwnProperty.call(first, "j")) {
    const payload = first.j;
    if (payload == null || payload === "" || payload === "null")
      return { skip: true };
    return { payload: String(payload) };
  }
  return { error: "unexpected row shape" };
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
const parsed = payloadFromMcpText(raw);
if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}
if (parsed.skip) {
  process.stdout.write("SKIP");
  process.exit(0);
}
process.stdout.write(buildUpsertSql(parsed.payload));
