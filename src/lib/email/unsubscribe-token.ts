import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getEmailUnsubscribeSecret } from "@/lib/env";

/** 90 days — long enough that an old marketing email still works, short enough to bound replay. */
const DEFAULT_TTL_SECONDS = 90 * 86_400;

const ALG = "sha256";

function base64urlEncode(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
	const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
	return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string, secret: string): Buffer {
	return createHmac(ALG, secret).update(payload).digest();
}

export type UnsubscribeTokenPayload = {
	userId: string;
	exp: number;
};

/**
 * Produces a `List-Unsubscribe` token of the form `${b64(payload)}.${b64(sig)}`,
 * where `payload = "${userId}.${exp}"` and `sig = HMAC-SHA256(payload, secret)`.
 * Returns `null` when no `EMAIL_UNSUBSCRIBE_SECRET` is configured — the email
 * pipeline degrades to "no header" rather than throwing on a hot path.
 */
export function signUnsubscribeToken(userId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string | null {
	const secret = getEmailUnsubscribeSecret();
	if (!secret) return null;
	if (!userId || typeof userId !== "string") return null;
	const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
	const payload = `${userId}.${exp}`;
	const sig = sign(payload, secret);
	return `${base64urlEncode(Buffer.from(payload))}.${base64urlEncode(sig)}`;
}

/**
 * Verifies an unsubscribe token. Returns the decoded payload on success, or
 * `null` for any failure (no secret configured, malformed token, bad
 * signature, expired). Constant-time signature compare so a token-by-token
 * brute force can't probe individual byte differences.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
	const secret = getEmailUnsubscribeSecret();
	if (!secret) return null;
	if (!token || typeof token !== "string") return null;

	const parts = token.split(".");
	if (parts.length !== 2) return null;

	let payloadBuf: Buffer;
	let sigBuf: Buffer;
	try {
		payloadBuf = base64urlDecode(parts[0]);
		sigBuf = base64urlDecode(parts[1]);
	} catch {
		return null;
	}

	const payload = payloadBuf.toString("utf8");
	const expected = sign(payload, secret);
	if (sigBuf.length !== expected.length) return null;
	if (!timingSafeEqual(sigBuf, expected)) return null;

	const [userId, expRaw] = payload.split(".");
	if (!userId) return null;
	const exp = Number.parseInt(expRaw ?? "", 10);
	if (!Number.isFinite(exp)) return null;
	if (Math.floor(Date.now() / 1000) >= exp) return null;

	return { userId, exp };
}
