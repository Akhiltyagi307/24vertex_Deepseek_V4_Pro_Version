import "server-only";

import { getAppUrl } from "@/lib/env";
import { logServerError } from "@/lib/server/log-supabase-error";

/** Triggers `/api/internal/practice/run-jobs` (same as student submit / retry grading). */
export async function triggerPracticeWorkerInBackground(): Promise<{ ok: true } | { ok: false; message: string }> {
	let base: string;
	try {
		base = getAppUrl();
	} catch (error) {
		logServerError("triggerPracticeWorkerInBackground.getAppUrl", error);
		return { ok: false, message: "The worker endpoint is not configured." };
	}

	const headers: Record<string, string> = {};
	if (process.env.CRON_SECRET) {
		headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
	}

	try {
		const response = await fetch(`${base}/api/internal/practice/run-jobs`, {
			method: "POST",
			headers,
			cache: "no-store",
			keepalive: true,
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) {
			logServerError("triggerPracticeWorkerInBackground.fetch", `Worker returned ${response.status}`);
			return { ok: false, message: "The worker endpoint did not accept the request." };
		}
		return { ok: true };
	} catch (error) {
		logServerError("triggerPracticeWorkerInBackground.fetch", error);
		return { ok: false, message: "Could not reach the worker endpoint." };
	}
}
