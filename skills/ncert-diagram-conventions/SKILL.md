# ncert-diagram-conventions

> NCERT-aligned conventions for math/physics figures emitted as
> `visual.spec` envelopes by the EDU-AI practice generator. Use this skill
> as a reference when validating or repairing a generated test's visuals
> in Pass 2 (the OpenAI Skills validator pass).

## When to read me

When you receive a practice test JSON whose questions carry non-null
`visual` envelopes, read this file BEFORE running the per-spec validator
script (`lint.mjs`) so you know which violations are stylistic and which
are blocking.

## Coordinate-geometry conventions (kind: `math_geometry`)

- Prefer first-quadrant placement when the math allows. Negative-axis
  ranges are fine when the figure is a parabola, sinusoid, or vector
  argument.
- Axes labelled with sans-serif `x` and `y`; arrow head on the positive
  end of each axis.
- Gridlines at integer steps; sub-divisions at single-decimals only when
  the resolution helps the student.
- Triangles are labelled clockwise from the top vertex.
- Angle markers as small arcs with one tick. The current renderer
  approximates the arc with two ray segments (no arc primitive in
  Mafs); accept this for v1.

## Free-body diagrams (kind: `physics_diagram`, subKind: `free_body`)

- Forces drawn from the body's centre (the renderer enforces this).
- Gravity labelled `W` or `mg` and points straight down (`angleDeg: 270`).
- Normal labelled `N` and points perpendicular to the surface.
- Tension labelled `T` along the rope.
- Friction labelled `f` opposing motion.
- Applied force labelled `F`.

## Ray optics (kind: `physics_diagram`, subKind: `ray_optics`)

- Principal axis horizontal.
- Object as upright arrow on the left (positive height, axis x < 0).
- Image rays drawn as dashed arrows (`dashed: true`).
- Focal points labelled `F` (the renderer auto-places markers at
  `lens.x ± lens.focalLength`).
- Lens types in the v1 schema: `concave_mirror`, `convex_mirror`,
  `concave_lens`, `convex_lens`.

## Circuits (kind: `physics_diagram`, subKind: `circuit`)

- Battery as long-line/short-line (the renderer paints the symbol).
- Resistor as zigzag (CBSE preferred). The renderer ships a 4-tooth
  approximation; rectangle-style resistors are not yet supported.
- Bulb as circle with cross.
- Switch as open/closed line. `closed: true` straightens the contact arm.
- Ammeter labelled `A`; voltmeter labelled `V`.
- Wires connect two `nodes` by id; every node referenced by a component
  MUST appear in the `nodes` array.

## Lint output

`lint.mjs` reads a JSON test file from stdin and writes a JSON report to
stdout in the form `{ ok: boolean, violations: [{ index, code, message }] }`.
The report is consumed by Pass 2 to decide whether to call the visual-
fix replacement prompt.
