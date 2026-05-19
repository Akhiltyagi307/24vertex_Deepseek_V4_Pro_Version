import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getCachedAppProfileRow, type AppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export type VerifiedStudentSession = {
	user: User;
	profile: AppProfileRow;
};

export type VerifiedStudentSessionFailureCode =
	| "not_signed_in"
	| "not_student"
	| "suspended";

export type VerifiedStudentSessionResult =
	| ({ ok: true } & VerifiedStudentSession)
	| {
			ok: false;
			code: VerifiedStudentSessionFailureCode;
			message: string;
			status: 401 | 403;
			userId?: string;
	  };

const failureMessages: Record<VerifiedStudentSessionFailureCode, string> = {
	not_signed_in: "Not signed in.",
	not_student: "Sign in as a student to continue.",
	suspended: "This student account is suspended.",
};

const failureStatuses: Record<VerifiedStudentSessionFailureCode, 401 | 403> = {
	not_signed_in: 401,
	not_student: 403,
	suspended: 403,
};

function failure(
	code: VerifiedStudentSessionFailureCode,
	userId?: string,
): VerifiedStudentSessionResult {
	return {
		ok: false,
		code,
		message: failureMessages[code],
		status: failureStatuses[code],
		userId,
	};
}

/**
 * Shared guard for student workspace Server Actions and Route Handlers.
 *
 * Mirrors `getVerifiedTeacherSession` / `getVerifiedParentSession`. Returns
 * a structured result so route handlers can produce the right status code;
 * layouts and pages should call {@link requireVerifiedStudent} which redirects
 * on failure.
 */
export async function getVerifiedStudentSession(): Promise<VerifiedStudentSessionResult> {
	const user = await getServerUser();
	if (!user) {
		return failure("not_signed_in");
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.id !== user.id || profile.role !== "student") {
		return failure("not_student", user.id);
	}

	if (profile.is_suspended) {
		return failure("suspended", user.id);
	}

	return { ok: true, user, profile };
}

/**
 * Layout / page guard — redirects on any failure (never returns a failure
 * shape). Use {@link getVerifiedStudentSession} from route handlers and server
 * actions that need to produce a typed response.
 */
export async function requireVerifiedStudent(): Promise<VerifiedStudentSession> {
	const result = await getVerifiedStudentSession();
	if (result.ok) return result;
	if (result.code === "suspended") redirect("/login?suspended=1");
	redirect("/login");
}
