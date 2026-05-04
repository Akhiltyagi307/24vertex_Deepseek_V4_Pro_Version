/**
 * CJS preload (`node --require ./_preview-cjs-loader.cjs ...`) that intercepts
 * resolution of the `server-only` package and replaces it with the local
 * no-op shim. tsx transpiles `.ts` files and runs them through the CJS loader,
 * so `import "server-only"` ends up as `require("server-only")` — that path
 * cannot be reached by an ESM module-resolution hook, hence this CJS-side
 * monkey-patch.
 */
const Module = require("node:module");
const path = require("node:path");

const SHIM_PATH = path.resolve(__dirname, "_preview-cjs-shim.cjs");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
	if (request === "server-only") return SHIM_PATH;
	return original.call(this, request, parent, ...rest);
};
