import { createServer } from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

const port = Number(process.env.PORT) || 3001;

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

const child = spawn(
	process.execPath,
	[nextCli, "dev", "-H", "localhost", "-p", String(port)],
	{
		stdio: "inherit",
		env: buildDevEnv(),
	},
);

child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 0);
});
