#!/usr/bin/env node
/**
 * Bidirectional copy of rows in `public.topic_context_chunks` between two Postgres
 * databases (typically Supabase dev and production) so both have identical chunk sets.
 *
 * Usage:
 *   node scripts/sync-topic-context-chunks.mjs --dry-run
 *   node scripts/sync-topic-context-chunks.mjs --apply --direction both
 *
 * Connection URLs (use direct DB URLs from Supabase project settings → Database):
 *   TOPIC_CHUNKS_SYNC_DEV_DATABASE_URL
 *   TOPIC_CHUNKS_SYNC_MAIN_DATABASE_URL
 *
 * Optional CLI overrides:
 *   --dev-url <postgres url>
 *   --main-url <postgres url>
 *
 * Direction:
 *   --direction both             (default) copy missing IDs dev→main and main→dev
 *   --direction dev-to-main
 *   --direction main-to-dev
 */

import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: false });

const CHUNK_BATCH = 100;

/** @typedef {{ dryRun: boolean, apply: boolean, direction: 'both'|'dev-to-main'|'main-to-dev', devUrl: string, mainUrl: string }} Args */

/** @returns {Args} */
function parseArgs(argv) {
	const args = { dryRun: false, apply: false, direction: "both", devUrl: "", mainUrl: "" };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--dry-run") args.dryRun = true;
		else if (a === "--apply") args.apply = true;
		else if (a === "--direction" && argv[i + 1]) {
			args.direction = /** @type {Args['direction']} */ (argv[++i]);
		} else if (a === "--dev-url" && argv[i + 1]) args.devUrl = argv[++i];
		else if (a === "--main-url" && argv[i + 1]) args.mainUrl = argv[++i];
		else if (a === "--help" || a === "-h") {
			console.log("See header comment in scripts/sync-topic-context-chunks.mjs");
			process.exit(0);
		}
	}

	if (!["both", "dev-to-main", "main-to-dev"].includes(args.direction)) {
		console.error("--direction must be one of: both, dev-to-main, main-to-dev");
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

	const devUrl =
		args.devUrl ||
		process.env.TOPIC_CHUNKS_SYNC_DEV_DATABASE_URL ||
		process.env.TOPIC_CHUNKS_DEV_DATABASE_URL ||
		"";

	const mainUrl =
		args.mainUrl ||
		process.env.TOPIC_CHUNKS_SYNC_MAIN_DATABASE_URL ||
		process.env.TOPIC_CHUNKS_MAIN_DATABASE_URL ||
		"";

	if (!devUrl || !mainUrl) {
		console.error(
			"Missing database URLs. Set TOPIC_CHUNKS_SYNC_DEV_DATABASE_URL and TOPIC_CHUNKS_SYNC_MAIN_DATABASE_URL " +
				"(or pass --dev-url / --main-url).",
		);
		process.exit(1);
	}

	return { ...args, devUrl, mainUrl };
}

/** @param {unknown} id */
function idStr(id) {
	return String(id);
}

/**
 * @param {postgres.Sql<{bigint:bigint}>} source
 * @param {postgres.Sql<{bigint:bigint}>} target
 * @param {'dev→main'|'main→dev'} label
 * @param {boolean} dryRun
 */
async function syncOneWay(source, target, label, dryRun) {
	const sourceRows = await source`SELECT id FROM topic_context_chunks`;
	const targetRows = await target`SELECT id FROM topic_context_chunks`;
	const sourceSet = new Set(sourceRows.map((r) => idStr(r.id)));
	const targetSet = new Set(targetRows.map((r) => idStr(r.id)));

	const missingOnTarget = [...sourceSet].filter((id) => !targetSet.has(id));
	if (missingOnTarget.length === 0) {
		console.log(`[${label}] Nothing to copy (sets already match).`);
		return { copied: 0, skippedMissingTopic: 0 };
	}

	const targetTopicRows = await target`SELECT id FROM topics`;
	const targetTopics = new Set(targetTopicRows.map((r) => idStr(r.id)));

	let skippedMissingTopic = 0;
	let inserted = 0;

	for (let i = 0; i < missingOnTarget.length; i += CHUNK_BATCH) {
		const batchIds = missingOnTarget.slice(i, i + CHUNK_BATCH);
		const rows = await source`
			SELECT id, topic_id, content, chunk_type, source_ref, metadata, created_at
			FROM topic_context_chunks
			WHERE id IN ${source(batchIds)}
		`;

		for (const row of rows) {
			if (!targetTopics.has(idStr(row.topic_id))) {
				skippedMissingTopic++;
				continue;
			}
			if (dryRun) {
				continue;
			}
			const result = await target`
				INSERT INTO topic_context_chunks
					(id, topic_id, content, chunk_type, source_ref, metadata, embedding, created_at)
				VALUES
					(
						${row.id},
						${row.topic_id},
						${row.content},
						${row.chunk_type},
						${row.source_ref},
						${row.metadata},
						NULL,
						${row.created_at}
					)
				ON CONFLICT (id) DO NOTHING
				RETURNING id
			`;
			if (result.length === 1) inserted++;
		}
	}

	if (dryRun) {
		console.log(
			`[${label}] dry-run: ${missingOnTarget.length} row id(s) on source missing on target; ` +
				`${skippedMissingTopic} would be skipped (topic_id not on target); ` +
				`${missingOnTarget.length - skippedMissingTopic} would be inserted.`,
		);
		return { copied: 0, skippedMissingTopic };
	}

	console.log(`[${label}] inserted ${inserted} row(s); ${skippedMissingTopic} skipped (missing topic on target).`);
	return { copied: inserted, skippedMissingTopic };
}

async function main() {
	const args = parseArgs(process.argv);

	const dev = postgres(args.devUrl, { max: 2, prepare: false });
	const main = postgres(args.mainUrl, { max: 2, prepare: false });

	try {
		if (args.direction === "both" || args.direction === "dev-to-main") {
			await syncOneWay(dev, main, "dev→main", args.dryRun);
		}
		if (args.direction === "both" || args.direction === "main-to-dev") {
			await syncOneWay(main, dev, "main→dev", args.dryRun);
		}

		if (!args.dryRun) {
			const [dCount, mCount] = await Promise.all([
				dev`SELECT count(*)::bigint AS n FROM topic_context_chunks`,
				main`SELECT count(*)::bigint AS n FROM topic_context_chunks`,
			]);
			console.log(
				`Final row counts — dev: ${dCount[0].n.toString()}, main: ${mCount[0].n.toString()}`,
			);
		}
	} finally {
		await Promise.all([dev.end({ timeout: 5 }), main.end({ timeout: 5 })]);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
