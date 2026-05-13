# Grade 10 Visual Template Audit

Canonical record of which Grade 10 (CBSE / NCERT) chapters are suitable for
visuals, mapped to the template registry under
`src/lib/practice/visuals/templates/`. Anchors the null-visual policy:
chapters not listed below have `suitability: none` by default and the planner
returns no template for them.

Suitability scale:

- **high** — a template is essential for the question type; visual is load-bearing.
- **medium** — a template helps for some sub-types; recommended when the stem provides the right signals.
- **low** — visual is optional and the question reads cleanly text-only; reserve for stems with explicit numeric stimulus.
- **none** — purely conceptual or theoretical; planner returns no template, visual stays null.

Phase A.10 ships **33 new Grade 10 templates** appended to the seed registry
(20 generic entries already on `main` cover the broader 9–10 / 11–12
patterns; the new entries provide chapter-specific signals for Grade 10
matching). Biology-content templates were deliberately deferred from this
phase — the existing `biology-pedigree-trait` and `biology-ecology-flow`
entries already serve Grade 10 inheritance and ecology stems. Remaining
chapters are covered by the null policy until templates are written for
them.

Subjects mapped to actual DB names:

| Code-level subject | DB subject names matched (after `normalizeSubjectName`) |
|---|---|
| Mathematics | Mathematics (Gr 10) |
| Science | Science (Gr 10) |
| Geography | Geography (Gr 10) — also tagged `Social Science` |
| History | History (Gr 10) — also tagged `Social Science` |
| Civics | Political Science (Gr 10) via the existing `"political science" → "Civics"` alias |
| Economics | Economics (Gr 10) |
| English | English Main Literature / English Supplementary Reader / English Workbook (Gr 10) — alias gap, see "Out of scope" below |

All new entries set `gradeBands: ["9-10"]` so the Grade 9 work landing in a
parallel session can extend topicTags on shared rows rather than
duplicating them.

---

## Mathematics (Class 10)

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| Real Numbers | none | — | Fundamental Theorem / irrationality proofs are textual; no NCERT figure stimulus. |
| Polynomials | high | `math-polynomial-zeroes-grade-10` | "Geometrical meaning of zeroes" needs the curve crossing the x-axis. |
| Pair of Linear Equations in Two Variables | high | `math-linear-equations-pair-grade-10` | Graphical method shows intersecting / parallel / coincident lines. |
| Quadratic Equations | high | `math-quadratic-parabola-grade-10` | Parabola opening + roots / nature-of-roots questions. |
| Arithmetic Progressions | none | — | Pure arithmetic; no NCERT figure. |
| Triangles (similarity) | high | `math-triangle-similarity-grade-10` | "In a figure" similarity / BPT proofs are dominant. |
| Triangles (Pythagoras) | high | `math-pythagoras-right-triangle-grade-10` | Right-triangle figures with labelled sides. |
| Coordinate Geometry | high | existing `math-coordinate-geometry` (9-10, 11-12) | Distance / section / area-of-triangle stems on coordinate plane. |
| Introduction to Trigonometry | high | `math-trigonometry-right-triangle-grade-10` | Right triangle with opposite / adjacent / hypotenuse labels. |
| Some Applications of Trigonometry | high | `math-heights-distances-grade-10` | Angle of elevation / depression diagrams (tower, ladder, lighthouse). |
| Circles | high | `math-circle-tangent-grade-10` | Tangent–chord–radius figures; "TP and TQ are tangents". |
| Areas Related to Circles | high | `math-circle-sector-segment-grade-10` | Sector / segment / minute-hand figures. |
| Surface Areas and Volumes | none | — | Combined-solid stems read text-only; figure is decorative. |
| Statistics | high | `math-statistics-ogive-grade-10` | "Draw the cumulative frequency curve" → ogive. |
| Probability | none | — | Theoretical / counting; null. |
| Proofs in Mathematics | none | — | Pure reasoning; null. |
| Mathematical Modelling | none | — | Conceptual; null. |

## Science (Class 10)

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| Chemical Reactions and Equations | high | `science-chemical-reaction-types-grade-10` | Balanced equations + state symbols (combination / decomposition / displacement). |
| Acids, Bases and Salts | high | `science-ph-scale-grade-10` | pH scale 0–14 with indicators / common substances. |
| Metals and Non-metals | high | `science-reactivity-series-grade-10` | Reactivity-series comparison table. |
| Carbon and its Compounds | high | `science-carbon-functional-groups-grade-10` | Structural / electron-dot structures; functional-group identification. |
| Life Processes | medium | existing `biology-ecology-flow` / `biology-pedigree-trait` | Phase A.10 deliberately ships no Grade 10 biology-diagram template; existing generic biology templates cover digestive / respiratory / circulatory / excretory stems. |
| Control and Coordination | medium | existing `biology-ecology-flow` | Same — reuse existing biology entries; no Grade 10 reflex-arc template in this phase. |
| How do Organisms Reproduce? | medium | existing `biology-ecology-flow` | Same — reuse existing biology entries; no Grade 10 flower-diagram template in this phase. |
| Heredity | medium | existing `biology-pedigree-trait` | Existing template already covers monohybrid / Punnett / dominant–recessive stems via gradeBands 9-10. |
| Light – Reflection and Refraction (mirrors) | high | `science-light-mirror-ray-grade-10` | Concave / convex mirror ray diagrams with object + setup; image position is the answer, not pre-rendered. |
| Light – Reflection and Refraction (lenses) | high | `science-light-lens-ray-grade-10` | Concave / convex lens ray diagrams with object + setup; image properties are the answer, not pre-rendered. |
| The Human Eye and the Colourful World | high | `science-human-eye-defects-grade-10` | Corrective lens + eye + distant object setup; defect identification / power-to-focal-length conversion stems. |
| Electricity | high | `science-circuit-series-parallel-grade-10` | Series / parallel resistor schematic with ammeter / voltmeter. |
| Magnetic Effects of Electric Current | high | `science-magnetic-field-conductor-grade-10` | Field around straight conductor / solenoid; right-hand rule diagrams. |
| Our Environment | medium | existing `biology-ecology-flow` | Existing food-chain template covers Grade 10 trophic-level stems; no Grade 10 food-web entry in this phase. |
| Sources of Energy | none | — | Comparison stems read text-only; reuse `science-classification-table` (existing) on demand. |
| Sustainable Management of Natural Resources | none | — | Conceptual; null. |

## Geography (Class 10 — Contemporary India II)

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| Resources and Development | high | `geography-india-resources-grade-10` | Resource-type / soil-type India map. |
| Forest and Wildlife Resources | medium | existing `social-science-map-location` (9-10) | Generic India map is enough for biosphere reserves. |
| Water Resources | high | `geography-india-water-grade-10` | Multi-purpose river-project locations (Bhakra, Sardar Sarovar, etc.). |
| Agriculture | medium | existing `social-science-map-location` (9-10) | Crop-region map; planner picks the parent generic template. |
| Minerals and Energy Resources | high | `geography-india-minerals-grade-10` | Coal / iron / bauxite / oilfield locations. |
| Manufacturing Industries | high | `geography-india-industries-grade-10` | Iron-steel / cotton-textile / IT-hub regions. |
| Lifelines of National Economy | high | `geography-india-lifelines-grade-10` | Highways / railway zones / major seaports. |

## History (Class 10 — India and the Contemporary World II)

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| The Rise of Nationalism in Europe | high | `history-nationalism-europe-timeline-grade-10` | 1789 → 1871 chronology (French Revolution → unification). |
| Nationalism in India | high | `history-nationalism-india-timeline-grade-10` | 1915 → 1942 chronology (Champaran → Quit India). |
| The Making of a Global World | medium | existing `history-timeline` (6-8, 9-10, 11-12) | Broader-scope timeline; planner picks the parent. |
| The Age of Industrialisation | low | existing `social-science-source-extract` (9-10) | Source-led stems land on the existing source extract template. |
| Print Culture and the Modern World | high | `history-print-culture-source-grade-10` | Primary-source extract with line numbers. |

## Civics (Class 10 — Democratic Politics II, DB: "Political Science")

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| Power-sharing | high | `civics-power-sharing-grade-10` | Flowchart comparing Belgian accommodation vs. Sri Lankan majoritarianism. |
| Federalism | high | `civics-federalism-structure-grade-10` | Three-tier (Union / State / Local) flowchart with subject lists. |
| Gender, Religion and Caste | none | — | Conceptual; numbers in stems land on existing `social-science-source-extract`. |
| Political Parties | high | `civics-political-parties-table-grade-10` | National vs. state parties comparison (recognised / regional / symbol). |
| Outcomes of Democracy | none | — | Conceptual; null. |

## Economics (Class 10 — Understanding Economic Development)

| Chapter | Suitability | Seed template | Notes |
|---|---|---|---|
| Development | high | `economics-development-comparison-grade-10` | HDI / per-capita-income comparison table (Sri Lanka, India, Pakistan, etc.). |
| Sectors of the Indian Economy | high | `economics-sectors-chart-grade-10` | Pie / bar chart of GVA / employment share across primary / secondary / tertiary. |
| Money and Credit | medium | `economics-money-credit-flow-grade-10` | Flowchart of formal / informal credit sources. |
| Globalisation and the Indian Economy | none | — | Conceptual / case-led; reuse existing `social-science-source-extract`. |
| Consumer Rights | none | — | Conceptual; null. |

## English (Class 10 — First Flight / Footprints Without Feet / Workbook)

| Chapter group | Suitability | Seed template | Notes |
|---|---|---|---|
| Prose chapters (e.g. _A Letter to God_, _Nelson Mandela_, _Madam Rides the Bus_) | medium | existing `english-line-source-extract` (6-8, 9-10, 11-12) | Reading-comprehension stems need the line-numbered passage. |
| Poems (e.g. _Dust of Snow_, _Fire and Ice_, _Amanda!_) | medium | existing `english-line-source-extract` | Treat poem lines as numbered lines. |
| Workbook units | medium | existing `english-line-source-extract` | Grammar / writing prompts referencing the same prose chapter. |

No new Grade 10 English entries — the existing `english-line-source-extract`
already covers passages and poems with appropriate `gradeBands: ["6-8",
"9-10", "11-12"]`.

---

## Null-policy summary

Chapters where `suitability: none` is the deliberate default — the planner
returns no template, the visual stays null, and the question stands on its
text alone:

- Math: Real Numbers, Arithmetic Progressions, Surface Areas and Volumes, Probability, Proofs in Mathematics, Mathematical Modelling.
- Science: Sources of Energy, Sustainable Management of Natural Resources, and the conceptual sub-topics within Acids, Bases and Salts beyond the pH scale.
- Science (Biology chapters): Life Processes, Control and Coordination, How do Organisms Reproduce?, Heredity, Our Environment — deferred from Phase A.10. The existing `biology-ecology-flow` and `biology-pedigree-trait` templates already serve Grade 10 stems; chapter-specific biology-diagram entries are out of scope for this PR.
- Geography: Forest and Wildlife Resources, Agriculture (covered by the existing generic India-map template — no Grade 10 specialisation needed).
- History: The Making of a Global World (broader-scope timeline covered by existing `history-timeline`), The Age of Industrialisation (text-led; uses existing source-extract template).
- Civics: Gender / Religion / Caste, Outcomes of Democracy, Challenges to Democracy.
- Economics: Globalisation and the Indian Economy, Consumer Rights.

This is intentional: weak generic visuals would harm question quality.

## Templates queued for Phase A.11 (post-gallery sign-off)

Once the gallery walkthrough confirms the Phase A.10 seed set, consider
adding (none of these are in this PR):

1. `math-surface-areas-combined-solid` — `math_geometry` with composite-solid primitives once the renderer supports labelled 3D-projection blocks.
2. `science-periodic-table-section` — only if NCERT re-introduces the Periodic Classification chapter for Grade 10 (currently removed from the syllabus).
3. `civics-gender-data-grade-10` — `data_table` once an NCERT-sourced gender / caste data sheet is sourced.
4. `geography-agriculture-cropping-pattern-grade-10` — `india_map` if planner cannot reliably reuse the parent `social-science-map-location`.
5. `english-first-flight-passage-grade-10` — only if the alias-map gap (below) is fixed and the existing template misses Grade 10 hint matching.

Out of scope for Phase A.10:

- The DB subject names "English Main Literature", "English Supplementary Reader", "English Workbook" do not currently normalise to `English` in `SUBJECT_ALIASES` ([src/lib/practice/visuals/templates/index.ts:52](src/lib/practice/visuals/templates/index.ts:52)). A separate follow-up should add aliases so Grade 10 English subjects match the existing `english-line-source-extract`. No new Grade 10 English entries until that lands.
- World maps (non-India geography) — kind not in v1 schema.
- 3D solid figures, phasors, Venn diagrams — kinds not in v1 schema.

---

## How to read this audit

1. Pick a (subject, chapter) pair from a generated Grade 10 question.
2. Locate the row above. If `suitability: high` and a seed template exists, the planner picks it.
3. If `suitability: medium`, the planner picks the template only when the stem contains the required signals (numbers, explicit object names, "in the figure", "diagram below", etc.).
4. If `suitability: none` or no row is listed, the planner returns `[]` and the visual stays null. This is healthy.
5. Templates marked _add:_ are queued; until then the row falls back to `suitability: none` for routing purposes.
