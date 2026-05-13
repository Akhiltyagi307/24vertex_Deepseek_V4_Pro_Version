# Grade 11–12 Visual Template Audit

Canonical record of which Grade 11–12 topics are suitable for visuals, mapped to the
template registry under `src/lib/practice/visuals/templates/`. Anchors the
null-visual policy: topics not listed below have `suitability: none` by default
and the planner returns no template for them.

Suitability scale:

- **high** — a template is essential for the question type; visual is load-bearing.
- **medium** — a template helps for some sub-types; recommended when the stem provides the right signals.
- **low** — visual is optional and the question reads cleanly text-only; reserve for stems with explicit numeric stimulus.
- **none** — purely conceptual/theoretical; planner returns no template, visual stays null.

Phase A ships **40 templates** across 9 subjects (Phase A.8 expansion
landed Statistics + new templates per existing subject). Remaining topics
are covered by the null policy until templates are written for them.

Subjects mapped to actual DB names (post A.8 alignment):

| Code-level subject keyword | DB subject names matched (after `normalizeSubjectName`) |
|---|---|
| Physics | Physics Part 1 (Gr 11 + 12), Physics Part 2 (Gr 11 + 12) |
| Mathematics | Mathematics (Gr 11), Mathematics Part 1 / Part 2 (Gr 12), Applied Mathematics |
| Chemistry | Chemistry Part 1 (Gr 11 + 12), Chemistry Part 2 (Gr 11 + 12) |
| Biology | Biology (Gr 11 + 12) |
| Accountancy + Financial Accounting | Financial Accounting Part 1 / Part 2 (Gr 11 + 12) |
| Economics + Microeconomics + Macroeconomics | Economics (Gr 11), Microeconomics (Gr 12), Macroeconomics (Gr 12) |
| Business Studies | Business Studies (Gr 11), Business Studies Part 1 / Part 2 (Gr 12) |
| Statistics | Statistics (Gr 11) |
| English Core / Supplementary, Geography, History, Social Science | English Core, English Supplementary; Geography/History not yet in DB |

---

## Physics (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Current Electricity | high | `physics-circuit-measurement` | Mandatory for Ohm's-law / Kirchhoff stems with explicit values. |
| Electromagnetic Induction | medium | _add: `physics-emf-flux-graph`_ | Use `physics-data-graph` for flux-vs-time stems. |
| Wave Optics | medium | _add: `physics-wave-markers`_ | Interference / diffraction patterns. Free-body is anti-pattern. |
| Ray Optics & Optical Instruments | high | `physics-ray-optics` | Mandatory when the stem specifies object distance + focal length. |
| Laws of Motion | high | `physics-free-body` | Single body + ≥ 2 forces. |
| Gravitation | low | (none in Phase A) | Use `math-function-graph` for potential / orbital graphs. Free-body is anti-pattern. |
| Mechanical Properties of Solids/Fluids | low | _add: `physics-stress-strain`_ | Stress–strain or pressure-depth graphs. |
| Thermal Properties / Thermodynamics | medium | _add: `physics-pv-diagram`_ | PV / TS diagrams for cycles. |
| Oscillations / Waves | medium | _add: `physics-wave-markers`_ | Damped / forced oscillations time-series. |
| Electrostatics | low | (none in Phase A) | Mostly conceptual; field-lines visual deferred to Phase A.2. |
| Magnetic Effects of Current | low | (none in Phase A) | Field-direction queries; deferred. |
| Alternating Current | medium | _add: `physics-phasor`_ | Phasor diagrams; no native kind today — defer. |
| Dual Nature of Matter | none | — | Conceptual + numeric. Null. |
| Atoms / Nuclei | none | — | Conceptual + arithmetic. Null. |
| Semiconductor Devices | low | (none in Phase A) | Diagrams of pn-junction / amplifier — kind not in v1 schema. Null. |

## Mathematics (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Coordinate Geometry — Straight Lines | high | `math-coordinate-geometry` | Vertices + figure required. |
| Conic Sections | high | `math-coordinate-geometry` | Same template; ellipses/parabolas as primitive sets. |
| Trigonometric Functions | medium | `math-function-graph` | Standard trig curves. |
| Limits and Derivatives | medium | `math-function-graph` | Behavior near extrema / asymptotes. |
| Application of Derivatives | medium | `math-function-graph` | Curve sketching. |
| Integrals (area under curve) | medium | `math-function-graph` | Shaded area uses graph; explicit area question. |
| Linear Inequalities | high | `math-number-line-interval` | 1D inequalities only. |
| Sets and Relations | low | (none in Phase A) | Venn diagrams — kind not in v1 schema. Null. |
| Permutations & Combinations | none | — | Pure counting; null. |
| Sequences & Series | none | — | Pure algebraic; null. |
| Probability | medium | _add: `math-probability-tree`_ | Tree diagrams — kind not in v1; null for now. |
| Matrices / Determinants | none | — | Symbolic algebra; null. |
| Vector Algebra | medium | `math-coordinate-geometry` | 2D vectors via segments + vectors. |
| Three-Dimensional Geometry | low | (none in Phase A) | 3D not supported by current kinds; null. |
| Statistics | medium | `economics-price-quantity-schedule` (data_table) / future stats template | Histograms/freq tables; reuse stats chart later. |

## Chemistry (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Chemical Reactions (any) | high | `chemistry-reaction-conditions` | Balanced equations. |
| Electrochemistry — Galvanic Cells | high | `chemistry-galvanic-cell` | Net cell reaction. |
| Organic Chemistry (any named compound) | high | `chemistry-molecule-structure` | Structural formulae. |
| Equilibrium (chemical / ionic) | medium | `chemistry-reaction-conditions` | Equilibrium expression as reaction. |
| Solutions / Solid State | low | _add: `chemistry-data-table`_ | Concentration / unit-cell tables; reuse data_table. |
| Thermodynamics | none | — | Mostly conceptual + arithmetic; null. |
| Periodic Properties | none | — | Trends — visual is the periodic table; not in v1 schema. Null. |
| Coordination Compounds | low | `chemistry-molecule-structure` | Some named ligands; selective. |
| Surface Chemistry | none | — | Conceptual + tables; null. |

## Biology (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Principles of Inheritance (Genetics) | high | `biology-genetics-table` | Punnett ratios. |
| Ecology / Population Growth | medium | `biology-population-line` | Time-series data. |
| Plant / Animal Anatomy | none (v1) | — | Labelled-diagram kind not in v1 schema; null. |
| Cell Biology | none | — | Conceptual / structural diagrams not in v1; null. |
| Photosynthesis / Respiration | low | _add: `biology-pathway-flowchart`_ | Flowchart kind not in v1; null. |
| Molecular Basis of Inheritance | none | — | Conceptual + sequence diagrams; null. |
| Biotechnology | none | — | Process flowcharts not in v1; null. |
| Human Reproduction / Reproductive Health | none | — | Anatomy diagrams not in v1; null. |

## Accountancy (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Journal Entries | high | `accountancy-journal-entry` | Mandatory. |
| Ledger / Posting | high | `accountancy-ledger` | T-account. |
| Trial Balance | high | `accountancy-trial-balance` | Two-column. |
| Final Accounts (P&L + Balance Sheet) | high | _add: `accountancy-balance-sheet`_ | Use existing `balance_sheet` subKind. |
| Cash Book | medium | _add: `accountancy-cash-book`_ | Subsidiary-book subKind exists. |
| Rectification of Errors | medium | _add: `accountancy-rectification`_ | Special journal form. |
| Depreciation | low | _add: `accountancy-depreciation-table`_ | Calculation table; data_table fallback. |
| Partnership / Company Accounts | medium | reuse `accountancy-ledger` | Capital + current accounts. |

## Economics (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Demand & Supply / Market Equilibrium | high | `economics-demand-supply` | Mandatory. |
| Production Possibility Curve | high | `economics-ppc` | Concave PPC. |
| Elasticity (price/income/cross) | high | `economics-price-quantity-schedule` | Two-point schedule. |
| Statistics for Economics | medium | reuse stats chart (line/bar) | Defer dedicated template. |
| National Income / GDP | low | _add: `economics-flow-diagram`_ | Circular flow; not in v1. |
| Money & Banking | none | — | Conceptual; null. |
| Government Budget | none | — | Conceptual + arithmetic; null. |
| Balance of Payments | none | — | Conceptual; null. |

## Business Studies (Class 11 + 12)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Marketing Mix (4Ps) | high | `business-studies-4p-table` | Tabular. |
| Functions / Principles of Management | medium | `business-studies-4p-table` | Same template. |
| Market Share / Sales Data | medium | `business-studies-market-share-bar` | Bar chart. |
| Business Environment | none | — | Conceptual; null. |
| Consumer Protection | none | — | Conceptual; null. |
| Financial Management / Markets | low | reuse `economics-price-quantity-schedule` | Specific numeric stems only. |

## Humanities (History / Geography / Political Science / English)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Geography — Indian states/borders | high | `humanities-india-map-geography` | Mandatory for spatial-identification stems. |
| Indian Freedom Struggle (timeline) | medium | `humanities-history-timeline` | Chronology tables. |
| World History (timeline) | medium | reuse `humanities-history-timeline` | Same template. |
| English — Reading Comprehension | high | `humanities-english-passage` | Line-numbered passage. |
| English — Poem Analysis | medium | reuse `humanities-english-passage` | Same template; treat lines as poem lines. |
| Political Science (Indian Politics) | none | — | Conceptual; null. |
| Indian Sociological Thinkers / Sociology | none | — | Conceptual; null. |
| Geography — World maps | none (v1) | — | Kind not in v1. Null. |
| History — Source Analysis | low | _add: `history-source-extract`_ | Use `english_passage` as fallback. |

---

## Null-policy summary

Topics where `suitability: none` is the deliberate default — the planner returns
no template, the visual stays null, and the question stands on its text alone:

- Permutations & Combinations, Sequences & Series, Matrices, Determinants
- Sets and Relations (Venn diagrams not in v1 schema)
- Periodic Properties (table not in v1)
- Most biology beyond genetics/ecology
- Government Budget, Money & Banking, Balance of Payments
- Political Science (Indian Politics), Sociology
- Most thermodynamics conceptual stems
- Dual Nature, Atoms, Nuclei (conceptual + arithmetic)

This is intentional: weak generic visuals would harm question quality. Phase B
must respect the null policy as a healthy first-class case.

## Templates queued for Phase A.2 (post-gallery sign-off)

Once the gallery walkthrough confirms the Phase A seed set, add the following
templates without changing the core architecture:

1. `physics-data-graph` — generic time-series for physics (flux, oscillations).
2. `physics-pv-diagram` — thermodynamic PV cycles.
3. `physics-wave-markers` — wave-amplitude / wavelength annotations.
4. `chemistry-data-table` — solutions / colligative-properties tables.
5. `accountancy-balance-sheet` — final-accounts statement (subKind exists).
6. `accountancy-cash-book` — cash-book subKind.
7. `accountancy-rectification` — rectification entries.
8. `economics-statistics-chart` — dedicated stats template for histograms.
9. `business-studies-financial-metrics` — KPI table.

Out of scope for Phase A:

- Field-line / phasor / orbital diagrams (no native kind in v1).
- Venn / probability tree (no native kind in v1).
- Biology anatomy / pathway flowcharts (no native kind in v1).
- World maps / non-India geography (no native kind in v1).

These need schema additions before templates can be authored; the user audit
must decide whether to add them in Phase A.2 or defer to Phase B.

---

## How to read this audit

1. Pick a (subject, topic) pair from a generated question.
2. Locate the row above. If `suitability: high` and a seed template exists, the
   planner picks it.
3. If `suitability: medium`, the planner picks the template only when the stem
   contains the required signals (numbers / explicit object names).
4. If `suitability: none` or no row is listed, the planner returns `[]` and the
   visual stays null. This is healthy.
5. Templates marked _add:_ are queued; until then the row falls back to
   `suitability: none` for routing purposes.
