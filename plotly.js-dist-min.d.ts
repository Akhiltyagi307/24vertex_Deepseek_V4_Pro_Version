/**
 * Type shim for `plotly.js-dist-min` — the "-min" variant ships only
 * `plotly.min.js` and no `.d.ts` files. Our box-plot renderer wraps a
 * tiny imperative surface (`newPlot`, `purge`); the rest of the chart
 * library is unused. Cast inside the renderer keeps us type-safe at
 * the call site without committing to a full upstream typing.
 */
declare module "plotly.js-dist-min";
