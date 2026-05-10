# validate-smiles

> Validate every `chemistry_molecule.smiles` string in a generated test
> by passing it through a SMILES parser and reporting parse failures.

## When to read me

When a generated test contains at least one `chemistry_molecule` visual.
Run `validate.mjs` with the test JSON on stdin; the output is a
machine-readable report you can use to drive the visual-fix replacement
prompt.

## What it checks

Hard checks — anything failing here is an actionable spec defect:

- The SMILES string is non-empty.
- The character class is restricted to the SMILES alphabet
  (`[A-Za-z0-9@.+\\-?!()\\[\\]{}/\\\\=#$:*]` — same as the cleaning
  filter in `smiles-drawer/app.js#L34`).
- Round-bracket and square-bracket pairs are balanced.

## Roadmap

A full SMILES parse needs RDKit (Python) or smiles-drawer (Node).
v1 ships syntax-only checks because the OpenAI Skills container's
exact runtime is not yet pinned. Once it is — and once it can install
either RDKit or the npm `smiles-drawer` package — extend
`validate.mjs` to call `Parser.parse(smiles)` and reject parse
failures.

## Output

Stdout JSON:

```json
{
  "ok": false,
  "violations": [
    { "index": 0, "code": "smiles_invalid", "reason": "unbalanced_parens" }
  ]
}
```

Exit codes:
- 0 — `ok: true`
- 1 — `ok: false`
- 2 — input not JSON / no input
