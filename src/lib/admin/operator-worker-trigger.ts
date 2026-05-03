import "server-only";

import { getAppUrl } from "@/lib/env";
import { logServerError } from "@/lib/server/log-supabase-error";

/** Triggers `/api/internal/admin/process-operator-jobs` (same auth pattern as practice grading worker). */
export async function triggerOperatorJobsProcessInBackground(): Promise<{ ok: true } | { ok: false; message: string }> {
	let base: string;
	try {
		base = getAppUrl();
	} catch (error) {
		logServerError("triggerOperatorJobsProcessInBackground.getAppUrl", error);
		return { ok: false, message: "The worker endpoint is not configured." };
	}

	const headers: Record<string, string> = {};
	if (process.env.CRON_SECRET) {
		headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
	}

	try {
		const response = await fetch(`${base}/api/internal/admin/process-operator-jobs`, {
			method: "POST",
			headers,
			cache: "no-store",
			keepalive: true,
			signal: AbortSignal.timeout(300_000),
		});
		if (!response.ok) {
			logServerError("triggerOperatorJobsProcessInBackground.fetch", `Worker returned ${response.status}`);
			return { ok: false, message: "The operator jobs endpoint did not accept the request." };
		}
		return { ok: true };
	} catch (error) {
		logServerError("triggerOperatorJobsProcessInBackground.fetch", error);
		return { ok: false, message: "Could not reach the operator jobs endpoint." };
	}
}
