const path = require("node:path");

/** Next.js dev server managed by PM2 (survives closing the terminal; optional `pm2 startup` for reboot).
 *  Webpack + `NEXT_DEV_WEBPACK_CLEAR_DEV` clears `.next/dev` on each start; `scripts/next-dev.mjs` also
 *  watchdogs `routes-manifest.json` when that env is set so PM2 can auto-restart after rare dev corruption.
 */
module.exports = {
	apps: [
		{
			name: "edu-ai-dev",
			// Run via `node <file>.mjs` so PM2 does not wrap the ESM entry as CJS.
			script: "node",
			args: [path.join(__dirname, "scripts", "next-dev.mjs")],
			cwd: __dirname,
			autorestart: true,
			max_restarts: 50,
			min_uptime: "10s",
			exp_backoff_restart_delay: 500,
			max_memory_restart: "1536M",
			env: {
				NODE_ENV: "development",
				PORT: "3001",
				// Turbopack dev cache can corrupt across restarts (missing manifests / `[turbopack]_runtime.js`).
				// Webpack is slower but stable for a long-lived PM2 process; see `scripts/next-dev.mjs`.
				NEXT_DEV_WEBPACK: "1",
				// Clear `.next/dev` whenever PM2 starts the wrapper so stale/partial dev output
				// (e.g. missing `routes-manifest.json` after internal Next restarts) cannot linger.
				NEXT_DEV_WEBPACK_CLEAR_DEV: "1",
			},
		},
	],
};
