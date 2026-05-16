import "server-only";

import type { User } from "@supabase/supabase-js";

import { getCachedAppProfileRow, type AppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export type VerifiedTeacherSession = {
	user: User;
	profile: AppProfileRow;
};

export type VerifiedTeacherSessionFailureCode =
	| "not_signed_in"
	| "not_teacher"
	| "not_verified"
	| "suspended";

export type VerifiedTeacherSessionResult =
	| ({ ok: true } & VerifiedTeacherSession)
	| { ok: false; code: VerifiedTeacherSessionFailureCode; message: string; status: 401 | 403; userId?: string };

const failureMessages: Record<VerifiedTeacherSessionFailureCode, string> = {
	not_signed_in: "Not signed in.",
	not_teacher: "Sign in as a teacher to continue.",
	not_verified: "Your teacher account must be verified before using this feature.",
	suspended: "This teacher account is suspended.",
};

const failureStatuses: Record<VerifiedTeacherSessionFailureCode, 401 | 403> = {
	not_signed_in: 401,
	not_teacher: 403,
	not_verified: 403,
	suspended: 403,
};

function failure(code: VerifiedTeacherSessionFailureCode, userId?: string): VerifiedTeacherSessionResult {
	return {
		ok: false,
		code,
		message: failureMessages[code],
		status: failureStatuses[code],
		userId,
	};
}

/**
 * Shared guard for teacher workspace Server Actions and Route Handlers.
 *
 * Only verified, unsuspended teacher profiles can use protected teacher features.
 * Keep signup / pending approval flows outside this guard so new teachers can finish onboarding.
 */
export async function getVerifiedTeacherSession(): Promise<VerifiedTeacherSessionResult> {
	const user = await getServerUser();
	if (!user) {
		return failure("not_signed_in");
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.id !== user.id || profile.role !== "teacher") {
		return failure("not_teacher", user.id);
	}

	if (profile.is_suspended) {
		return failure("suspended", user.id);
	}

	if (profile.is_verified !== true) {
		return failure("not_verified", user.id);
	}

	return { ok: true, user, profile };
}

