import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "edu_recovery_window";
const TTL_SECONDS = 600;

function hmacSecret(): string | null {
	return process.env.RECOVERY_WINDOW_HMAC_SECRET?.trim() || null;
}

function sign(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Opens a short-lived recovery window for the given user. Set by the auth callback
 * after exchanging a password-recovery token; consumed by the update-password action.
 * The cookie's job is to prove that the current session originated from a fresh
 * recovery email (not a stale browser tab) — without it, password updates outside
 * the in-app settings flow are refused.
 *
 * When `RECOVERY_WINDOW_HMAC_SECRET` is configured the cookie is tamper-evident
 * (`<userId>.<nonce>.<hmac>`) so a forged/edited userId is rejected on read.
 * Without the secret it falls back to the legacy unsigned `<userId>.<nonce>` form;
 * the authoritative gate in either case is the Supabase-session match performed by
 * `updatePasswordAction` (this cookie is defense-in-depth, httpOnly + SameSite=Strict).
 */
export async function openRecoveryWindow(userId: string): Promise<void> {
	const cookieStore = await cookies();
	const payload = `${userId}.${randomBytes(16).toString("hex")}`;
	const secret = hmacSecret();
	const value = secret ? `${payload}.${sign(payload, secret)}` : payload;
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

	const secret = hmacSecret();
	if (secret) {
		// Signed form only: `<userId>.<nonce>.<hmac>`. userId (UUID), nonce, and
		// the mac are all dot-free, so exactly three parts are expected. A legacy
		// unsigned cookie minted before the secret was set is rejected here (the
		// user simply re-requests the reset within the 10-minute window).
		const parts = raw.split(".");
		if (parts.length !== 3) return null;
		const [userId, nonce, mac] = parts;
		if (!userId || !nonce || !mac) return null;
		const expected = sign(`${userId}.${nonce}`, secret);
		const macBuf = Buffer.from(mac, "hex");
		const expBuf = Buffer.from(expected, "hex");
		if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) return null;
		return { userId };
	}

	// Legacy unsigned fallback when no signing secret is configured.
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
