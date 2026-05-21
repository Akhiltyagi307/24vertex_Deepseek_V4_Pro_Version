const path = require("node:path");

/** Next.js dev server managed by PM2 (survives closing the terminal; optional `pm2 startup` for reboot).
 *  Uses **default Turbopack** (`pnpm dev`). Next.js 16.2 + Webpack dev (`NEXT_DEV_WEBPACK=1`) can emit HTML that
 *  references `/_next/static/css/app/layout.css` which never resolves → totally unstyled pages (Tailwind absent).
 *  `scripts/next-dev.mjs` clears `.next/dev` on each start unless `NEXT_DEV_PRESERVE_DEV_CACHE=true`.
 *  Middleware watchdog (default on) restarts PM2 if `proxy.ts` compiles but `.next/dev/server/middleware.js` is missing.
 *  Optional: `NEXT_DEV_ROUTES_WATCHDOG=1` in env helps PM2 exit/restart if `.next/dev` corrupts (was webpack-centric).
 */
module.exports = {
	apps: [
		{
			name: "vertex24-dev",
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
			},
		},
	],
};
