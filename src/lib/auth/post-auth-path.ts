/**
 * Pure mapping used after authentication when we already know the `profiles` row
 * (or that it is missing) and a Supabase session exists.
 *
 * Keep in sync with {@link resolvePostAuthPath} in `./routing.ts`.
 */
export type PostAuthProfileInput = {
	role: string;
	is_verified: boolean | null;
};

export function postAuthPathFromProfile(profile: PostAuthProfileInput | null): string {
	if (!profile) {
		return "/signup/role-picker";
	}

	if (profile.role === "student") {
		return "/student/dashboard";
	}
	if (profile.role === "parent") {
		return "/parent/select-student";
	}
	if (profile.role === "teacher") {
		return profile.is_verified ? "/teacher/dashboard" : "/teacher/pending";
	}
	if (profile.role === "admin") {
		return "/";
	}

	return "/";
}
