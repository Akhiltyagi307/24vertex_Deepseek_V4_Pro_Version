"use server";

import { recordPasswordChangedAction as recordPasswordChangedActionShared } from "@/lib/auth/account-security-actions";

/**
 * Back-compat re-export. The canonical implementation now lives at
 * `src/lib/auth/account-security-actions.ts` so non-student callers
 * (recovery flow, teacher/parent in-app settings) don't have to import
 * from a student-portal path.
 */
export async function recordPasswordChangedAction(): Promise<{ ok: boolean }> {
	return recordPasswordChangedActionShared();
}
