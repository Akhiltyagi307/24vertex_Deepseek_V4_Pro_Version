import { getSupabaseUrl } from "@/lib/env";

/** Max upload size enforced in UI and bucket (5 MiB). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * True if `avatarUrl` is a public object URL under this project's `avatars` bucket for `userId`,
 * using our stable keys `avatar.webp` or `avatar.jpg`.
 */
export function isOwnSupabaseAvatarUrl(avatarUrl: string, userId: string): boolean {
	try {
		const u = new URL(avatarUrl);
		const base = new URL(getSupabaseUrl());
		if (u.origin !== base.origin) {
			return false;
		}
		const prefix = `/storage/v1/object/public/avatars/${userId}/`;
		if (!u.pathname.startsWith(prefix)) {
			return false;
		}
		const rest = u.pathname.slice(prefix.length);
		return rest === "avatar.webp" || rest === "avatar.jpg";
	} catch {
		return false;
	}
}
