import { createServer } from "node:net";
import { spawn, execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import fs from "node:fs";
import httpModule from "node:http";

const execFileAsync = promisify(execFile);

/** iCloud-synced Documents folders can evict or duplicate `.next/dev` mid-compile → ENOENT on manifests. */
function excludeNextFromICloudIfDarwin() {
	if (process.platform !== "darwin") return;
	const nextRoot = resolve(process.cwd(), ".next");
	try {
		fs.mkdirSync(nextRoot, { recursive: true });
		execFileSync("xattr", ["-w", "com.apple.fileprovider.ignore#P", "1", nextRoot], {
			stdio: "ignore",
		});
	} catch {
		/* not on iCloud or xattr unavailable */
	}
}

const port = Number(process.env.PORT) || 3001;

/** macOS Finder / iCloud sometimes duplicates `.next/dev` as `dev 2`, `dev 4`, etc. */
function removeStaleNextDevArtifacts() {
	const nextRoot = resolve(process.cwd(), ".next");
	if (!fs.existsSync(nextRoot)) return;
	for (const name of fs.readdirSync(nextRoot)) {
		if (/^dev \d+$/.test(name) || /^server \d+$/.test(name)) {
			try {
				fs.rmSync(resolve(nextRoot, name), { recursive: true, force: true });
				console.warn(`[next-dev] removed stale .next/${name}`);
			} catch (e) {
				console.warn(`[next-dev] could not remove .next/${name}:`, e?.message ?? e);
			}
		}
	}
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function appendNoProxyEntry(existing, entry) {
	const parts = (existing ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.includes(entry)) return parts.join(",");
	return [...parts, entry].join(",");
}

function buildDevEnv() {
	const env = { ...process.env, PORT: String(port) };
	const proxyKeys = [
		"HTTP_PROXY",
		"HTTPS_PROXY",
		"ALL_PROXY",
		"http_proxy",
		"https_proxy",
		"all_proxy",
		"SOCKS_PROXY",
		"SOCKS5_PROXY",
		"socks_proxy",
		"socks5_proxy",
	];
	const hadProxy = proxyKeys.some((key) => Boolean(env[key]));
	// Preserve proxy env vars by default. Some networks require them for DNS resolution
	// and removing them can cause ENOTFOUND for Supabase/Auth callback fetches.
	// Use NO_PROXY to keep local and Supabase traffic direct when possible.
	env.NO_PROXY = appendNoProxyEntry(env.NO_PROXY, "localhost");
	env.NO_PROXY = appendNoProxyEntry(env.NO_PROXY, "127.0.0.1");
	env.NO_PROXY = appendNoProxyEntry(env.NO_PROXY, ".supabase.co");
	env.no_proxy = appendNoProxyEntry(env.no_proxy ?? env.NO_PROXY, "localhost");
	env.no_proxy = appendNoProxyEntry(env.no_proxy, "127.0.0.1");
	env.no_proxy = appendNoProxyEntry(env.no_proxy, ".supabase.co");
	if (hadProxy) {
		console.warn("Detected proxy env vars; preserving them and setting NO_PROXY for localhost + Supabase.");
	}
	// macOS + Turbopack/Watchpack often hits EMFILE with default soft NOFILE; native fs.watch can wedge or 404 routes.
	// Polling trades a little CPU for far fewer watch descriptors. Opt out if you have raised limits and prefer native watch.
	const nativeFsWatch =
		env.NEXT_DEV_NATIVE_FS_WATCH === "1" || env.NEXT_DEV_NATIVE_FS_WATCH === "true";
	if (process.platform === "darwin" && !nativeFsWatch) {
		if (!env.WATCHPACK_POLLING) env.WATCHPACK_POLLING = "true";
		if (!env.CHOKIDAR_USEPOLLING) env.CHOKIDAR_USEPOLLING = "true";
	}
	return env;
}

function isPortFree(p) {
	return new Promise((resolveFree) => {
		const s = createServer();
		s.once("error", () => resolveFree(false));
		s.listen(p, "localhost", () => {
			s.close(() => resolveFree(true));
		});
	});
}

/** PIDs with a TCP listener on `port` (macOS / Linux: lsof). */
async function listenPids(p) {
	if (process.platform === "win32") return [];
	try {
		const { stdout } = await execFileAsync(
			"lsof",
			["-tiTCP:" + String(p), "-sTCP:LISTEN"],
			{ encoding: "utf8" },
		);
		return stdout
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map(Number)
			.filter((n) => Number.isFinite(n));
	} catch {
		return [];
	}
}

async function processArgs(pid) {
	if (process.platform === "win32") return "";
	try {
		const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "args="], {
			encoding: "utf8",
		});
		return stdout.trim();
	} catch {
		return "";
	}
}

/** If something on `port` looks like `next dev`, SIGTERM (then SIGKILL) so we can bind. */
async function clearStaleNextDevOnPort(p) {
	const pids = await listenPids(p);
	const nextDevPids = [];
	for (const pid of pids) {
		if (pid === process.pid) continue;
		const args = await processArgs(pid);
		// `ps` shows e.g. `next-server (v16.2.3)` for the dev listener, not `next dev`.
		if (/\bnext-server\b/.test(args) || (/\bnext\b/.test(args) && /\bdev\b/.test(args))) {
			nextDevPids.push(pid);
		}
	}
	if (!nextDevPids.length) return false;
	console.warn(
		`Port ${p} is held by a previous Next.js dev server (PID ${nextDevPids.join(", ")}). Stopping it…`,
	);
	for (const pid of nextDevPids) {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			/* ignore */
		}
	}
	for (let i = 0; i < 30; i++) {
		await sleep(100);
		if (await isPortFree(p)) return true;
	}
	for (const pid of nextDevPids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			/* ignore */
		}
	}
	await sleep(200);
	return isPortFree(p);
}

if (!(await isPortFree(port))) {
	const cleared = await clearStaleNextDevOnPort(port);
	if (!cleared && !(await isPortFree(port))) {
		console.error(
			`\nPort ${port} is already in use.\n` +
				(process.platform === "win32"
					? "Stop the other process or set PORT to a free port and update NEXT_PUBLIC_APP_URL.\n"
					: `Inspect:  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
						`Free it:  kill $(lsof -tiTCP:${port} -sTCP:LISTEN)\n`),
		);
		process.exit(1);
	}
}

const nextCli = resolve(process.cwd(), "node_modules/next/dist/bin/next");
if (!fs.existsSync(nextCli)) {
	console.error("Cannot find Next.js CLI at node_modules/next. Run your package manager install from the project root.");
	process.exit(1);
}

// Bind IPv4 so `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` (and Playwright’s localhost→127.0.0.1 normalize) can connect.
// `-H localhost` alone often listens only on ::1, which yields ECONNREFUSED from IPv4 clients.
const devArgs = ["dev", "-H", "127.0.0.1", "-p", String(port)];
// Turbopack default in Next 16 can leave `.next/dev` in a bad state (e.g. missing
// `chunks/ssr/[turbopack]_runtime.js` while `pages/_document.js` still requires it).
// `pnpm run dev:clean` fixes that; `NEXT_DEV_WEBPACK=1` opts into webpack dev instead.
const useWebpack =
	process.env.NEXT_DEV_WEBPACK === "1" || process.env.NEXT_DEV_WEBPACK === "true";
removeStaleNextDevArtifacts();
excludeNextFromICloudIfDarwin();
if (useWebpack) {
	console.warn(
		"\n[next-dev] NEXT_DEV_WEBPACK: webpack dev can serve HTML without Tailwind/global CSS " +
			"(missing `/_next/static/css/app/layout.css`). If the UI is unstyled, stop webpack mode or run `pnpm run dev:clean`.\n",
	);
	const clearWebpackDev =
		process.env.NEXT_DEV_WEBPACK_CLEAR_DEV === "1" ||
		process.env.NEXT_DEV_WEBPACK_CLEAR_DEV === "true";
	if (clearWebpackDev) {
		const devOut = resolve(process.cwd(), ".next/dev");
		try {
			if (fs.existsSync(devOut)) {
				fs.rmSync(devOut, { recursive: true, force: true });
			}
		} catch (e) {
			console.warn("Could not remove .next/dev (continuing):", e?.message ?? e);
		}
	}
	devArgs.push("--webpack");
	console.warn("NEXT_DEV_WEBPACK: using webpack dev (slower but avoids Turbopack chunk glitches).");
} else {
	// Turbopack can also leave per-route artifacts missing (e.g. ENOENT on
	// `.next/dev/server/app/.../build-manifest.json`) after interrupted compiles or
	// stale processes. Clearing dev output before start avoids that class of errors.
	const preserve =
		process.env.NEXT_DEV_PRESERVE_DEV_CACHE === "1" ||
		process.env.NEXT_DEV_PRESERVE_DEV_CACHE === "true";
	if (!preserve) {
		const devOut = resolve(process.cwd(), ".next/dev");
		try {
			if (fs.existsSync(devOut)) {
				fs.rmSync(devOut, { recursive: true, force: true });
			}
		} catch (e) {
			console.warn("Could not remove .next/dev (continuing):", e?.message ?? e);
		}
	}
}
const env = buildDevEnv();

/**
 * macOS/Linux dev often hits EMFILE from Turbopack/Watchpack when the soft `ulimit -n`
 * is low (256), which breaks file watching and can surface as 404s on normal routes.
 * Bump NOFILE in the child shell when possible; Windows keeps a direct spawn.
 * On macOS, `buildDevEnv` also sets Watchpack/Chokidar polling unless NEXT_DEV_NATIVE_FS_WATCH=1.
 */
function spawnNextDev() {
	if (process.platform === "win32") {
		return spawn(process.execPath, [nextCli, ...devArgs], { stdio: "inherit", env });
	}
	const q = (s) => JSON.stringify(s);
	const shellCmd =
		`ulimit -n 65536 2>/dev/null || ulimit -n 32768 2>/dev/null || ulimit -n 16384 2>/dev/null || ulimit -n 10240 2>/dev/null || ulimit -n 4096 2>/dev/null || true; exec ${q(process.execPath)} ${q(nextCli)} ${devArgs.map(q).join(" ")}`;
	return spawn("sh", ["-c", shellCmd], { stdio: "inherit", env });
}

const child = spawnNextDev();

/** Exit if `routes-manifest.json` vanishes after a good compile so PM2 can restart with a clean `.next/dev`. */
const routesManifestWatchdog =
	process.env.NEXT_DEV_ROUTES_WATCHDOG !== "0" &&
	process.env.NEXT_DEV_ROUTES_WATCHDOG !== "false";

/**
 * Legacy check for missing middleware output. Turbopack HMR can briefly drop chunk files and
 * cause false restarts; prefer the routes-manifest watchdog. Opt in with NEXT_DEV_MIDDLEWARE_WATCHDOG=1.
 */
const middlewareWatchdog =
	process.env.NEXT_DEV_MIDDLEWARE_WATCHDOG === "1" ||
	process.env.NEXT_DEV_MIDDLEWARE_WATCHDOG === "true";
const hasRootProxy = fs.existsSync(resolve(process.cwd(), "proxy.ts"));

if (middlewareWatchdog && hasRootProxy) {
	const middlewareJs = resolve(process.cwd(), ".next/dev/server/middleware.js");
	const turbopackRuntime = resolve(
		process.cwd(),
		".next/dev/server/chunks/[turbopack]_runtime.js",
	);
	const tickMs = Number(process.env.NEXT_DEV_MIDDLEWARE_WATCHDOG_MS) || 3000;
	const missingThreshold = Number(process.env.NEXT_DEV_MIDDLEWARE_WATCHDOG_MISSING_TICKS) || 4;
	const bootGraceMs = Number(process.env.NEXT_DEV_MIDDLEWARE_WATCHDOG_BOOT_GRACE_MS) || 90_000;
	let sawMiddleware = false;
	let consecutiveMissing = 0;
	let childBootTime = Date.now();
	let middlewareWatchdogExiting = false;

	child.on("spawn", () => {
		childBootTime = Date.now();
	});

	function exitForMissingMiddleware(reason) {
		if (middlewareWatchdogExiting) return;
		middlewareWatchdogExiting = true;
		console.error(
			`next-dev middleware watchdog: ${reason} Exiting so the process supervisor can restart with a clean .next/dev.`,
		);
		try {
			child.kill("SIGTERM");
		} catch {
			/* ignore */
		}
		setTimeout(() => process.exit(1), 1500);
	}

	const middlewareInterval = setInterval(() => {
		if (middlewareWatchdogExiting) return;
		const ok =
			fs.existsSync(middlewareJs) && fs.existsSync(turbopackRuntime);
		if (ok) {
			sawMiddleware = true;
			consecutiveMissing = 0;
			return;
		}
		if (!sawMiddleware && Date.now() - childBootTime < bootGraceMs) return;
		consecutiveMissing++;
		if (consecutiveMissing >= missingThreshold) {
			clearInterval(middlewareInterval);
			exitForMissingMiddleware(
				`proxy.ts is present but compiled middleware output is missing (${consecutiveMissing} checks, ~${(consecutiveMissing * tickMs) / 1000}s).`,
			);
		}
	}, tickMs);

	process.on("exit", () => clearInterval(middlewareInterval));
}

if (routesManifestWatchdog) {
	const routesManifestPath = resolve(process.cwd(), ".next/dev/routes-manifest.json");
	const tickMs = Number(process.env.NEXT_DEV_ROUTES_WATCHDOG_MS) || 5000;
	const missingThreshold = Number(process.env.NEXT_DEV_ROUTES_WATCHDOG_MISSING_TICKS) || 5;
	const bootGraceMs = Number(process.env.NEXT_DEV_ROUTES_WATCHDOG_BOOT_GRACE_MS) || 60_000;
	let sawRoutesManifest = false;
	let consecutiveMissing = 0;
	let childBootTime = Date.now();

	child.on("spawn", () => {
		childBootTime = Date.now();
	});

	let watchdogExiting = false;
	function exitForCorruptDevOutput(reason) {
		if (watchdogExiting) return;
		watchdogExiting = true;
		console.error(`next-dev watchdog: ${reason} Exiting so the process supervisor can restart with a clean .next/dev.`);
		try {
			child.kill("SIGTERM");
		} catch {
			/* ignore */
		}
		setTimeout(() => process.exit(1), 1500);
	}

	const watchdog = setInterval(() => {
		if (watchdogExiting) return;
		const manifestOk = fs.existsSync(routesManifestPath);
		if (manifestOk) {
			sawRoutesManifest = true;
			consecutiveMissing = 0;
			return;
		}
		if (!sawRoutesManifest) return;
		if (Date.now() - childBootTime < bootGraceMs) return;
		consecutiveMissing++;
		if (consecutiveMissing >= missingThreshold) {
			clearInterval(watchdog);
			exitForCorruptDevOutput(
				`.next/dev/routes-manifest.json missing for ${consecutiveMissing} consecutive checks (~${(consecutiveMissing * tickMs) / 1000}s).`,
			);
		}
	}, tickMs);

	process.on("exit", () => clearInterval(watchdog));
}

// ----------------------------------------------------------------------
// HTTP-health watchdog (NEXT_DEV_HTTP_HEALTH_WATCHDOG=1 / unset = enabled)
// ----------------------------------------------------------------------
// The existing routes-manifest + middleware-file watchdogs catch DISK-level
// hangs (Turbopack failing to write outputs). They do NOT catch the
// APPLICATION-layer hang we observed in production today: Turbopack
// accepted TCP but never sent HTTP responses for any route. PM2 thought
// the process was online; manual `kill -9` + restart was required.
//
// This watchdog probes `127.0.0.1:${PORT}/login` every 60s. If no 2xx
// (or 3xx redirect) response arrives within 30s of the probe, AND no
// successful probe has been seen for 120s total, kill the process so
// PM2 respawns. Opt out with `NEXT_DEV_HTTP_HEALTH_WATCHDOG=0`.
{
	const httpWatchdogOpt = (process.env.NEXT_DEV_HTTP_HEALTH_WATCHDOG ?? "1").trim();
	const httpWatchdogOn = httpWatchdogOpt !== "0" && httpWatchdogOpt !== "false";
	if (!httpWatchdogOn) {
		// User opted out; do nothing.
	} else {
		const probeIntervalMs = Number(process.env.NEXT_DEV_HTTP_PROBE_INTERVAL_MS) || 60_000;
		const probeTimeoutMs = Number(process.env.NEXT_DEV_HTTP_PROBE_TIMEOUT_MS) || 30_000;
		const failGraceMs = Number(process.env.NEXT_DEV_HTTP_FAIL_GRACE_MS) || 120_000;
		// First probe waits one full interval so Turbopack has time to compile
		// /login. Once any successful probe arrives, the grace window resets.
		let lastGoodHttpTime = Date.now();
		let httpWatchdogExiting = false;

		const probeOnce = () => {
			const startedAt = Date.now();
			const req = httpModule.request(
				{
					host: "127.0.0.1",
					port: Number(process.env.PORT) || 3001,
					path: "/login",
					method: "GET",
					timeout: probeTimeoutMs,
					headers: { "user-agent": "next-dev-watchdog/1.0" },
				},
				(res) => {
					// 2xx or 3xx = the server is alive enough to route. Drain the
					// body so the socket can be reused.
					res.resume();
					if (res.statusCode != null && res.statusCode < 500) {
						lastGoodHttpTime = Date.now();
					}
				},
			);
			req.on("error", () => {
				// Don't update lastGoodHttpTime — failure to connect counts toward grace.
			});
			req.on("timeout", () => {
				req.destroy();
			});
			req.end();
			// (no return — fire-and-forget; the interval handles cadence)
			void startedAt;
		};

		const httpWatchdog = setInterval(() => {
			if (httpWatchdogExiting) return;
			probeOnce();
			const idleMs = Date.now() - lastGoodHttpTime;
			if (idleMs > failGraceMs) {
				httpWatchdogExiting = true;
				clearInterval(httpWatchdog);
				const log = `[next-dev] HTTP watchdog: no successful probe to /login for ${(idleMs / 1000).toFixed(0)}s — killing child so PM2 respawns.`;
				process.stderr.write(log + "\n");
				try {
					child.kill("SIGKILL");
				} catch {
					/* child may already be dead */
				}
				setTimeout(() => process.exit(1), 1500);
			}
		}, probeIntervalMs);

		process.on("exit", () => clearInterval(httpWatchdog));
	}
}

child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 0);
});
