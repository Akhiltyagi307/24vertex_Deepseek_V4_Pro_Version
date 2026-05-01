import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { registerStudentViaRpc } from "@/lib/auth/register-student-rpc";
import { getProfile } from "@/lib/auth/routing";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { classifyLinkParentRpc } from "@/lib/auth/link-parent-rpc-errors";
import {
	parentRegistrationPayloadSchema,
	studentProfileBodySchema,
} from "@/lib/validations/auth";

const pendingEnvelopeSchema = z.discriminatedUnion("role", [
	z.object({
		version: z.literal(1),
		role: z.literal("student"),
		payload: studentProfileBodySchema,
	}),
	z.object({
		version: z.literal(1),
		role: z.literal("parent"),
		payload: parentRegistrationPayloadSchema,
	}),
]);

export type ConsumePendingRegistrationResult =
	| "completed_profile"
	| "no_pending"
	| "failed"
	| "failed_unsupported_teacher_signup"
	| "failed_parent_email_mismatch"
	| "failed_student_not_found"
	/** Parent row exists; keep session and finish linking from the portal. */
	| "parent_portal_link_email_mismatch"
	| "parent_portal_link_student_not_found"
	| "parent_portal_link_unknown";

async function linkPendingParentToStudent(
	supabase: SupabaseClient,
	parentUserId: string,
	studentLinkCode: string,
): Promise<
	| "completed_profile"
	| "failed"
	| "failed_parent_email_mismatch"
	| "failed_student_not_found"
	| "parent_portal_link_email_mismatch"
	| "parent_portal_link_student_not_found"
	| "parent_portal_link_unknown"
> {
	const { error: linkErr } = await supabase.rpc("link_parent_to_student", {
		p_student_ref: studentLinkCode,
	});
	if (!linkErr) {
		return "completed_profile";
	}
	logSupabaseError("consumePendingRegistration.link_parent_to_student", linkErr);
	const bucket = classifyLinkParentRpc(linkErr);

	const { data: prof, error: profErr } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", parentUserId)
		.maybeSingle();
	const isParent = !profErr && prof?.role === "parent";

	if (bucket === "parent_email_mismatch") {
		return isParent ? "parent_portal_link_email_mismatch" : "failed_parent_email_mismatch";
	}
	if (bucket === "student_not_found") {
		return isParent ? "parent_portal_link_student_not_found" : "failed_student_not_found";
	}
	return isParent ? "parent_portal_link_unknown" : "failed";
}

type ParsedPending = z.infer<typeof pendingEnvelopeSchema>;

type PendingParseResult =
	| { status: "ok"; envelope: ParsedPending }
	| { status: "none" }
	| { status: "unsupported_teacher_signup" }
	| { status: "failed" };

/**
 * Auth may store `options.data` values as strings or as already-parsed JSON objects in
 * `user.user_metadata`. Only accepting strings caused pending registration to be skipped after
 * email confirmation (users stuck on role picker with a session but no profile).
 */
function parsePendingEnvelopeFromUser(user: User): PendingParseResult {
	const raw = user.user_metadata?.[EDUAI_PENDING_REGISTRATION_META_KEY];
	if (raw == null) {
		return { status: "none" };
	}

	let json: unknown;
	if (typeof raw === "string") {
		try {
			json = JSON.parse(raw);
		} catch {
			return { status: "failed" };
		}
		// Handle double-encoded payloads (rare, but cheap to support).
		if (typeof json === "string") {
			try {
				json = JSON.parse(json);
			} catch {
				return { status: "failed" };
			}
		}
	} else if (typeof raw === "object" && !Array.isArray(raw)) {
		json = raw;
	} else {
		// Legacy behavior: unknown shapes were ignored (not treated as a hard error).
		return { status: "none" };
	}

	const parsed = pendingEnvelopeSchema.safeParse(json);
	if (!parsed.success) {
		const roleProbe = z
			.object({
				role: z.string(),
			})
			.safeParse(json);
		if (roleProbe.success && roleProbe.data.role === "teacher") {
			return { status: "unsupported_teacher_signup" };
		}
		// If we stored a string, a bad payload is likely real corruption — surface the error flow.
		// If Auth gave us an object that does not match (e.g. older shape), fall back like before.
		return typeof raw === "string" ? { status: "failed" } : { status: "none" };
	}
	return { status: "ok", envelope: parsed.data };
}

/**
 * After email confirmation, the session exists but profile RPCs never ran (no session at submit time).
 * Completes registration from user metadata, then caller should sign out and send user to /login.
 */
export async function consumePendingRegistration(
	supabase: SupabaseClient,
): Promise<ConsumePendingRegistrationResult> {
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();
	if (userError || !user) {
		return "no_pending";
	}

	const profile = await getProfile();
	const pending = parsePendingEnvelopeFromUser(user);

	if (pending.status === "failed") {
		return "failed";
	}
	if (pending.status === "unsupported_teacher_signup") {
		return "failed_unsupported_teacher_signup";
	}

	if (pending.status === "none") {
		return "no_pending";
	}

	const envelope = pending.envelope;
	const authEmail = user.email?.trim().toLowerCase() ?? "";
	const pendingEmail = envelope.payload.email.trim().toLowerCase();
	// After PKCE exchange, `user.email` can be briefly unset on some clients; do not block on empty.
	if (authEmail && pendingEmail && authEmail !== pendingEmail) {
		return "failed";
	}

	/** Parent row may exist while linking never ran (first callback failed after `register_parent`). */
	if (profile) {
		if (envelope.role === "student") {
			if (profile.role === "student") {
				return "no_pending";
			}
			return "failed";
		}
		// envelope.role === "parent"
		if (profile.role !== "parent") {
			return "failed";
		}
		const v = envelope.payload;
		return linkPendingParentToStudent(supabase, user.id, v.studentLinkCode);
	}

	// No profile row yet — create then link (or register student).
	if (envelope.role === "student") {
		const v = envelope.payload;
		const streamVal = v.grade >= 11 && v.grade <= 12 ? (v.stream ?? null) : null;
		const electiveVal = v.grade >= 11 && v.grade <= 12 ? (v.electiveSubjectId ?? null) : null;
		const { error: rpcError } = await registerStudentViaRpc(supabase, {
			fullName: v.fullName,
			grade: v.grade,
			section: v.section.trim(),
			stream: streamVal,
			electiveSubjectId: electiveVal,
			parentName: v.parentName ?? null,
			parentEmail: v.parentEmail ?? null,
		});
		if (rpcError) {
			if (/profile already exists/i.test(rpcError.message)) {
				return "no_pending";
			}
			logSupabaseError("consumePendingRegistration.register_student", rpcError);
			return "failed";
		}
		return "completed_profile";
	}

	if (envelope.role === "parent") {
		const v = envelope.payload;
		const { error: rpcError } = await supabase.rpc("register_parent", {
			p_full_name: v.fullName,
		});
		if (rpcError) {
			if (/profile already exists/i.test(rpcError.message)) {
				// Profile was created on a prior attempt; still run the link step.
				return linkPendingParentToStudent(supabase, user.id, v.studentLinkCode);
			}
			logSupabaseError("consumePendingRegistration.register_parent", rpcError);
			return "failed";
		}
		return linkPendingParentToStudent(supabase, user.id, v.studentLinkCode);
	}

	return "failed";
}
