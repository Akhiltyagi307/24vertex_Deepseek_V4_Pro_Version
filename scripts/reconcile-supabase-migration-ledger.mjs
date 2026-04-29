import "dotenv/config";
import postgres from "postgres";

const APPLY_FLAG = "--apply";

const mappings = [
	{
		name: "profiles_curriculum_auto_sync_performance_tracker",
		fromVersion: "20260429112406",
		toVersion: "20260429172000",
	},
	{
		name: "fix_tracker_sync_stream_type_cast",
		fromVersion: "20260429112445",
		toVersion: "20260429173500",
	},
	{
		name: "restore_initialize_performance_tracker_function",
		fromVersion: "20260429112508",
		toVersion: "20260429174500",
	},
	{
		name: "restore_performance_tracker_unique_constraint",
		fromVersion: "20260429112547",
		toVersion: "20260429175500",
	},
	{
		name: "billing_redeem_coupon_atomic",
		fromVersion: "20260429123257",
		toVersion: "20260429180500",
	},
	{
		name: "reclaim_stale_free_trial_claims",
		fromVersion: "20260429142534",
		toVersion: "20260429200000",
	},
	{
		name: "coupon_single_use_global",
		fromVersion: "20260429142544",
		toVersion: "20260429190000",
	},
];

function readMode() {
	if (process.argv.includes(APPLY_FLAG)) return "apply";
	return "dry-run";
}

function requireDatabaseUrl() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is required. Load .env.local or export DATABASE_URL.");
	}
	return url;
}

async function main() {
	const mode = readMode();
	const sql = postgres(requireDatabaseUrl(), { ssl: "require" });
	try {
		console.log(`mode=${mode}`);
		const rows = await sql.unsafe(
			"select version, name from supabase_migrations.schema_migrations order by version",
		);
		const byVersion = new Map(rows.map((r) => [String(r.version), String(r.name ?? "")]));
		const planned = [];

		for (const m of mappings) {
			const fromName = byVersion.get(m.fromVersion);
			const toName = byVersion.get(m.toVersion);
			if (!fromName && !toName) {
				throw new Error(
					`Neither version present for ${m.name}: expected one of ${m.fromVersion} or ${m.toVersion}.`,
				);
			}
			if (toName) {
				if (toName !== m.name) {
					throw new Error(
						`Target version ${m.toVersion} has unexpected name "${toName}" (expected "${m.name}").`,
					);
				}
				console.log(`already-ok ${m.toVersion}_${m.name}`);
				continue;
			}
			if (fromName !== m.name) {
				throw new Error(
					`Source version ${m.fromVersion} has name "${fromName}" (expected "${m.name}").`,
				);
			}
			planned.push(m);
		}

		if (planned.length === 0) {
			console.log("No migration ledger rewrites needed.");
			return;
		}

		console.log("planned-rewrites:");
		for (const p of planned) {
			console.log(`${p.fromVersion} -> ${p.toVersion} (${p.name})`);
		}

		if (mode === "dry-run") {
			console.log("Dry run only. Re-run with --apply to perform updates.");
			return;
		}

		await sql.begin(async (tx) => {
			for (const p of planned) {
				await tx`
					update supabase_migrations.schema_migrations
					set version = ${p.toVersion}
					where version = ${p.fromVersion}
					  and name = ${p.name}
				`;
			}
		});

		console.log(`Applied ${planned.length} migration ledger rewrites.`);
	} finally {
		await sql.end({ timeout: 1 });
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
