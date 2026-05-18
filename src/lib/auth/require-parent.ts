import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getCachedAppProfileRow, type AppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export type VerifiedParentSession = {
	user: User;
	profile: AppProfileRow;
};

export type VerifiedParentSessionFailureCode =
	| "not_signed_in"
	| "not_parent"
	| "suspended";

export type VerifiedParentSessionResult =
	| ({ ok: true } & VerifiedParentSession)
	| {
			ok: false;
			code: VerifiedParentSessionFailureCode;
			message: string;
			status: 401 | 403;
			userId?: string;
	  };

const failureMessages: Record<VerifiedParentSessionFailureCode, string> = {
	not_signed_in: "Not signed in.",
	not_parent: "Sign in as a parent to continue.",
	suspended: "This parent account is suspended.",
};

const failureStatuses: Record<VerifiedParentSessionFailureCode, 401 | 403> = {
	not_signed_in: 401,
	not_parent: 403,
	suspended: 403,
};

function failure(
	code: VerifiedParentSessionFailureCode,
	userId?: string,
): VerifiedParentSessionResult {
	return {
		ok: false,
		code,
		message: failureMessages[code],
		status: failureStatuses[code],
		userId,
	};
}

/**
 * Shared guard for parent workspace Server Actions and Route Handlers.
 *
 * Mirrors `getVerifiedTeacherSession` (the teacher-portal equivalent). Returns
 * a structured result so route handlers can produce the right status code;
 * layouts should call {@link requireParent} which redirects on failure.
 *
 * Note: `unlink_parent_from_student` writes a row to
 * `parent_session_invalidations` for forensic / operator visibility, but we do
 * NOT consult that table here. Trying to signOut() from a server component
 * runs into the documented "cookies can only be modified in a Server Action
 * or Route Handler" limitation and would create a /login ↔ /parent redirect
 * loop with the login layout's authed-user auto-redirect. The security
 * boundary is enforced instead by `assertParentActiveLink()` on every parent
 * page that reads child data — which bounces stale cookies to
 * /parent/select-student.
 */
export async function getVerifiedParentSession(): Promise<VerifiedParentSessionResult> {
	const user = await getServerUser();
	if (!user) {
		return failure("not_signed_in");
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.id !== user.id || profile.role !== "parent") {
		return failure("not_parent", user.id);
	}

	if (profile.is_suspended) {
		return failure("suspended", user.id);
	}

	return { ok: true, user, profile };
}

/**
 * Layout / page guard — redirects on any failure (never returns a failure
 * shape). Use {@link getVerifiedParentSession} from route handlers and server
 * actions that need to produce a typed response.
 */
export async function requireParent(): Promise<VerifiedParentSession> {
	const result = await getVerifiedParentSession();
	if (result.ok) return result;
	if (result.code === "suspended") redirect("/login?suspended=1");
	redirect("/login");
}
