import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT) || 3001;
const host = process.env.WAIT_DEV_HOST || "127.0.0.1";
const urlPath = process.env.WAIT_DEV_PATH || "/";
const routesManifestRel =
	process.env.WAIT_DEV_ROUTES_MANIFEST || path.join(".next", "dev", "routes-manifest.json");
const middlewareJsRel =
	process.env.WAIT_DEV_MIDDLEWARE_JS || path.join(".next", "dev", "server", "middleware.js");
const rootProxyPath = path.resolve(process.cwd(), "proxy.ts");
const timeoutMs = Number(process.env.WAIT_DEV_TIMEOUT_MS) || 120_000;
const intervalMs = Number(process.env.WAIT_DEV_INTERVAL_MS) || 2000;

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function requestOnce() {
	return new Promise((resolve) => {
		const req = http.request(
			{ host, port, path: urlPath, method: "GET", timeout: 20_000 },
			(res) => {
				res.resume();
				resolve(res.statusCode ?? 0);
			},
		);
		req.on("timeout", () => {
			req.destroy(new Error("timeout"));
		});
		req.on("error", () => resolve(0));
		req.end();
	});
}

const started = Date.now();
const maxAttempts = Math.ceil(timeoutMs / intervalMs) + 2;
let lastCode = 0;
for (let attempt = 0; attempt < maxAttempts; attempt++) {
	const code = await requestOnce();
	lastCode = code;
	const manifestPath = path.resolve(process.cwd(), routesManifestRel);
	const middlewarePath = path.resolve(process.cwd(), middlewareJsRel);
	const needsMiddleware = fs.existsSync(rootProxyPath);
	const middlewareOk = !needsMiddleware || fs.existsSync(middlewarePath);
	const manifestOk = code === 200 && fs.existsSync(manifestPath) && middlewareOk;
	if (manifestOk) {
		console.warn(
			`wait-for-dev-server: ${host}:${port}${urlPath} -> ${code}; ${routesManifestRel} ok${needsMiddleware ? `; ${middlewareJsRel} ok` : ""} (${Date.now() - started}ms)`,
		);
		process.exit(0);
	}
	if (code === 200 && (!fs.existsSync(manifestPath) || !middlewareOk)) {
		lastCode = 590; // synthetic: HTTP ok but dev output incomplete
	}
	if (Date.now() - started > timeoutMs) {
		break;
	}
	console.warn(
		`wait-for-dev-server: ${host}:${port}${urlPath} not ready (status ${lastCode || "n/a"}), retry in ${intervalMs}ms`,
	);
	await sleep(intervalMs);
}
console.error(
	`wait-for-dev-server: gave up after ${timeoutMs}ms (last status ${lastCode || "connect failed"})`,
);
process.exit(1);
