import "server-only";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { postAuthPathFromProfile } from "@/lib/auth/post-auth-path";

export type ProfileRow = {
	id: string;
	role: string;
	is_verified: boolean | null;
	is_suspended: boolean | null;
};

/**
 * Uses {@link getCachedAppProfileRow} (React `cache`) so role checks share one `profiles` read
 * with layout and student pages in the same request.
 */
export async function getProfile(): Promise<ProfileRow | null> {
	const row = await getCachedAppProfileRow();
	if (!row) return null;
	return { id: row.id, role: row.role, is_verified: row.is_verified, is_suspended: row.is_suspended };
}

/** Where to send a signed-in user (dashboard or onboarding). */
export async function resolvePostAuthPath(): Promise<string> {
	const user = await getServerUser();
	if (!user) {
		return "/login";
	}

	const profile = await getProfile();
	return postAuthPathFromProfile(
		profile ? { role: profile.role, is_verified: profile.is_verified } : null,
	);
}
