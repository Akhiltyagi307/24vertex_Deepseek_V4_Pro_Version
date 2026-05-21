import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

import {
	EDUAI_PENDING_REGISTRATION_META_KEY,
	PENDING_REGISTRATION_META_KEYS,
	VERTEX24_PENDING_REGISTRATION_META_KEY,
} from "@/lib/auth/pending-registration-meta";
import { registerStudentViaRpc } from "@/lib/auth/register-student-rpc";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { classifyLinkParentRpc } from "@/lib/auth/link-parent-rpc-errors";
import { resolveStudentProfileIdForLinkRef } from "@/lib/auth/resolve-student-link-ref";
import {
	notifyParentChildLinkConfirmed,
	notifyParentLinkedToStudent,
} from "@/lib/notifications/account-security";
import {
	parentRegistrationPayloadSchema,
	studentProfileBodySchema,
	teacherRegistrationPayloadSchema,
	toTeacherIndiaPhoneE164,
} from "@/lib/validations/auth";
import { sendTeacherPendingApprovalEmail } from "@/lib/email/teacher-pending-approval-email";

export type ConsumePendingRegistrationOptions = {
	/**
	 * User from Session right after PKCE `exchangeCodeForSession` or `verifyOtp`. Some callers see
	 * `getUser()` omit `email` or pending-registration `user_metadata` briefly; merging fixes false
	 * email-mismatch failures (same user id).
	 */
	sessionUserHandshake?: User | null;
};

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
	z.object({
		version: z.literal(1),
		role: z.literal("teacher"),
		payload: teacherRegistrationPayloadSchema,
	}),
]);

export type ConsumePendingRegistrationResult =
	| "completed_profile"
	| "no_pending"
	| "failed"
	/** Phone in pending payload / metadata does not satisfy DB (+91 ten digits); user should re-register. */
	| "failed_teacher_phone_rpc"
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
		const studentId = await resolveStudentProfileIdForLinkRef(supabase, studentLinkCode);
		if (studentId) {
			await notifyParentLinkedToStudent({ studentId, parentId: parentUserId });
			await notifyParentChildLinkConfirmed({ studentId, parentId: parentUserId });
		}
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
function pendingMetaRaw(user: User): unknown {
	for (const key of PENDING_REGISTRATION_META_KEYS) {
		const raw = user.user_metadata?.[key];
		if (raw != null) return raw;
	}
	return null;
}

function parsePendingEnvelopeFromUser(user: User): PendingParseResult {
	const raw = pendingMetaRaw(user);
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
			// Metadata has role=teacher but fails the current teacher payload schema
			// (old format missing phone, or corrupted data). Surface as unsupported so
			// the callback shows a clear retry message rather than a generic error.
			return { status: "unsupported_teacher_signup" };
		}
		// If we stored a string, a bad payload is likely real corruption — surface the error flow.
		// If Auth gave us an object that does not match (e.g. older shape), fall back like before.
		return typeof raw === "string" ? { status: "failed" } : { status: "none" };
	}
	return { status: "ok", envelope: parsed.data };
}

function normalizeEmailCompare(raw: string | undefined): string {
	if (!raw || typeof raw !== "string") return "";
	return raw.normalize("NFKC").trim().toLowerCase();
}

function handshakeEmail(u: Pick<User, "email"> | null | undefined): string | null {
	const normalized = normalizeEmailCompare(u?.email ?? "");
	return normalized !== "" ? normalized : null;
}

/**
 * Supabase sometimes omits `user.email` on the first `getUser()` after PKCE exchange; `identities`
 * still carries the confirmed address. Used so teacher (and other) pending registration can complete.
 */
function primaryAuthEmailComparable(user: User): string {
	const direct = normalizeEmailCompare(user.email);
	if (direct) return direct;
	const identities = user.identities;
	if (!Array.isArray(identities)) return "";
	for (const row of identities) {
		if (!row || typeof row !== "object") continue;
		const idData = (row as { identity_data?: { email?: string } }).identity_data;
		const em = normalizeEmailCompare(idData?.email);
		if (em) return em;
	}
	return "";
}

/**
 * Prefer `email` and pending-registration metadata from the handshake Session user when present
 * and the refreshed API user lacks them (common right after PKCE exchange in App Router SSR).
 */
function mergeUserFromHandshake(apiUser: User, handshake?: User | null): User {
	if (!handshake?.id) {
		return apiUser;
	}
	// Allow merge when the server user object is missing `id` (rare mocks / transient SSR),
	// or when ids match — never merge cross-account.
	if (apiUser.id != null && handshake.id !== apiUser.id) {
		return apiUser;
	}

	let merged = apiUser;

	if (!handshakeEmail(apiUser) && handshakeEmail(handshake)) {
		merged = { ...merged, email: handshake.email };
	}

	const apiMeta = pendingMetaRaw(merged);
	const handshakeMeta = pendingMetaRaw(handshake);
	if (apiMeta == null && handshakeMeta != null) {
		merged = {
			...merged,
			user_metadata: {
				...(merged.user_metadata ?? {}),
				[VERTEX24_PENDING_REGISTRATION_META_KEY]: handshakeMeta,
			},
		};
	}

	if (
		(!merged.identities || merged.identities.length === 0) &&
		handshake.identities &&
		handshake.identities.length > 0
	) {
		merged = { ...merged, identities: handshake.identities };
	}

	return merged;
}

async function fetchProfileForSessionUser(
	supabase: SupabaseClient,
	userId: string,
): Promise<{ id: string; role: string } | null> {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, role")
		.eq("id", userId)
		.maybeSingle();
	if (error) {
		logSupabaseError("consumePendingRegistration.profiles.maybeSingle", error, { userId });
		return null;
	}
	if (!data?.id || !data.role) return null;
	return { id: data.id as string, role: data.role as string };
}

function foldPendingUserHints(
	base: User,
	hints: readonly (User | null | undefined)[],
): User {
	let u = base;
	for (const h of hints) {
		u = mergeUserFromHandshake(u, h);
	}
	return u;
}

/**
 * After email confirmation, the session exists but profile RPCs never ran (no session at submit time).
 * Completes registration from user metadata, then caller should sign out and send user to /login.
 */
export async function consumePendingRegistration(
	supabase: SupabaseClient,
	options?: ConsumePendingRegistrationOptions | null,
): Promise<ConsumePendingRegistrationResult> {
	const handshake = options?.sessionUserHandshake ?? null;
	const {
		data: { user: apiUser },
		error: userError,
	} = await supabase.auth.getUser();
	const {
		data: { session },
		error: sessionError,
	} = await supabase.auth.getSession();

	if (sessionError) {
		logSupabaseError("consumePendingRegistration.getSession", sessionError);
	}

	const sessionUser = session?.user ?? null;

	const seed = apiUser ?? sessionUser ?? handshake;
	const user =
		seed != null ?
			foldPendingUserHints(seed, [handshake, sessionUser, apiUser])
		: handshake?.id ? foldPendingUserHints(handshake, [handshake])
		: null;

	if (userError && !user) {
		return "no_pending";
	}
	if (!user) {
		return "no_pending";
	}

	const profile = user.id ? await fetchProfileForSessionUser(supabase, user.id) : null;
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
	const authEmail = primaryAuthEmailComparable(user);
	const pendingEmail = normalizeEmailCompare(envelope.payload.email);
	// Both emails MUST be present and match. We merge `email` from the PKCE/OTP
	// handshake when `getUser()` omits it briefly; if still empty or mismatched,
	// refuse (prevents completing someone else's pending payload).
	if (!authEmail || !pendingEmail || authEmail !== pendingEmail) {
		logSupabaseError(
			"consumePendingRegistration.email_mismatch",
			{ message: "auth/pending email mismatch", code: "auth_email_mismatch" },
			{
				role: envelope.role,
				auth_email_present: Boolean(authEmail),
				pending_email_present: Boolean(pendingEmail),
				match: authEmail === pendingEmail,
			},
		);
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
		if (envelope.role === "teacher") {
			// Profile already created (auto-confirm path ran first, or callback retry).
			return profile.role === "teacher" ? "no_pending" : "failed";
		}
		// envelope.role === "parent"
		if (profile.role !== "parent") {
			return "failed";
		}
		const v = envelope.payload;
		return linkPendingParentToStudent(supabase, user.id, v.studentLinkCode);
	}

	// No profile row yet — create then link (or register student/teacher).
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

	if (envelope.role === "teacher") {
		const v = envelope.payload;
		const phoneRpc = toTeacherIndiaPhoneE164(String(v.phone)) ?? String(v.phone);
		const { error: rpcError } = await supabase.rpc("register_teacher", {
			p_full_name: v.fullName,
			p_school_name: v.schoolName ?? null,
			p_phone: phoneRpc,
		});
		if (rpcError) {
			if (/profile already exists/i.test(rpcError.message)) {
				return "no_pending";
			}
			if (/phone must be/i.test(rpcError.message)) {
				logSupabaseError("consumePendingRegistration.register_teacher_phone", rpcError, {
					userId: user.id,
				});
				return "failed_teacher_phone_rpc";
			}
			logSupabaseError("consumePendingRegistration.register_teacher", rpcError);
			return "failed";
		}
		// Fire-and-forget: email failure must not block profile creation.
		// sendHtmlEmailLogged deduplicates via dedupKey so both the callback path and
		// the direct-session path (auto-confirm) can call this without sending twice.
		void sendTeacherPendingApprovalEmail(v.email, v.fullName, {
			dedupKey: `teacher-pending-approval:${user.id}`,
		});
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
