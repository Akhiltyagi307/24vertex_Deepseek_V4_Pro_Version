import "server-only";

/**
 * Maps `link_parent_to_student` failures (Postgres RAISE + PostgREST wrapping)
 * to stable buckets for routing and user-facing copy.
 */
export type LinkParentRpcErrorClass =
	| "parent_email_mismatch"
	| "student_not_found"
	| "not_authenticated"
	| "caller_not_parent"
	| "parent_profile_missing"
	| "student_reference_required"
	| "row_level_security"
	| "foreign_key_violation"
	| "link_trigger_blocked"
	/** Postgres 42P10: parent_student_links missing UNIQUE for ON CONFLICT (parent_id, student_id) */
	| "link_upsert_constraint_missing"
	| "link_not_pending"
	| "generic";

export function classifyLinkParentRpc(err: {
	message?: string;
	details?: string | null;
	hint?: string | null;
	code?: string;
}): LinkParentRpcErrorClass {
	const m = [err.message, err.details, err.hint, err.code].filter(Boolean).join(" ").toLowerCase();
	if (m.includes("parent email does not match")) {
		return "parent_email_mismatch";
	}
	if (m.includes("student not found")) {
		return "student_not_found";
	}
	if (m.includes("not authenticated")) {
		return "not_authenticated";
	}
	if (m.includes("caller must be a parent")) {
		return "caller_not_parent";
	}
	if (m.includes("parent profile missing")) {
		return "parent_profile_missing";
	}
	if (m.includes("student reference required")) {
		return "student_reference_required";
	}
	if (m.includes("row-level security") || m.includes("violates row-level security")) {
		return "row_level_security";
	}
	if (m.includes("foreign key") || m.includes("violates foreign key")) {
		return "foreign_key_violation";
	}
	if (m.includes("parent_student_links")) {
		return "link_trigger_blocked";
	}
	if (
		m.includes("42p10") ||
		m.includes("no unique or exclusion constraint matching the on conflict")
	) {
		return "link_upsert_constraint_missing";
	}
	if (m.includes("link is not pending")) {
		return "link_not_pending";
	}
	return "generic";
}

/** Short message for the parent portal “Link child” form (and similar UX). */
export function userMessageForLinkParentRpcFailure(kind: LinkParentRpcErrorClass): string {
	switch (kind) {
		case "parent_email_mismatch":
			return "Guardian email mismatch: the student profile already has a parent/guardian email on file. Your parent login email must match that value exactly (or the student can clear guardian email in Profile to allow linking with any verified parent email).";
		case "student_not_found":
			return "No student matched that link code or student ID. Use the six-character code from the student's Profile (two letters + four numbers), or paste the student's account UUID from profiles.id.";
		case "not_authenticated":
			return "Your session expired. Sign in again, then try linking.";
		case "caller_not_parent":
			return "Your account is not registered as a parent. If you signed up as a student, use a parent account instead.";
		case "parent_profile_missing":
			return "Your parent profile is incomplete. Try signing out and back in, or contact support.";
		case "student_reference_required":
			return "Enter a non-empty link code or student UUID.";
		case "row_level_security":
			return "Linking was blocked by database access rules (RLS). Confirm Supabase migrations are applied and you are signed in as the parent user.";
		case "foreign_key_violation":
			return "Database rejected the link (reference mismatch). Confirm the student profile id matches auth.users for that student.";
		case "link_trigger_blocked":
			return "Database rules blocked updating the link row. This usually means only the parent flow may activate a link; try again signed in as the parent.";
		case "link_upsert_constraint_missing":
			return "Linking failed because the database is missing a required unique key on parent–student links. Apply the latest Supabase migrations (or add UNIQUE (parent_id, student_id) on parent_student_links), then try again.";
		default:
			return "We could not complete linking. Check the code or student ID. If the student profile lists a guardian email, your parent login email must match it.";
	}
}

/** Safe diagnostic line for local debugging (never use raw text in production UI). */
export function formatLinkParentRpcDevDetails(err: {
	message?: string;
	details?: string | null;
	hint?: string | null;
	code?: string;
}): string {
	return [err.code, err.message, err.details, err.hint].filter(Boolean).join(" | ");
}
