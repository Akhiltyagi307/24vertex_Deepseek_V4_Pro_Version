"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { notifyPasswordChanged } from "@/lib/notifications/account-security";

/**
 * Records a password-changed notification for the signed-in user.
 * Call only after Supabase Auth has successfully updated the password.
 */
export async function recordPasswordChangedAction(): Promise<{ ok: boolean }> {
	const user = await getServerUser();
	if (!user?.id) return { ok: false };
	await notifyPasswordChanged(user.id);
	return { ok: true };
}
