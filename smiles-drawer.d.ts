/**
 * Type shim for `smiles-drawer` 2.x — the package ships an
 * untyped `app.js` (and one TS source file in `src/`). We only
 * use a tiny surface (`parse` + `SvgDrawer`) and cast inside the
 * renderer, so a single-line shim is enough to silence
 * "Could not find a declaration file" without committing to a
 * full upstream typing.
 *
 * If we expand the surface in v2, replace this with a proper
 * declaration of every used export.
 */
declare module "smiles-drawer";
