# ncert-chemistry-conventions

> NCERT-specific conventions for chemistry visuals emitted as
> `chemistry_molecule` or `chemistry_reaction` envelopes by the EDU-AI
> practice generator.

## When to read me

Whenever a question carries a `chemistry_molecule.smiles` or
`chemistry_reaction.ce` payload. Read this file before running
`lint.mjs` or `validate-smiles/validate.py` so you know what the
expected NCERT shapes look like.

## Naming and notation (Class 11–12)

- Functional groups follow NCERT Class 12 names: "carboxylic acid"
  (not "carboxyl"), "haloalkane" (not "alkyl halide"), "alkanoic
  acid" — but in Indian board exam practice, "carboxylic acid" is the
  preferred name.
- Reactions use:
  - `\\Delta` for "heat".
  - `\\xrightarrow{\\text{cat.}}` for catalysis.
  - `<=>` for equilibrium (mhchem auto-renders as `⇌`).
  - `->` for irreversible reaction.

## SMILES conventions (kind: `chemistry_molecule`)

- Skeletal SMILES preferred. Explicit hydrogens only when stereochemistry
  depends on them.
- Ionic compounds prefer the formula in `chemistry_reaction.ce`
  (`CaCO3`) rather than SMILES — easier to render and matches NCERT
  notation.
- Stereochemistry where relevant: `cis-`, `trans-`, `R-`, `S-`,
  `E-`, `Z-` prefixes go in the `label` field, not the SMILES.

## Reaction equations (kind: `chemistry_reaction`)

- Numbers are auto-subscripted by mhchem; do NOT write `H_2O`. Write
  `H2O`.
- Use double-backslash for control sequences (`\\Delta`, `\\Phi`).
- Units (kJ/mol, atm) inside `\\pu{...}`: `\\pu{25 kJ/mol}`.
- Conditions over the arrow: `\\xrightarrow{cat.}` or
  `\\xrightarrow[60^\\circ\\text{C}]{H2SO4}`.

## Lint output

`lint.mjs` reads the test JSON on stdin and emits
`{ ok, violations: [{ index, code, message }] }`. Hard violations:

- `chemistry_molecule.smiles_empty` — SMILES is empty.
- `chemistry_reaction.ce_underscore_subscript` — uses `H_2O` instead
  of `H2O`.
- `chemistry_reaction.ce_single_backslash` — single-backslash control
  sequence (mhchem requires double).

A SMILES parse check is a separate skill (`validate-smiles`) because
it requires RDKit.
