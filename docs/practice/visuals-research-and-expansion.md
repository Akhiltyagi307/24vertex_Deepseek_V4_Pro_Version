# Practice Visuals Research And Expansion

Last updated: 2026-05-11

## Purpose

This document turns the practice-visuals research pass into an implementation-ready backlog. It separates:

- current-schema work: exemplar fixes and additions that can be added now.
- future renderer work: high-value CBSE/NCERT visual question formats that the current schema cannot express well.

No code changes are required to use this document as a planning source.

## Current System Boundary

The model can only generate visual envelopes that match `src/lib/practice/visuals/schemas.ts`.

Supported now:

- `math_geometry`, `math_function_plot`, `number_line`
- `physics_diagram` with `free_body`, `ray_optics`, `circuit`
- `chemistry_molecule`, `chemistry_reaction`
- `accountancy_table`
- `economics_curve`, `statistics_chart`, `data_table`
- `english_passage`

Subject routing currently allows:

- Mathematics: `math_geometry`, `math_function_plot`, `number_line`, `data_table`
- Physics: `physics_diagram`, `math_function_plot`, `data_table`
- Chemistry: `chemistry_molecule`, `chemistry_reaction`
- Accountancy: `accountancy_table`
- Economics / Statistics: `economics_curve`, `statistics_chart`, `data_table`, `math_function_plot`
- Science: `physics_diagram`, `chemistry_molecule`, `chemistry_reaction`, `data_table`
- English: `english_passage`

Important renderer notes:

- `chemistry_molecule.display` is now constrained to `2d`; captions/labels should not imply true 3D rendering.
- `math_geometry.angle_marker` now renders explicit angle arcs (with right-angle square when applicable), plus primitive label support.
- `statistics_chart.pie` and `statistics_chart.box` have screen renderers, but PDF rendering falls back to text/code blocks.
- `physics_diagram` cannot show electric field lines, magnetic fields, phasors, waves, or semiconductor symbols as first-class diagrams.
- Biology, Social Science maps/timelines, and Business Studies flowcharts are not first-class visual kinds today.

## Source Corpus

Primary official sources researched:

- CBSE Class X Mathematics Standard SQP 2025-26: `https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/MathsStandard-SQP.pdf`
- CBSE Class X Science SQP 2025-26: `https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/Science-SQP.pdf`
- CBSE Class XII Physics SQP 2025-26: `https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Physics-SQP.pdf`
- CBSE Class XII Chemistry SQP 2025-26: `https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Chemistry-SQP.pdf`
- CBSE Class XII Accountancy SQP 2025-26: `https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Accountancy-SQP.pdf`
- CBSE Class XII Economics SQP / curriculum sources: `https://cbseacademic.nic.in/SQP_CLASSXII_2025-26.html`
- CBSE English question bank / sample paper pages and Class X sample paper extracts.
- Supplementary sources used only for pattern discovery: Jagran Josh, Vedantu, LearnCBSE, Careers360, Edurev pages surfaced in search results.

Repo-local sources:

- `src/lib/practice/visuals/schemas.ts`
- `src/lib/practice/visuals/exemplars.ts`
- `src/lib/practice/system-prompt.ts`
- `src/lib/practice/user-message.ts`
- `src/lib/practice/generation-prompt-registry.ts`
- `src/components/student/practice/visuals/renderers/*`
- `tests/components/practice/visuals-renderers.test.tsx`
- `src/lib/practice/visuals/__tests__/exemplars.test.ts`

## Subject Visual Taxonomy And Schema Fit

### Mathematics

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Coordinate points, distance, midpoint, section formula | Coordinate geometry | `math_geometry` | High |
| Circle with tangent, radius, chord, sector | Circles, areas related to circles | `math_geometry`, but arc/tick marks are weak | High |
| Similar triangles, right triangles, height-distance setups | Triangles, trigonometry | `math_geometry` | High |
| Linear/quadratic/trigonometric graphs | Polynomials, functions, calculus | `math_function_plot` | High |
| Number line intervals and inequalities | Linear inequalities, sets | `number_line` | Medium |
| Frequency tables and grouped data | Statistics | `data_table` / `statistics_chart` only if subject route allows | Medium |
| LPP feasible regions | Linear programming | possible via `math_geometry` polygon + boundary segments, but strained | Medium |
| Probability tree diagrams | Probability | future `tree_diagram` | Low |

Best-practice rules:

- Do not repeat point coordinates in the stem if the diagram already places labelled points.
- Use integer coordinates and keep 1 unit margin around all primitives.
- Prefer one load-bearing task per figure: read a slope, identify a tangent, compute a side, or infer a region.
- Avoid geometry needing unsupported marks such as equal-side ticks or parallel markers unless alt text compensates.

Immediate exemplar candidates:

- Circle tangent-radius: point of contact T, centre O, tangent PT, ask for angle OTP or tangent length.
- Height-distance triangle: tower, shadow, angle of elevation, ask for height or distance.
- LPP feasible region: shaded polygon with boundary labels, ask for feasible point or objective value.
- Class 10 statistics table: grouped data with class intervals and frequencies, ask for median class or mean setup.

Future renderer candidates:

- `geometry_diagram` with arcs, ticks, parallel marks, perpendicular squares, and better angle labels.
- `tree_diagram` for probability.
- `lpp_region` if feasible-region examples become common.

### Science, Physics, And Biology

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Simple circuits with bulbs, switches, ammeters, voltmeters | Electricity | `physics_diagram:circuit` | High |
| Ray diagrams for lenses and mirrors | Light, ray optics | `physics_diagram:ray_optics` | High |
| Free body diagrams | Force and motion | `physics_diagram:free_body` | Medium |
| Motion graphs | Motion | `math_function_plot` | High |
| Chemical equations and reaction types | Reactions | `chemistry_reaction` | High |
| Classification/process tables | Microorganisms, materials, biology processes | `data_table` | High |
| Cell, flower, reproduction, human body diagrams | Biology | future `biology_diagram` | High |
| Pedigree charts, DNA, food webs, ecological pyramids | Biology 10-12 | future `biology_diagram` / `process_diagram` | High |
| Field lines, phasors, wave optics | Physics 12 | future physics renderers | Medium |

Best-practice rules:

- Use current physics renderers for school-level electricity and optics before inventing prose diagrams.
- For biology, prefer `data_table` or self-contained null visual until a real biology renderer exists.
- For middle-school science, avoid dense Class 12 diagrams; keep visuals concrete and labelled.

Immediate exemplar candidates:

- Circuit with open switch and bulb: ask whether the bulb glows.
- Circuit with ammeter in series and voltmeter across resistor.
- Convex mirror ray optics example.
- More Class 10 Science `data_table` examples: nutrition modes, metals vs non-metals, excretory products, hormone/function comparison.

Future renderer candidates:

- `biology_diagram` subKinds: `cell`, `flower`, `human_system`, `pedigree`, `dna_process`, `food_chain`, `ecological_pyramid`.
- `physics_field_diagram` for electric and magnetic field lines.
- `physics_wave_diagram` for interference, diffraction, and standing waves.
- `process_diagram` for cross-subject step flows.

### Chemistry

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Organic structures and functional groups | Organic chemistry | `chemistry_molecule` | High |
| Reaction equations with conditions | Organic and inorganic reactions | `chemistry_reaction` | High |
| Reaction prediction / conversion sequences | Organic chemistry | `chemistry_reaction`, sometimes multiple exemplars | High |
| Physical chemistry data tables | Solutions, kinetics, electrochemistry | `data_table` is not currently allowed for Chemistry | Medium |
| Coordination compound geometry | Coordination compounds | future `chemistry_coordination` | Medium |
| Electrochemical cell diagrams | Electrochemistry | future `chemistry_cell_diagram` | High |
| Mechanism arrows | Organic mechanisms | future `chemistry_mechanism` | Medium |

Best-practice rules:

- Keep SMILES simple, parseable, and aligned with the stem.
- Do not use `display: "3d"` as a teaching exemplar unless the renderer limitation is explicitly accepted.
- For equations, use mhchem syntax: `H2O`, not `H_2O`.
- Do not let captions reveal the product if the question asks students to predict it.

Immediate exemplar candidates:

- Aromatic substitution reaction equation with conditions.
- Redox reaction equation with oxidation-state reasoning.
- Equilibrium reaction with `<=>`.
- Chemistry data-table examples only if Chemistry visual policy is expanded to include `data_table`.

Future renderer candidates:

- `chemistry_cell_diagram` for galvanic/electrolytic cells.
- `chemistry_coordination` for octahedral/tetrahedral/square-planar complexes.
- `chemistry_mechanism` for curved arrows and intermediates.

### Accountancy

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Journal entries | Transactions, shares, debentures | `accountancy_table:journal_entry` | High |
| Ledger / T-account | Posting, revaluation, realization | `accountancy_table:ledger` | High |
| Trial balance | Rectification and final accounts | `accountancy_table:trial_balance` | High |
| Balance sheet | Financial statements | `accountancy_table:balance_sheet` | High |
| P&L / trading account | Final accounts | `accountancy_table:p_and_l` | High |
| Cash book | Special purpose books | `accountancy_table:cash_book` | Medium |
| Rectification entries | Rectification of errors | `accountancy_table:rectification` | Medium |
| Partnership capital accounts | Partnership firms | `data_table` workaround or future renderer | High |
| Cash flow classification | Cash flow statement | `data_table` workaround | Medium |
| Ratio analysis table | Financial analysis | `data_table` workaround | Medium |

Best-practice rules:

- Every complete table must balance or reconcile.
- If the student is supposed to fill a blank, leave only the assessed cells blank.
- Use plain numeric amounts in specs; renderer handles rupee formatting.
- Prefer board-style terms: Revaluation A/c, Realisation A/c, Partners' Capital A/c, Share Forfeiture A/c.

Immediate exemplar candidates:

- Share forfeiture and reissue journal skeleton.
- Revaluation account ledger.
- Partners' capital account using available ledger/table workaround.
- Cash flow classification table.
- Ratio analysis table.

Future renderer candidates:

- `partnership_capital_account`.
- `cash_flow_statement`.
- `ratio_analysis_table`.
- Rich `accountancy_statement` with working notes.

### Economics And Statistics

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Demand and supply equilibrium | Microeconomics | `economics_curve` | High |
| Price ceiling/floor | Market equilibrium applications | `economics_curve` with horizontal policy line | High |
| PPC/PPF | Intro economics | `economics_curve` | High |
| Budget line / indifference curve | Consumer equilibrium | `economics_curve`, but curves are approximate | Medium |
| Cost/revenue curves | Producer theory | `economics_curve` | Medium |
| AD-AS | Macroeconomics | `economics_curve` | Medium |
| Histogram, frequency polygon, ogive | Statistics | `statistics_chart` | High |
| Scatter/correlation | Correlation | `statistics_chart:scatter` | High |
| Lorenz curve | Dispersion / inequality | `statistics_chart:line` or future renderer | Medium |
| Index number table | Index numbers | `data_table` | Medium |

Best-practice rules:

- `economics_curve.curves[].expr` must use `p` as the horizontal variable per renderer convention.
- Marks must be mathematically consistent with curves.
- Captions should say what relationship is plotted, not the conclusion.
- For ogives, add both `less_than` and `more_than` examples.

Immediate exemplar candidates:

- Correct existing PPF point inconsistency.
- Price floor/ceiling diagram.
- More-than ogive.
- Budget-line diagram.
- Lorenz curve using `statistics_chart:line` if acceptable.

Future renderer candidates:

- `economics_diagram` with equilibrium projection lines, shift arrows, price controls, labels, and shaded surplus/shortage.
- `statistics_lorenz_curve`.

### English

Common exam visual/stimulus patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Unseen factual/discursive passages | Reading comprehension | `english_passage` | High |
| Poetry extracts | Literature | `english_passage` | High |
| Reference-to-context prose/play extracts | Literature | `english_passage` | High |
| Dialogue extracts | Drama / grammar | `english_passage` | Medium |
| Notice/email/letter/report formats | Writing skills | `english_passage` or `data_table` workaround | High |
| Editing/omission tables | Grammar | `data_table`, but English policy does not allow it today | Medium |

Best-practice rules:

- Use original short excerpts, not copyrighted textbook lines.
- Do not put interpretation in alt text.
- Include line numbers whenever the question references a line.
- Keep extracts short enough for prompt budget.

Immediate exemplar candidates:

- Factual passage with 5-7 numbered lines and one inference question.
- Dialogue extract.
- Notice format / email skeleton as `english_passage`.

Future renderer candidates:

- `writing_format` for notice, email, formal letter, report, article, speech, debate.
- `editing_table` for omission/correction exercises.

### Social Science

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Map-based questions | Geography, History | future `map_visual` | High |
| Source extracts | History, Civics, Economics | future `source_extract`; `english_passage` workaround if policy expands | High |
| Picture/cartoon interpretation | History, Civics | future `image_prompt` or curated illustration renderer | Medium |
| Timelines | History | future `timeline` | Medium |
| Statistical comparison tables | Economics, Geography | `data_table` if policy expands | Medium |

Best-practice rules:

- Do not invent current political/statistical facts unless grounded.
- Map tasks need accessible alternatives and region labels.
- Source extracts should be original or grounded, not copied from textbooks.

Immediate exemplar candidates:

- None under current subject routing unless Social Science gets visual policy support.
- If visual policy expands, start with `data_table` and `english_passage`-style source extracts.

Future renderer candidates:

- `map_visual` with point/region labels and accessible textual alternative.
- `timeline`.
- `source_extract`.

### Business Studies

Common exam visual patterns:

| Pattern | Typical topics | Current fit | Priority |
|---|---|---|---|
| Case-study stimulus | Management, marketing, finance | future `source_extract`; text-only today | High |
| Organisation charts | Organising | future `org_chart` | High |
| Flowcharts | Planning, staffing, controlling | future `flowchart` | Medium |
| Maslow pyramid | Motivation | future `pyramid_diagram` | Medium |
| Comparison tables | Forms of business, markets | `data_table` if policy expands | Medium |

Best-practice rules:

- Visuals should test concept identification/application, not founder/name trivia.
- Case-stimulus visuals should not reveal the management principle in the caption.

Immediate exemplar candidates:

- None under current subject routing unless Business Studies gets visual policy support.
- If policy expands, use `data_table` for comparison tables and source/case extract renderer when available.

Future renderer candidates:

- `flowchart`.
- `org_chart`.
- `pyramid_diagram`.
- `source_extract`.

## Current Exemplar Quality Audit

High-priority fixes:

1. ~~Correct the PPF exemplar. The point labelled as an inefficient output should sit inside the frontier, not above it.~~ ✅
2. ~~Rework the monopoly curve marks so `Q*` appears on the horizontal-axis quantity and `P*` appears on the demand/AR curve at that output, or change the stem to avoid projection ambiguity.~~ ✅
3. ~~Fix the sine plot caption: the current range is about two periods, not one full period.~~ ✅
4. ~~Review examples where the stem restates most of the visual data; move data into the visual where possible.~~ ✅ (enrichment pass + caption tightening)

Medium-priority fixes:

1. ~~Add subject tags for overlap cases where appropriate, especially Science-friendly physics and chemistry examples.~~ ✅
2. ~~Avoid `display: "3d"` in chemistry exemplars until the renderer genuinely supports 3D or the limitation is explicitly documented in prompts/tests.~~ ✅
3. ~~Add examples for renderer component coverage: bulb, switch, ammeter, voltmeter, convex mirror, more-than ogive.~~ ✅

Low-priority polish:

1. Diversify chemistry stems so they do not all follow the same "identify/name the compound" template.
2. Diversify English passages with factual, dialogue, and writing-format examples.
3. Keep total prompt footprint in mind; more examples only matter if selection can surface them.

## Immediate Current-Schema Backlog

Priority 0: fix existing risky examples.

- ~~Correct PPF geometry and stem.~~ ✅
- ~~Clarify monopoly marks or simplify the exemplar.~~ ✅
- ~~Correct sine caption.~~ ✅

Priority 1: fill missing supported components.

- ~~Physics circuit with bulb + open/closed switch.~~ ✅
- ~~Physics circuit with ammeter in series and voltmeter across resistor.~~ ✅
- ~~Physics ray optics with convex mirror.~~ ✅
- ~~Statistics more-than ogive.~~ ✅

Priority 2: add high-yield board-style exemplars.

- ~~Mathematics tangent-radius / chord theorem.~~ ✅
- ~~Mathematics height-distance trigonometry setup.~~ ✅
- ~~Mathematics LPP feasible region using `math_geometry`.~~ ✅
- ~~Chemistry equilibrium/redox mhchem example.~~ ✅
- ~~Accountancy share forfeiture journal.~~ ✅
- ~~Accountancy revaluation account ledger.~~ ✅
- Accountancy ratio-analysis `data_table` if Accountancy visual policy expands to allow `data_table`.
- ~~Economics price ceiling/floor.~~ ✅
- ~~Economics budget line.~~ ✅
- ~~English factual passage and dialogue extract.~~ ✅
- ~~Science nutrition/material classification table.~~ ✅

Priority 3: routing/prompt improvements to consider.

- Allow `data_table` for Chemistry when the topic is physical chemistry, coordination, or electrochemistry data.
- Allow `data_table` for Accountancy only if used for ratio/cash-flow classifications that do not fit `accountancy_table`.
- Consider adding Social Science and Business Studies visual buckets, initially limited to `data_table` and future `source_extract`.

## Future Renderer Roadmap

### Tier 1: strongest student value

- `biology_diagram`: cell, flower, pedigree, DNA/process, food chain, ecological pyramid.
- `map_visual`: labelled India/world maps for Social Science.
- `flowchart`: reusable process steps for Science, Biology, Business Studies, and Social Science.
- `source_extract`: subject-neutral passage/case extract with line numbering, source title, and optional question anchors.

### Tier 2: subject depth

- `physics_field_diagram`: electric and magnetic field line diagrams.
- `physics_wave_diagram`: interference, diffraction, standing waves, and wavefronts.
- `chemistry_cell_diagram`: galvanic and electrolytic cells.
- `chemistry_mechanism`: curved arrows, intermediates, reagents/conditions.
- `economics_diagram`: demand/supply shifts, projections, policy lines, shaded surplus/shortage.

### Tier 3: polish and board-format fidelity

- `writing_format`: notice, formal letter, email, report, article, speech/debate.
- `timeline`: History and Civics chronology without making dates the answer.
- `org_chart`: Business Studies organisation structures.
- `accountancy_statement`: rich multi-section financial statements and working notes.
- `geometry_diagram`: full geometry marks: arcs, ticks, parallel markers, perpendicular markers, labelled sides.

## Verification Design

Existing tests to keep running:

- `pnpm exec vitest run src/lib/practice/visuals/__tests__/exemplars.test.ts`
- `pnpm exec vitest run src/lib/practice/__tests__/visuals-schema.test.ts`
- `pnpm exec vitest run src/lib/practice/__tests__/system-prompt-visuals.test.ts`
- `pnpm exec vitest run tests/components/practice/visuals-renderers.test.tsx`

Recommended test additions:

- ~~Parameterized exemplar coverage test asserting at least one exemplar for:~~ ✅
  - every top-level `QUESTION_VISUAL_KINDS` value.
  - every `statistics_chart.subKind`.
  - every `accountancy_table.subKind`.
  - every `physics_diagram.subKind`.
  - all circuit component types: battery, resistor, bulb, switch, ammeter, voltmeter, wire.
  - all ray optics lens/mirror types: concave mirror, convex mirror, concave lens, convex lens.
- ~~Quality regression tests for:~~ ✅
  - `pickExemplarsForSubject` surfaces subject-local null anchor first.
  - exemplar captions do not contain phrases like "answer", "correct option", or "therefore".
  - every exemplar parses through `questionVisualEnvelopeSchema`.
- ~~Renderer tests for:~~ ✅
  - `MathGeometry` primitives.
  - `MathFunctionPlot` valid and invalid expressions.
  - all `StatisticsChart` subKinds.
  - `ChemistryMolecule` invalid SMILES fallback.
  - all `AccountancyTable` subKinds.

Recommended eval fixtures:

- ~~`tests/eval-visuals/fixtures/mathematics/geometry_tangent.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/mathematics/lpp_region.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/physics/circuit_measurement.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/physics/convex_mirror.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/chemistry/reaction_conditions.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/accountancy/share_forfeiture.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/economics/price_floor.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/statistics/more_than_ogive.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/english/dialogue_extract.json`~~ ✅
- ~~`tests/eval-visuals/fixtures/science/classification_table.json`~~ ✅

## Recommended Implementation Order

1. Fix risky current exemplars.
2. Add missing supported component examples.
3. Add high-yield current-schema exemplars by subject.
4. Add coverage tests so future enrichments cannot regress.
5. Decide whether to expand visual policy for `data_table` in Chemistry, Accountancy, Social Science, and Business Studies.
6. Start a separate design/RFC for Tier 1 future renderers.

