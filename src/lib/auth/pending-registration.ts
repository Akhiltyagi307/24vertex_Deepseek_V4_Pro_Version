import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { getProfile } from "@/lib/auth/routing";
import {
	parentProfileBodySchema,
	studentProfileBodySchema,
	teacherProfileBodySchema,
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
		payload: parentProfileBodySchema,
	}),
	z.object({
		version: z.literal(1),
		role: z.literal("teacher"),
		payload: teacherProfileBodySchema,
	}),
]);

export type ConsumePendingRegistrationResult =
	| "completed_profile"
	| "no_pending"
	| "failed";

type ParsedPending = z.infer<typeof pendingEnvelopeSchema>;

type PendingParseResult =
	| { status: "ok"; envelope: ParsedPending }
	| { status: "none" }
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
	if (profile) {
		return "no_pending";
	}

	const pending = parsePendingEnvelopeFromUser(user);
	if (pending.status === "none") {
		return "no_pending";
	}
	if (pending.status === "failed") {
		return "failed";
	}

	const envelope = pending.envelope;
	if (user.email?.toLowerCase() !== envelope.payload.email.toLowerCase()) {
		return "failed";
	}

	if (envelope.role === "student") {
		const v = envelope.payload;
		const streamVal = v.grade >= 11 && v.grade <= 12 ? v.stream : null;
		const electiveVal = v.grade >= 11 && v.grade <= 12 ? v.electiveSubjectId : null;
		const { error: rpcError } = await supabase.rpc("register_student", {
			p_full_name: v.fullName,
			p_grade: v.grade,
			p_section: v.section.trim(),
			p_stream: streamVal,
			p_elective_subject_id: electiveVal,
			p_parent_name: v.parentName,
			p_parent_email: v.parentEmail,
		});
		if (rpcError) {
			if (/profile already exists/i.test(rpcError.message)) {
				return "no_pending";
			}
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
				return "no_pending";
			}
			return "failed";
		}
		return "completed_profile";
	}

	const v = envelope.payload;
	const subjectIds = [...new Set(v.assignments.map((a) => a.subjectId))];
	const pAssignments = v.assignments.map((a) => ({
		grade: a.grade,
		section: a.section,
		subject_id: a.subjectId,
	}));
	const { error: rpcError } = await supabase.rpc("register_teacher", {
		p_full_name: v.fullName,
		p_school_name: v.schoolName,
		p_subjects_taught: subjectIds,
		p_assignments: pAssignments,
	});
	if (rpcError) {
		if (/profile already exists/i.test(rpcError.message)) {
			return "no_pending";
		}
		return "failed";
	}
	return "completed_profile";
}
