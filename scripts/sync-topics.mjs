#!/usr/bin/env node
/**
 * Align `public.topics` between Supabase dev + production by upserting every row
 * from the source onto the target (same primary keys).
 *
 * Modes:
 *   A) Postgres: dual direct database URLs (batches of INSERT .. ON CONFLICT).
 *   B) REST: production project URL + service role → PostgREST bulk upsert into
 *      `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (typical local .env = dev target).
 *
 * Preconditions (enforced):
 * - Every `subject_id` on copied rows exists on the target (`subjects` must already match).
 *
 * Usage:
 *   node scripts/sync-topics.mjs --dry-run --direction main-to-dev
 *   node scripts/sync-topics.mjs --apply --direction main-to-dev
 *   node scripts/sync-topics.mjs --apply --via-rest --direction main-to-dev
 *
 * Postgres URLs:
 *   TOPICS_SYNC_DEV_DATABASE_URL / TOPICS_SYNC_MAIN_DATABASE_URL
 *   Or TOPIC_CHUNKS_SYNC_* (see sync-topic-context-chunks.mjs)
 *   CLI: --dev-url / --main-url
 *
 * REST (source = main when direction is main-to-dev):
 *   TOPICS_SYNC_MAIN_SUPABASE_URL (e.g. https://xxxx.supabase.co)
 *   TOPICS_SYNC_MAIN_SERVICE_ROLE_KEY
 *
 * Direction:
 *   main-to-dev  (recommended)
 *   dev-to-main  (destructive on production — use with care)
 */

import crypto from "node:crypto";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: false });

const BATCH = 200;
const REST_PAGE = /** @type {const} */ (1000);
const REST_UPSERT_BATCH = 300;

/** @typedef {{ dryRun: boolean, apply: boolean, viaRest: boolean, direction: 'main-to-dev'|'dev-to-main', devUrl: string, mainUrl: string }} Args */

/** @returns {Args} */
function parseArgs(argv) {
	const args = {
		dryRun: false,
		apply: false,
		viaRest: false,
		direction: "main-to-dev",
		devUrl: "",
		mainUrl: "",
	};
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--dry-run") args.dryRun = true;
		else if (a === "--apply") args.apply = true;
		else if (a === "--via-rest") args.viaRest = true;
		else if (a === "--direction" && argv[i + 1]) {
			args.direction = /** @type {Args['direction']} */ (argv[++i]);
		} else if (a === "--dev-url" && argv[i + 1]) args.devUrl = argv[++i];
		else if (a === "--main-url" && argv[i + 1]) args.mainUrl = argv[++i];
		else if (a === "--help" || a === "-h") {
			console.log("See header comment in scripts/sync-topics.mjs");
			process.exit(0);
		}
	}

	if (!["main-to-dev", "dev-to-main"].includes(args.direction)) {
		console.error("--direction must be one of: main-to-dev, dev-to-main");
		process.exit(1);
	}

	if (args.apply && args.dryRun) {
		console.error("Use either --apply or --dry-run, not both.");
		process.exit(1);
	}

	if (!args.apply && !args.dryRun) {
		args.dryRun = true;
		console.warn("(no flag) defaulting to --dry-run. Pass --apply to write.");
	}

	if (!args.viaRest) {
		const devUrl =
			args.devUrl ||
			process.env.TOPICS_SYNC_DEV_DATABASE_URL ||
			process.env.TOPIC_CHUNKS_SYNC_DEV_DATABASE_URL ||
			process.env.TOPIC_CHUNKS_DEV_DATABASE_URL ||
			"";

		const mainUrl =
			args.mainUrl ||
			process.env.TOPICS_SYNC_MAIN_DATABASE_URL ||
			process.env.TOPIC_CHUNKS_SYNC_MAIN_DATABASE_URL ||
			process.env.TOPIC_CHUNKS_MAIN_DATABASE_URL ||
			"";

		if (!devUrl || !mainUrl) {
			console.error(
				"Missing database URLs. Set TOPICS_SYNC_DEV_DATABASE_URL and TOPICS_SYNC_MAIN_DATABASE_URL " +
					"(or TOPIC_CHUNKS_SYNC_*), or pass --dev-url / --main-url. Or use --via-rest with production Supabase URL + service role.",
			);
			process.exit(1);
		}

		return { ...args, devUrl, mainUrl };
	}

	if (args.devUrl || args.mainUrl) {
		console.error("--via-rest ignores --dev-url / --main-url (uses REST only).");
		process.exit(1);
	}

	return { ...args, devUrl: "", mainUrl: "" };
}

/** @param {unknown} id */
function idStr(id) {
	return String(id);
}

/** @param {string} url */
function normalizeSupabaseUrl(url) {
	return url.replace(/\/+$/, "");
}

/**
 * @param {string} baseUrl
 * @param {string} serviceKey
 * @returns {Promise<Set<string>>}
 */
async function fetchSubjectIdsRest(baseUrl, serviceKey) {
	const base = normalizeSupabaseUrl(baseUrl);
	const u = new URL(`${base}/rest/v1/subjects`);
	u.searchParams.set("select", "id");
	u.searchParams.set("limit", "10000");
	const res = await fetch(u, {
		headers: {
			apikey: serviceKey,
			Authorization: `Bearer ${serviceKey}`,
			Accept: "application/json",
		},
	});
	if (!res.ok) {
		throw new Error(`[subjects] GET ${res.status}: ${await res.text()}`);
	}
	const rows = /** @type {{ id: unknown }[]} */ (await res.json());
	return new Set(rows.map((r) => idStr(r.id)));
}

/**
 * @param {string} baseUrl
 * @param {string} serviceRoleKey
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function fetchAllTopicsRest(baseUrl, serviceRoleKey) {
	const base = normalizeSupabaseUrl(baseUrl);
	const out = [];
	let offset = 0;
	while (true) {
		const u = new URL(`${base}/rest/v1/topics`);
		u.searchParams.set("select", "*");
		u.searchParams.set("order", "id.asc");
		u.searchParams.set("limit", String(REST_PAGE));
		u.searchParams.set("offset", String(offset));
		const res = await fetch(u, {
			headers: {
				apikey: serviceRoleKey,
				Authorization: `Bearer ${serviceRoleKey}`,
				Accept: "application/json",
			},
		});
		if (!res.ok) {
			throw new Error(`[topics] GET ${res.status}: ${await res.text()}`);
		}
		const rows = /** @type {Record<string, unknown>[]} */ (await res.json());
		if (!rows.length) break;
		out.push(...rows);
		offset += REST_PAGE;
	}
	return out;
}

/** @param {Record<string, unknown>[]} rows */
function stableTopicsFingerprint(rows) {
	const cols = [
		"id",
		"subject_id",
		"grade",
		"unit_name",
		"unit_number",
		"chapter_name",
		"chapter_number",
		"topic_name",
		"topic_number",
		"description",
		"learning_objectives",
		"metadata",
		"is_active",
		"created_at",
		"updated_at",
	];
	const sorted = [...rows].sort((a, b) => idStr(a.id).localeCompare(idStr(b.id)));
	const lines = sorted.map((r) => cols.map((c) => JSON.stringify(r[c] ?? null)).join("\t"));
	return crypto.createHash("md5").update(lines.join("\n")).digest("hex");
}

/**
 * @param {string} targetUrl
 * @param {string} targetKey
 * @param {Record<string, unknown>[]} rows
 * @param {boolean} dryRun
 */
async function upsertTopicsRest(targetUrl, targetKey, rows, dryRun) {
	const targetSubjects = await fetchSubjectIdsRest(targetUrl, targetKey);
	const missing = [];
	for (const r of rows) {
		if (!targetSubjects.has(idStr(r.subject_id))) missing.push(idStr(r.subject_id));
	}
	if (missing.length > 0) {
		const uniq = [...new Set(missing)];
		throw new Error(
			`Abort: ${uniq.length} subject_id(s) from source missing on target (showing up to 8): ` +
				uniq.slice(0, 8).join(", "),
		);
	}

	if (dryRun) {
		console.log(`[REST] dry-run: would upsert ${rows.length} topic row(s).`);
		return;
	}

	const base = normalizeSupabaseUrl(targetUrl);
	for (let i = 0; i < rows.length; i += REST_UPSERT_BATCH) {
		const batch = rows.slice(i, i + REST_UPSERT_BATCH);
		const res = await fetch(`${base}/rest/v1/topics?on_conflict=id`, {
			method: "POST",
			headers: {
				apikey: targetKey,
				Authorization: `Bearer ${targetKey}`,
				"Content-Type": "application/json",
				Prefer: "resolution=merge-duplicates,return=minimal",
			},
			body: JSON.stringify(batch),
		});
		if (!res.ok) {
			throw new Error(`[topics] POST upsert ${res.status}: ${await res.text()}`);
		}
	}
	console.log(`[REST] upserted ${rows.length} topic row(s).`);
}

/**
 * @param {postgres.Sql} source
 * @param {postgres.Sql} target
 * @param {string} label
 * @param {boolean} dryRun
 */
async function syncOneWay(source, target, label, dryRun) {
	const rows = await source`
		SELECT
			id,
			subject_id,
			grade,
			unit_name,
			unit_number,
			chapter_name,
			chapter_number,
			topic_name,
			topic_number,
			description,
			learning_objectives,
			metadata,
			is_active,
			created_at,
			updated_at
		FROM public.topics
		ORDER BY id
	`;

	const targetSubjects = await target`SELECT id FROM public.subjects`;
	const subjectSet = new Set(targetSubjects.map((r) => idStr(r.id)));
	const missingSubjects = [];
	for (const r of rows) {
		if (!subjectSet.has(idStr(r.subject_id))) missingSubjects.push(idStr(r.subject_id));
	}
	if (missingSubjects.length > 0) {
		const uniq = [...new Set(missingSubjects)];
		console.error(
			`[${label}] Abort: ${uniq.length} subject_id(s) from source missing on target (showing up to 8):`,
			uniq.slice(0, 8),
		);
		process.exit(1);
	}

	if (dryRun) {
		console.log(`[${label}] dry-run: would upsert ${rows.length} topic row(s) onto target.`);
		return;
	}

	for (let i = 0; i < rows.length; i += BATCH) {
		const batch = rows.slice(i, i + BATCH);
		await target`
			INSERT INTO public.topics ${target(
				batch,
				"id",
				"subject_id",
				"grade",
				"unit_name",
				"unit_number",
				"chapter_name",
				"chapter_number",
				"topic_name",
				"topic_number",
				"description",
				"learning_objectives",
				"metadata",
				"is_active",
				"created_at",
				"updated_at",
			)}
			ON CONFLICT (id) DO UPDATE SET
				subject_id = EXCLUDED.subject_id,
				grade = EXCLUDED.grade,
				unit_name = EXCLUDED.unit_name,
				unit_number = EXCLUDED.unit_number,
				chapter_name = EXCLUDED.chapter_name,
				chapter_number = EXCLUDED.chapter_number,
				topic_name = EXCLUDED.topic_name,
				topic_number = EXCLUDED.topic_number,
				description = EXCLUDED.description,
				learning_objectives = EXCLUDED.learning_objectives,
				metadata = EXCLUDED.metadata,
				is_active = EXCLUDED.is_active,
				created_at = EXCLUDED.created_at,
				updated_at = EXCLUDED.updated_at
		`;
	}

	console.log(`[${label}] upserted ${rows.length} topic row(s).`);
}

async function fingerprint(sql) {
	const [row] = await sql`
		SELECT md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY id)) AS h
		FROM public.topics t
	`;
	return row?.h ?? null;
}

async function main() {
	const args = parseArgs(process.argv);

	if (args.viaRest) {
		const mainSupabaseUrl = (process.env.TOPICS_SYNC_MAIN_SUPABASE_URL ?? "").trim();
		const mainServiceRole = (process.env.TOPICS_SYNC_MAIN_SERVICE_ROLE_KEY ?? "").trim();
		const appUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
		const appServiceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

		if (!mainSupabaseUrl || !mainServiceRole || !appUrl || !appServiceRole) {
			console.error(
				"REST mode needs TOPICS_SYNC_MAIN_SUPABASE_URL, TOPICS_SYNC_MAIN_SERVICE_ROLE_KEY, " +
					"NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY (assumes app URL/key point at the dev target when using --direction main-to-dev).",
			);
			process.exit(1);
		}

		const source =
			args.direction === "main-to-dev" ?
				{ url: mainSupabaseUrl, key: mainServiceRole }
			:	{ url: appUrl, key: appServiceRole };
		const target =
			args.direction === "main-to-dev" ?
				{ url: appUrl, key: appServiceRole }
			:	{ url: mainSupabaseUrl, key: mainServiceRole };

		const label = args.direction === "main-to-dev" ? "main→dev" : "dev→main";
		console.log(`[REST:${label}] source=${source.url} target=${target.url}`);

		const sourceRows = await fetchAllTopicsRest(source.url, source.key);

		if (!args.dryRun) {
			const targetBefore = await fetchAllTopicsRest(target.url, target.key);
			console.log(
				`Before — source fingerprint: ${stableTopicsFingerprint(sourceRows)}\n` +
					`Before — target fingerprint: ${stableTopicsFingerprint(targetBefore)}`,
			);
		}

		await upsertTopicsRest(target.url, target.key, sourceRows, args.dryRun);

		if (!args.dryRun) {
			const targetAfter = await fetchAllTopicsRest(target.url, target.key);
			const fpS = stableTopicsFingerprint(sourceRows);
			const fpT = stableTopicsFingerprint(targetAfter);
			console.log(`After — source fingerprint: ${fpS}\nAfter — target fingerprint: ${fpT}`);
			if (fpS !== fpT) {
				console.error("Fingerprints still differ; investigate manually.");
				process.exit(1);
			}
		}
		return;
	}

	const dev = postgres(args.devUrl, { max: 2, prepare: false });
	const main = postgres(args.mainUrl, { max: 2, prepare: false });

	try {
		const sourcePg = args.direction === "main-to-dev" ? main : dev;
		const targetPg = args.direction === "main-to-dev" ? dev : main;
		const label = args.direction === "main-to-dev" ? "main→dev" : "dev→main";

		if (!args.dryRun) {
			const [beforeT, beforeS] = await Promise.all([fingerprint(targetPg), fingerprint(sourcePg)]);
			console.log(`Before — source fingerprint: ${beforeS}\nBefore — target fingerprint: ${beforeT}`);
		}

		await syncOneWay(sourcePg, targetPg, label, args.dryRun);

		if (!args.dryRun) {
			const [afterT, afterS] = await Promise.all([fingerprint(targetPg), fingerprint(sourcePg)]);
			console.log(`After — source fingerprint: ${afterS}\nAfter — target fingerprint: ${afterT}`);
			if (afterT !== afterS) {
				console.error("Fingerprints still differ; investigate manually.");
				process.exit(1);
			}
		}
	} finally {
		await Promise.all([dev.end({ timeout: 5 }), main.end({ timeout: 5 })]);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
