#!/usr/bin/env node
/**
 * Compare .env.example keys with Vercel project environment variables.
 *
 * Usage (after `vercel login` or with VERCEL_TOKEN set):
 *   node scripts/compare-vercel-env.mjs
 *   node scripts/compare-vercel-env.mjs --team team_xxx --project prj_xxx
 *
 * Does not print secret values.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Keys that .env.example marks as local/CI only — not expected on Vercel. */
const SKIP_ON_VERCEL = new Set([
	"ADMIN_PASSWORD",
	"PLAYWRIGHT_BASE_URL",
	"PLAYWRIGHT_ADMIN_EMAIL",
	"PLAYWRIGHT_ADMIN_PASSWORD",
	"PLAYWRIGHT_E2E_TARGET_USER_ID",
	"PLAYWRIGHT_USER_EMAIL",
	"PLAYWRIGHT_USER_PASSWORD",
	"PLAYWRIGHT_STUDENT_EMAIL",
	"PLAYWRIGHT_STUDENT_PASSWORD",
	"PLAYWRIGHT_STUDENT_USER_ID",
	"PLAYWRIGHT_PARENT_EMAIL",
	"PLAYWRIGHT_PARENT_PASSWORD",
	"PLAYWRIGHT_TEACHER_EMAIL",
	"PLAYWRIGHT_TEACHER_PASSWORD",
	"PLAYWRIGHT_PANIC_TOKEN",
	"PLAYWRIGHT_ADMIN_TOTP_SECRET",
	"PLAYWRIGHT_ADMIN_TOTP",
	"PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP",
	"PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS",
	"PLAYWRIGHT_START_WEBSERVER",
	"DEEPSEEK_TIMING_SUBJECT_CAP",
]);

function parseEnvExample(filePath) {
	const text = readFileSync(filePath, "utf8");
	const active = new Set();
	const documented = new Set();
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (!t) continue;
		const activeMatch = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
		if (activeMatch) {
			active.add(activeMatch[1]);
			documented.add(activeMatch[1]);
			continue;
		}
		if (t.startsWith("#")) {
			const commented = t.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*)=/);
			if (commented) documented.add(commented[1]);
		}
	}
	return { active, documented };
}

function loadProjectIds() {
	try {
		const raw = readFileSync(join(root, ".vercel", "project.json"), "utf8");
		const { projectId, orgId } = JSON.parse(raw);
		return { projectId, teamId: orgId };
	} catch {
		return {};
	}
}

function parseArgs() {
	const args = process.argv.slice(2);
	const out = loadProjectIds();
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--project" && args[i + 1]) out.projectId = args[++i];
		else if (args[i] === "--team" && args[i + 1]) out.teamId = args[++i];
	}
	return out;
}

async function fetchVercelKeys({ projectId, teamId }) {
	const token = process.env.VERCEL_TOKEN?.trim();
	const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
	const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env${query}`;

	if (token) {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vercel API ${res.status}: ${body.slice(0, 200)}`);
		}
		const data = await res.json();
		const rows = Array.isArray(data) ? data : data?.envs ?? [];
		return new Set(rows.map((row) => row.key).filter(Boolean));
	}

	// Fallback: vercel CLI (uses logged-in session; project from .vercel/project.json)
	try {
		const scopeFlag = teamId ? ` --scope ${teamId}` : "";
		const stdout = execSync(`npx --yes vercel@latest env ls${scopeFlag}`, {
			cwd: root,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const keys = new Set();
		for (const line of stdout.split("\n")) {
			const t = line.trim();
			if (!t || t.startsWith(">") || t.startsWith("Vercel CLI") || /^name\s+value/i.test(t)) {
				continue;
			}
			const m = t.match(/^([A-Z][A-Z0-9_]*)\s+/);
			if (m) keys.add(m[1]);
		}
		if (keys.size === 0) {
			throw new Error("vercel env ls returned no keys (not logged in?)");
		}
		return keys;
	} catch (e) {
		throw new Error(
			`Could not list Vercel env vars. Run \`vercel login\` or set VERCEL_TOKEN. (${e.message})`,
		);
	}
}

function printSection(title, keys) {
	if (keys.length === 0) {
		console.log(`\n## ${title}\n(none)\n`);
		return;
	}
	console.log(`\n## ${title} (${keys.length})\n`);
	for (const k of keys) console.log(`- ${k}`);
}

async function main() {
	const { projectId, teamId } = parseArgs();
	if (!projectId) {
		console.error("Missing project id. Link with `vercel link` or pass --project prj_...");
		process.exit(1);
	}

	const examplePath = join(root, ".env.example");
	const { active, documented } = parseEnvExample(examplePath);
	const expectedOnVercel = [...active].filter((k) => !SKIP_ON_VERCEL.has(k)).sort();

	console.log(`Project: ${projectId}`);
	console.log(`Team: ${teamId ?? "(personal)"}`);
	console.log(`.env.example: ${active.size} active keys, ${documented.size} documented (incl. commented)`);
	console.log(`Expected on Vercel (active minus local-only): ${expectedOnVercel.length}`);

	const vercelKeys = await fetchVercelKeys({ projectId, teamId });
	const vercelSorted = [...vercelKeys].sort();

	const missingOnVercel = expectedOnVercel.filter((k) => !vercelKeys.has(k));
	const extraOnVercel = vercelSorted.filter((k) => !documented.has(k));
	const onVercelButCommentedOnly = vercelSorted.filter((k) => documented.has(k) && !active.has(k));
	const playwrightOnVercel = vercelSorted.filter((k) => SKIP_ON_VERCEL.has(k));

	printSection("Missing from Vercel (in .env.example, expected on deploy)", missingOnVercel);
	printSection("Extra on Vercel (not documented in .env.example)", extraOnVercel);
	printSection("On Vercel but only commented in .env.example", onVercelButCommentedOnly);
	printSection("On Vercel but marked local-only in .env.example", playwrightOnVercel);
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
