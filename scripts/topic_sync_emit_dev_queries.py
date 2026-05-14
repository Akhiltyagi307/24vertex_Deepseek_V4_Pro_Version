#!/usr/bin/env python3
"""Parse Supabase MCP execute_sql response for topic batches; emit DEV upsert SQL JSON payloads."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

UPSERT_HEAD = """INSERT INTO public.topics (
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
FROM jsonb_to_recordset(__RECORDSET__::jsonb) AS x(
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
  updated_at = EXCLUDED.updated_at;"""


def parse_j_from_mcp_text(raw: str) -> str | None:
    """Extract raw JSON array text from MCP envelope (field j). Returns None if batch empty."""
    outer = json.loads(raw)
    body = outer.get("result", "")
    idx = 0
    chunk = ""
    while True:
        start = body.find("<untrusted-data-", idx)
        if start < 0:
            break
        gt = body.find(">", start)
        if gt < 0:
            break
        after = body[gt + 1 : gt + 512].lstrip()
        if after.startswith("["):
            end = body.find("</untrusted-data", gt)
            if end < 0:
                raise ValueError("Could not find untrusted-data end in MCP response")
            chunk = body[gt + 1 : end].strip()
            break
        idx = gt + 1
    if not chunk:
        raise ValueError("Could not find untrusted-data JSON payload in MCP response")
    inner = json.loads(chunk)
    if not inner:
        return None
    row0 = inner[0]
    j = row0.get("j")
    if j is None:
        return None
    if j == "" or j.lower() == "null":
        return None
    return j


def pick_tag(payload: str) -> str:
    if "$TQ$" not in payload:
        return "$TQ$"
    return "$EDU_TOPIC_SYNC$"


def build_upsert(payload_compact: str) -> str:
    tag = pick_tag(payload_compact)
    return UPSERT_HEAD.replace("__RECORDSET__", f"{tag}{payload_compact}{tag}")


def chunk_rows(j_text: str, chunk_size: int) -> list[list[Any]]:
    arr = json.loads(j_text)
    if not isinstance(arr, list):
        raise ValueError("j is not a JSON array")
    return [arr[i : i + chunk_size] for i in range(0, len(arr), chunk_size)]


def compact_json_array_text(rows: list[Any]) -> str:
    return json.dumps(rows, ensure_ascii=False, separators=(",", ":"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mcp_result_file", type=Path)
    ap.add_argument("--chunk-size", type=int, default=25)
    ap.add_argument("--out-dir", type=Path, help="Write execute_sql JSON one file per chunk")
    ap.add_argument(
        "--emit-single-sql",
        type=Path,
        help="Write one raw SQL upsert for the entire batch (no chunking)",
    )
    args = ap.parse_args()
    raw = args.mcp_result_file.read_text(encoding="utf-8")
    j = parse_j_from_mcp_text(raw)
    if j is None:
        print("SKIP: null batch", file=sys.stderr)
        return
    if args.emit_single_sql:
        rows = json.loads(j)
        payload = compact_json_array_text(rows)
        args.emit_single_sql.parent.mkdir(parents=True, exist_ok=True)
        args.emit_single_sql.write_text(build_upsert(payload), encoding="utf-8")
        print(str(args.emit_single_sql))
        return
    chunks = chunk_rows(j, args.chunk_size)
    if args.out_dir:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        for i, ch in enumerate(chunks):
            payload = compact_json_array_text(ch)
            q = build_upsert(payload)
            out = args.out_dir / f"chunk-{i:02d}.json"
            out.write_text(json.dumps({"query": q}, ensure_ascii=False), encoding="utf-8")
            print(str(out))
    else:
        for ch in chunks:
            payload = compact_json_array_text(ch)
            print(json.dumps({"query": build_upsert(payload)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
