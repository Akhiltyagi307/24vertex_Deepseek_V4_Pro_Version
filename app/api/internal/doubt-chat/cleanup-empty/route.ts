import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { beginCronRun, completeCronRun, readIdempotencyKey } from "@/lib/internal/cron-idempotency";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_ROUTE = "doubt-chat-cleanup-empty";

/**
 * Deletes `doubt_conversations` rows that are empty (no `doubt_messages`) and
 * older than 24h. The "Start chat" UX inserts a conversation row immediately
 * to give the student a stable URL; if they never send a message, that row
 * pollutes the sidebar forever. Nightly sweep keeps the list tidy.
 *
 * Idempotent: a duplicate firing short-circuits via `cron_run_log`.
 */
async function runCleanupEmpty(request: Request): Promise<Response> {
	const idempotencyKey = readIdempotencyKey(request);
	const claim = await beginCronRun({ cronRoute: CRON_ROUTE, key: idempotencyKey });
	if (claim.kind === "duplicate") {
		return Response.json(
			{ ok: true, deduped: true, firstSeenAt: claim.firstSeenAt, completedAt: claim.completedAt },
			{ status: 200 },
		);
	}

	const admin = createServiceRoleClient();

	// Use a not-exists subquery so a single round-trip handles the join.
	// We can't `.delete().not("id", "in", ...)` cleanly via the REST builder,
	// so go through the RPC layer with a small helper SQL via .from().delete().
	// Strategy: fetch candidate IDs (paginated), then delete in bulk.
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	const { data: candidates, error: selErr } = await admin
		.from("doubt_conversations")
		.select("id")
		.lt("created_at", oneDayAgo)
		.limit(500);
	if (selErr) {
		logSupabaseError("doubt_chat_cleanup.select", selErr);
		return Response.json({ success: false, ok: false, message: "Could not load candidates." }, { status: 500 });
	}

	const candidateIds = (candidates ?? []).map((r) => r.id as string);
	if (candidateIds.length === 0) {
		if (idempotencyKey && claim.kind === "fresh") {
			await completeCronRun({ key: idempotencyKey, result: { considered: 0, deleted: 0 } });
		}
		return Response.json({ ok: true, considered: 0, deleted: 0 });
	}

	// Find which of these have ANY messages.
	const { data: nonEmptyRows, error: msgErr } = await admin
		.from("doubt_messages")
		.select("conversation_id")
		.in("conversation_id", candidateIds)
		.limit(candidateIds.length * 10);
	if (msgErr) {
		logSupabaseError("doubt_chat_cleanup.message_lookup", msgErr);
		return Response.json({ success: false, ok: false, message: "Could not check messages." }, { status: 500 });
	}
	const nonEmpty = new Set((nonEmptyRows ?? []).map((r) => r.conversation_id as string));
	const emptyIds = candidateIds.filter((id) => !nonEmpty.has(id));

	if (emptyIds.length === 0) {
		if (idempotencyKey && claim.kind === "fresh") {
			await completeCronRun({
				key: idempotencyKey,
				result: { considered: candidateIds.length, deleted: 0 },
			});
		}
		return Response.json({ ok: true, considered: candidateIds.length, deleted: 0 });
	}

	const { error: delErr } = await admin
		.from("doubt_conversations")
		.delete()
		.in("id", emptyIds);
	if (delErr) {
		logSupabaseError("doubt_chat_cleanup.delete", delErr, { count: emptyIds.length });
		return Response.json({ success: false, ok: false, message: "Could not delete." }, { status: 500 });
	}

	if (idempotencyKey && claim.kind === "fresh") {
		await completeCronRun({
			key: idempotencyKey,
			result: { considered: candidateIds.length, deleted: emptyIds.length },
		});
	}

	return Response.json({
		ok: true,
		considered: candidateIds.length,
		deleted: emptyIds.length,
	});
}

export async function POST(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runCleanupEmpty(request);
}

export async function GET(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runCleanupEmpty(request);
}
