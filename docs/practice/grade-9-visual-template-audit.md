# Grade 9 Visual Template Audit

Canonical record of which Grade 9 NCERT chapters are suitable for visuals, mapped to the
template registry under `src/lib/practice/visuals/templates/`. Anchors the null-visual
policy at Grade 9: chapters not listed with `suitability: high` or `medium` below
intentionally receive no template and the planner returns no visual.

Evidence base: chapter and topic rows from `subjects` + `topics`, plus exercise chunks
from `topic_context_chunks` (chunk_type = 'exercise'), in project A
`suwakggcbxmmvqzeudmq`. Every suitability call below is grounded in what those
NCERT exercises actually ask students to do.

Suitability scale:

- **high** — a template is essential for the question type; visual is load-bearing.
- **medium** — a template helps for some sub-types; recommended when the stem provides the right signals.
- **low** — visual is optional and the question reads cleanly text-only; reserve for stems with explicit numeric stimulus.
- **none** — purely conceptual/theoretical/text-only; planner returns no template, visual stays null.

Grade 9 ships ~31 templates across 7 in-scope subjects. The remaining chapters fall under
the null policy by design.

Subjects mapped to actual DB names:

| Code-level subject keyword | DB subject names matched (after `normalizeSubject`) |
|---|---|
| Mathematics | Mathematics (Gr 9) |
| Science | Science (Gr 9 — combined; not yet split into Physics/Chemistry/Biology at this grade) |
| Geography | Geography (Gr 9, "Contemporary India-I") |
| History | History (Gr 9, "India and the Contemporary World – I") |
| Civics | Political Science (Gr 9, "Democratic Politics – I") — alias `political science → Civics` at [templates/index.ts:69](../../src/lib/practice/visuals/templates/index.ts:69) |
| Economics | Economics (Gr 9) |
| English | English Main Literature (Beehive), English Supplementary Reader (Moments) |

English Workbook is out of scope; see Null-policy summary.

---

## Mathematics (Class 9)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Number Systems | none | — | Irrationals, decimal expansions, p/q form — pure arithmetic; existing `math-number-line-interval` covers rare cases. |
| Polynomials | medium | `math-9-polynomial-factor-graph` | Use for "zeroes of polynomial as x-intercepts" stems; factorisation Qs stay text-only. |
| Coordinate Geometry | high | `math-9-coordinate-quadrants` | Quadrant identification, plot points, axes labels — visual is the question. |
| Linear Equations in Two Variables | high | `math-9-linear-equation-line-graph` | Solutions of `ax+by+c=0` are families of lines on the plane. |
| Introduction to Euclid's Geometry | none | — | Axiom/postulate theory; figure-free arguments. |
| Lines and Angles | high | `math-9-parallel-lines-transversal` | Almost every exercise references parallel-lines-with-transversal figures. |
| Triangles | high | `math-9-triangle-congruence` | Congruence proofs need labelled triangles with marked equal sides/angles. |
| Quadrilaterals | high | `math-9-quadrilateral-properties` | Parallelogram/rhombus/rectangle proofs with diagonals; mid-point theorem. |
| Circles | high | `math-9-circle-chord-arc` | Cyclic quadrilateral, angles subtended at centre/circumference, equal chords. |
| Heron's Formula | high | `math-9-heron-triangle-sides` | Triangles with three labelled side lengths — visual carries the stimulus. |
| Surface Areas and Volumes | none | — | 3D not supported by `math_geometry`; questions are formula application and read cleanly text-only. |
| Statistics | high | `math-9-statistics-grouped-histogram` | Frequency-class data → histogram / bar / frequency polygon. Existing `statistics-chart-stimulus` does not tag `Mathematics`, so Math Statistics resolution misses it without this entry. |
| Probability | none | — | Coin/dice counting; no visual required. |

## Science (Class 9)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Matter in Our Surroundings | none | — | States of matter, density — conceptual; no visual stimulus. |
| Is Matter Around Us Pure? | medium | `science-9-separation-flowchart` | "Which separation technique for oil from water / iron pins from sand / tea leaves from tea" — decision-tree flowchart. |
| Atoms and Molecules | medium | `science-9-atom-mass-conservation-table` | Conservation-of-mass reaction tables; atomic mass and valency lookups. |
| Structure of the Atom | medium | `science-9-atomic-shell-distribution` | K/L/M shell distributions and electron/proton/neutron comparison tables. Bohr models render poorly in `chemistry_molecule` (SMILES-only) — `data_table` is the honest fit. |
| The Fundamental Unit of Life | medium | `science-9-cell-organelle-diagram` | Labelled cell diagram (`biology_diagram` subKind `cell`). |
| Tissues | medium | `science-9-tissues-comparison` | Labelled plant/animal tissue panel (`biology_diagram`). |
| Motion | high | `science-9-motion-velocity-time-graph` | d–t and v–t graphs are the chapter's defining visual. |
| Force and Laws of Motion | high | `science-9-free-body-motion-laws` | Free-body diagrams for cricket-ball / luggage / carpet examples. |
| Gravitation | low | (none in Phase 1) | Mostly numeric formula use; existing `math-function-graph` covers rare projectile graphs. |
| Work and Energy | medium | `science-9-work-energy-diagram` | Force-and-displacement direction diagrams for work-sign questions. |
| Sound | medium | `science-9-sound-wave-form` | Compression/rarefaction longitudinal waves; differs from existing `physics-wave-markers` (which targets standing/interference wave families) in tag vocabulary. |
| Improvement in Food Resources | none | — | Crop management, manure vs fertilizer — text-only. |

## Geography (Class 9)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| India – Size and Location | low | (none in Phase 1) | Tropic of Cancer, longitude — text/recall; existing `india_map` policy via `social-science-map-location` covers spot questions. |
| Physical Features of India | high | `geography-9-physical-features-map` | Northern Plain / Himalayas / Peninsula / coastal plains — region-highlight map is the stimulus. |
| Drainage | high | `geography-9-drainage-rivers-map` | Himalayan vs Peninsular river systems; basin identification. |
| Climate | medium | `geography-9-climate-rainfall-map` | Rainfall belts and monsoon arrows; existing `statistics-chart-stimulus` available for climograph fallback. |
| Natural Vegetation and Wildlife | medium | `geography-9-vegetation-belts-map` | Tropical evergreen / deciduous / desert / montane belts. |
| Population | none | — | Birth/death rates, migration concepts — text-only; existing `statistics-chart-stimulus` covers rare statistical stems. |

## History (Class 9)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| The French Revolution | high | `history-9-french-revolution-timeline` | 1789→1799 chronology questions; existing `history-timeline` is generic but tag vocabulary needs Grade 9 anchors. |
| Socialism in Europe and the Russian Revolution | high | `history-9-russian-revolution-timeline` | 1905 → February → October sequencing. |
| Nazism and the Rise of Hitler | high | `history-9-nazism-source-extract` | Hitler Mein Kampf / Secret Book excerpts asked as line-numbered source extracts. |
| Forest Society and Colonialism | none | — | Discussion / cause-and-effect essays; no source-stimulus expected. |
| Pastoralists in the Modern World | none | — | Conceptual; existing `social-science-map-location` covers Maasai-grazing-lands stems if ever asked. |

## Civics (Class 9, "Political Science" in DB)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| What is Democracy? Why Democracy? | none | — | Definition / quotation Qs; pure text. |
| Constitutional Design | none | — | Comparative essays (SA struggle vs Indian freedom movement); text-only. |
| Electoral Politics | none | — | Match-features / fair-vs-unfair-practice; conceptual. |
| Working of Institutions | medium | `civics-9-working-of-institutions-flow` | Legislature ⇄ Executive ⇄ Judiciary role tables and Mandal Commission decision flow. |
| Democratic Rights | none | — | Match Fundamental Right with provision; text-only. |

## Economics (Class 9)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| The Story of Village Palampur | high | `economics-9-palampur-production-table` | Census fact-sheet table: location, area, land use, facilities, factors of production. |
| People as Resource | none | — | Concept Qs on human capital; no stimulus. |
| Poverty as a Challenge | medium | `economics-9-poverty-ratio-chart` | Poverty-line ratio over decades — bar chart. |
| Food Security in India | medium | `economics-9-food-security-table` | Bengal 1938–1943 rice production / imports / exports table is an explicit stimulus in the chapter. |

## English (Class 9 — Beehive prose + Moments)

| Topic | Suitability | Seed template | Notes |
|---|---|---|---|
| Beehive prose chapters (1–8) | high | `english-9-beehive-prose-extract` | "With reference to the story… 'I wouldn't throw it away.' Who says these words? What does 'it' refer to?" — every Beehive prose chapter uses line-numbered extracts. |
| Beehive: If I Were You (ch 9, play) | medium | reuse `english-9-beehive-prose-extract` | Treat dialogue lines as passage lines. |
| Beehive poems | low | reuse existing `english-line-source-extract` | Poem-line refs; existing template handles. |
| Moments chapters (1–9, Supplementary Reader) | medium | `english-9-moments-story-extract` | Short-story extracts; lower density of line-ref Qs than Beehive but same shape. |

---

## Null-policy summary

Topics where `suitability: none` is the deliberate default — the planner returns no
template, the visual stays null, and the question stands on its text alone:

- **Math:** Number Systems, Introduction to Euclid's Geometry, Surface Areas and Volumes,
  Probability.
- **Science:** Matter in Our Surroundings, Improvement in Food Resources.
- **Geography:** India – Size and Location (low, not none — falls back to existing
  `social-science-map-location`), Population.
- **History:** Forest Society and Colonialism, Pastoralists in the Modern World.
- **Civics:** What is Democracy?, Constitutional Design, Electoral Politics, Democratic
  Rights.
- **Economics:** People as Resource.
- **English Workbook (all 9 units):** Grammar / verb-form / reported-speech /
  preposition / vocabulary exercises. Visual templates do not help. Workbook is not
  passed through the visual planner at Grade 9.

This is intentional. Generic visuals on text-only chapters reduce question quality.

---

## How to read this audit

1. Pick a (subject, chapter) pair from a generated question.
2. Locate the row above. If `suitability: high` and a seed template exists, the planner
   picks it.
3. If `suitability: medium`, the planner picks the template when the stem contains the
   required signals (numeric stimulus / explicit object references).
4. If `suitability: low` or `none`, the planner returns `[]` and the visual stays null.
   This is healthy.
5. Cross-grade reuse: many existing Grade-band `9-10` / `6-8-9-10` templates already
   resolve at Grade 9 (e.g., `social-science-map-location`, `history-timeline`,
   `english-line-source-extract`, `statistics-chart-stimulus`). Grade 9 additions are
   narrower variants tuned to NCERT chapter vocabulary so the topic-tag scorer ranks
   them above the generic options for Grade 9 stems.
