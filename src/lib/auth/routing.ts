import "server-only";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export type ProfileRow = {
	id: string;
	role: string;
	is_verified: boolean | null;
};

/**
 * Uses {@link getCachedAppProfileRow} (React `cache`) so role checks share one `profiles` read
 * with layout and student pages in the same request.
 */
export async function getProfile(): Promise<ProfileRow | null> {
	const row = await getCachedAppProfileRow();
	if (!row) return null;
	return { id: row.id, role: row.role, is_verified: row.is_verified };
}

/** Where to send a signed-in user (dashboard or onboarding). */
export async function resolvePostAuthPath(): Promise<string> {
	const user = await getServerUser();
	if (!user) {
		return "/login";
	}

	const profile = await getProfile();
	if (!profile) {
		return "/signup/role-picker";
	}

	if (profile.role === "student") {
		// Profile row is already loaded via {@link getProfile} / {@link getCachedAppProfileRow}.
		return "/student/dashboard";
	}
	if (profile.role === "parent") {
		return "/parent/dashboard";
	}
	if (profile.role === "teacher") {
		if (!profile.is_verified) {
			return "/teacher/pending";
		}
		return "/teacher/dashboard";
	}
	if (profile.role === "admin") {
		return "/teacher/dashboard";
	}

	return "/";
}
