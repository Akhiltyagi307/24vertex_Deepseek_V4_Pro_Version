import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "edu_recovery_window";
const TTL_SECONDS = 600;

/**
 * Opens a short-lived recovery window for the given user. Set by the auth callback
 * after exchanging a password-recovery token; consumed by the update-password action.
 * The cookie's job is to prove that the current session originated from a fresh
 * recovery email (not a stale browser tab) — without it, password updates outside
 * the in-app settings flow are refused.
 */
export async function openRecoveryWindow(userId: string): Promise<void> {
	const cookieStore = await cookies();
	const value = `${userId}.${randomBytes(16).toString("hex")}`;
	cookieStore.set(COOKIE_NAME, value, {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: TTL_SECONDS,
	});
}

export async function readRecoveryWindow(): Promise<{ userId: string } | null> {
	const cookieStore = await cookies();
	const raw = cookieStore.get(COOKIE_NAME)?.value;
	if (!raw) return null;
	const dot = raw.indexOf(".");
	if (dot <= 0) return null;
	const userId = raw.slice(0, dot);
	return userId ? { userId } : null;
}

export async function closeRecoveryWindow(): Promise<void> {
	const cookieStore = await cookies();
	// Match the path the cookie was set with so the browser actually deletes it.
	cookieStore.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
