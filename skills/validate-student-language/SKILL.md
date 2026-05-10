# validate-student-language

> Heuristic checks for the Goal-B half of the visuals guide — student-friendly
> stems, four-part explanations, and full-sentence common-mistakes entries.

## When to read me

For every test, regardless of whether visuals are present. Goal B applies
globally.

## What it checks

Heuristics — designed to over-fire rather than miss; each finding is a
suggestion the model can choose to act on.

- **Banned words** in `question_text` or `answer_key.explanation`:
  "obviously", "trivially", "simply", "merely", "clearly".
- **Double negatives** — "is not un…" patterns in stems.
- **Stem starts with three nested commas** — proxy for "three nested
  qualifiers before the verb" failure mode.
- **Common-mistakes entries shorter than 8 words** — flagged as
  fragments rather than full sentences.
- **Related-concept looks like a textbook reference** —
  `Section X.Y`, `Chapter N`.
- **Explanation length out of band for difficulty**:
  - easy   → 80–150 words
  - medium → 120–220 words
  - hard   → 180–320 words

## Output

```json
{
  "ok": false,
  "violations": [
    { "index": 2, "code": "stem_uses_obviously" },
    { "index": 5, "code": "common_mistake_fragment" }
  ]
}
```
