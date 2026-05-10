# validate-function-plot

> Validate `math_function_plot.items[].expr` and `economics_curve.curves[].expr`
> by syntax-checking the spec's expression strings.

## When to read me

When the test contains at least one `math_function_plot` or
`economics_curve` visual. Run `validate.mjs` with the test JSON on
stdin.

## What it checks

Hard checks (v1):

- Expression is non-empty.
- Character class restricted to mathjs-compatible identifiers + operators
  (`[A-Za-z0-9 +\-*/^()._,]`). Anything else is bounced as a probable
  injection or typo.
- Parentheses balanced.

## Roadmap

A full mathjs eval over the plotted range to confirm finite outputs is
the next iteration; deferred until the Skills runtime is pinned and we
know it can install `mathjs`. See SKILL.md in `validate-smiles` for the
same caveat.

## Output

```json
{
  "ok": false,
  "violations": [
    { "index": 0, "code": "expr_invalid", "reason": "char_outside_alphabet" }
  ]
}
```

Exit codes match the other validator skills (0 / 1 / 2).
