import "server-only";

import { db } from "@/db";
import { integrityCheckResults } from "@/db/schema/integrity-check-results";
import { INTEGRITY_CHECK_NAMES, runIntegrityCheck } from "@/lib/admin/integrity/check-runners";

/** Runs every named integrity check and appends rows to `integrity_check_results`. */
export async function runAllIntegrityChecks(): Promise<void> {
	for (const checkName of INTEGRITY_CHECK_NAMES) {
		const r = await runIntegrityCheck(checkName);
		await db.insert(integrityCheckResults).values({
			checkName,
			rowsFound: r.rowsFound,
			details: r.details,
		});
	}
}
