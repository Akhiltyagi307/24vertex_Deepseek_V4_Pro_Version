# validate-accountancy

> Pure-arithmetic checks on `accountancy_table` visuals.

## When to read me

When the test contains at least one `accountancy_table` visual. Run
`validate.mjs` with the test JSON on stdin.

## What it checks

- **journal_entry / cash_book / rectification** — sum of debit column
  equals sum of credit column across the rows.
- **trial_balance** — total debits = total credits.
- **balance_sheet** — total assets (rows where `bold` is false) =
  total equity & liabilities.
- **ledger** — at least one entry on at least one side, OR an explicit
  zero balance row.
- **p_and_l** — at least one row.

Format-specific stylistic checks (Schedule III ordering, etc.) live in
the prompt's preamble, not here. This script catches arithmetic-level
defects that would make the test wrong on its face.

## Output

```json
{ "ok": false, "violations": [{ "index": 0, "code": "journal_unbalanced", "details": { "debit": 100, "credit": 90 } }] }
```
