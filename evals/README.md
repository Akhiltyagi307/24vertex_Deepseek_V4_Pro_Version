# Eval run history

This directory stores **historical results** from `pnpm run evals:practice`.
The eval runner code itself lives at
[`src/lib/practice/__evals__/`](../src/lib/practice/__evals__/).

## Files

- `runs/` — individual eval-run JSON files, one per invocation.
  Filename: `<ISO-timestamp>--<filter>.json` (e.g.
  `2025-05-08T12-34-56-000Z--all.json` or `…--physics-11-12.json`).
- `runs/.gitkeep` — keeps the directory under version control even when empty.

## Why commit results?

- **History.** `git log evals/runs/` is your ledger of every eval ever run.
- **Drift detection.** Diffing this week's run against last week's
  (`scripts/diff-eval-runs.mjs`) shows which fixtures regressed.
- **Reproducibility.** Each run records the model, prompt fixtures, and
  per-assertion outcomes, so a future contributor can reproduce a
  specific result.

## Capturing a run

```bash
# Run all fixtures + write JSON file
pnpm run evals:practice -- --json

# One subject, JSON only (no stdout report)
pnpm run evals:practice -- physics-11-12 --json-only

# Without --json: only stdout report, no file written
pnpm run evals:practice
```

## Diffing two runs

```bash
node scripts/diff-eval-runs.mjs evals/runs/<oldest>.json evals/runs/<newest>.json
```

Or, with no arguments, the script picks the two most recent files
chronologically:

```bash
node scripts/diff-eval-runs.mjs
```

## File format

```json
{
  "schema_version": 1,
  "generated_at": "2025-05-08T12:34:56.789Z",
  "filter": "all",
  "model": "gpt-4o-mini",
  "summary": {
    "totalFixtures": 12,
    "passed": 11,
    "failed": 1,
    "schemaInvalid": 0,
    "totalAssertions": 78,
    "passedAssertions": 76,
    "totalInputTokens": 27034,
    "totalOutputTokens": 21486,
    "totalLatencyMs": 38102
  },
  "results": [
    {
      "fixtureId": "math-6-10-grade-8-medium-12q",
      "subject": "math-6-10",
      "pass": true,
      "schemaValid": true,
      "latencyMs": 2841,
      "usage": { "inputTokens": 2103, "outputTokens": 1824 },
      "outputResults": [
        { "pass": true, "assertion": { "type": "totalCountMatches" } },
        // ...one per output assertion
      ]
    }
    // ...one per fixture
  ]
}
```

## Privacy / size

Each run file is ~10–30 KB. Committing weekly + on-demand runs to git is
fine for the foreseeable future. If size becomes a concern, add a retention
policy (e.g. keep last 12 weekly + last 30 ad-hoc).

The files contain no PII. They contain prompt-fixture identifiers, token
counts, latencies, pass/fail booleans, and per-assertion failure reasons —
no student data, no API keys.
