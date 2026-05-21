import "server-only";

import { timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import * as jose from "jose";

import {
	ADMIN_JWT_AUDIENCE,
	ADMIN_JWT_ISSUER,
	LEGACY_ADMIN_JWT_AUDIENCE,
	LEGACY_ADMIN_JWT_ISSUER,
} from "@/lib/admin/constants";
import { getAdminJwtKid, getAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { verifyTotp } from "@/lib/admin/totp";

const EIGHT_HOURS_SEC = 8 * 60 * 60;

/**
 * D4 / D12: kid-aware key resolver. Tokens may carry a `kid` header pointing
 * to one of several env-keyed secrets (`ADMIN_JWT_SECRET_v1`, `_v2`, …);
 * legacy tokens with no kid header verify against the existing
 * `ADMIN_JWT_SECRET` (back-compat).
 *
 *   - kid present + matching env set → use that key
 *   - kid present + matching env missing → return null (reject)
 *   - kid absent → fall back to ADMIN_JWT_SECRET
 *
 * Reject-on-missing is intentional: a token claiming a retired kid should
 * not silently succeed against the legacy key.
 */
export function resolveAdminJwtKeyBytes(kid: string | null): Uint8Array | null {
	if (kid) {
		const raw = process.env[`ADMIN_JWT_SECRET_${kid}`]?.trim();
		if (!raw) return null;
		return new TextEncoder().encode(raw);
	}
	const fallback = process.env.ADMIN_JWT_SECRET?.trim();
	if (!fallback) return null;
	return new TextEncoder().encode(fallback);
}

/**
 * Pick the next available kid for panic rotation. Scans `ADMIN_JWT_SECRET_vN`
 * env vars (v1…v99) for any that's not the current kid; returns the lowest
 * such N. Returns null when no fresh secret is available — caller logs and
 * keeps the version bump.
 */
export function chooseNextAdminJwtKid(currentKid: string | null): string | null {
	for (let i = 1; i <= 99; i++) {
		const k = `v${i}`;
		if (k === currentKid) continue;
		const raw = process.env[`ADMIN_JWT_SECRET_${k}`]?.trim();
		if (raw) return k;
	}
	return null;
}

/** Implementation plan §10.6 — bcrypt-based `ADMIN_PASSWORD_HASH*` must use work factor ≥ 12 in production. */
const ADMIN_BCRYPT_MIN_COST = 12;

function bcryptWorkFactorFromHash(hash: string): number | null {
	const m = hash.match(/^\$2[aby]\$(\d{2})\$/);
	if (!m) return null;
	const n = Number.parseInt(m[1], 10);
	return Number.isFinite(n) ? n : null;
}

function adminBcryptHashAllowedAtRuntime(hash: string): boolean {
	if (process.env.NODE_ENV !== "production") return true;
	const cost = bcryptWorkFactorFromHash(hash);
	return cost != null && cost >= ADMIN_BCRYPT_MIN_COST;
}

function getJwtSecretKey(kid: string | null = null): Uint8Array {
	const bytes = resolveAdminJwtKeyBytes(kid);
	if (!bytes) {
		throw new Error(
			kid
				? `ADMIN_JWT_SECRET_${kid} is not set (kid="${kid}" requested)`
				: "ADMIN_JWT_SECRET is not set",
		);
	}
	return bytes;
}

/** Normalize a secret from .env (trim; strip one pair of surrounding quotes from copy-paste). */
export function normalizeAdminEnvSecret(raw: string | undefined): string {
	let s = raw?.trim() ?? "";
	if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
		s = s.slice(1, -1).trim();
	}
	return s;
}

/** @deprecated Use normalizeAdminEnvSecret; kept for tests and bcrypt migration. */
export function normalizeAdminPasswordHash(raw: string | undefined): string {
	return normalizeAdminEnvSecret(raw);
}

/**
 * Next.js loads `.env*` with dotenv-expand: unescaped `$` is treated as expansion and bcrypt hashes break.
 * Supports hashes written with `\$` for each literal dollar, or `$$` pairs (expand “literal $” form).
 */
export function normalizeBcryptHashFromEnv(raw: string | undefined): string {
	let h = normalizeAdminEnvSecret(raw);
	h = h.replace(/\\\$/g, "$");
	h = h.replace(/\$\$/g, "$");
	return h;
}

function timingSafeEqualUtf8(plain: string, expected: string): boolean {
	const a = Buffer.from(plain, "utf8");
	const b = Buffer.from(expected, "utf8");
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/**
 * Precedence: `ADMIN_PASSWORD_HASH_B64` (bcrypt, recommended) → plain `ADMIN_PASSWORD` → legacy `ADMIN_PASSWORD_HASH`.
 * When `ADMIN_PASSWORD_HASH_B64` is set, plain and legacy hash env vars are ignored (bcrypt-only).
 */
export async function verifyAdminPassword(plain: string): Promise<boolean> {
	const b64 = normalizeAdminEnvSecret(process.env.ADMIN_PASSWORD_HASH_B64);
	if (b64.length > 0) {
		try {
			const decoded = Buffer.from(b64, "base64").toString("utf8");
			if (!/^\$2[aby]\$\d{2}\$/.test(decoded)) {
				return false;
			}
			if (!adminBcryptHashAllowedAtRuntime(decoded)) return false;
			return await bcrypt.compare(plain, decoded);
		} catch {
			return false;
		}
	}

	const configuredPlain = normalizeAdminEnvSecret(process.env.ADMIN_PASSWORD);
	if (configuredPlain.length > 0) {
		// D1: plaintext ADMIN_PASSWORD is never honored in production. Operators
		// must use ADMIN_PASSWORD_HASH_B64 (bcrypt). The plain branch exists for
		// local dev only; instrumentation.ts also throws at boot if it slips into prod.
		if (process.env.NODE_ENV === "production") return false;
		return timingSafeEqualUtf8(plain, configuredPlain);
	}

	const hash = normalizeBcryptHashFromEnv(process.env.ADMIN_PASSWORD_HASH);
	if (!hash) return false;
	if (!/^\$2[aby]\$\d{2}\$/.test(hash)) {
		return false;
	}
	if (!adminBcryptHashAllowedAtRuntime(hash)) return false;
	try {
		return await bcrypt.compare(plain, hash);
	} catch {
		return false;
	}
}

export async function signAdminJwt(params: { jti: string; jwtVersion: number }): Promise<string> {
	// D4 / D12: stamp the current kid into the JWT header so verifiers can
	// pick the right key. When no kid is registered, we sign with the legacy
	// secret and omit the header (existing tokens stay valid).
	const kid = await getAdminJwtKid();
	const secret = getJwtSecretKey(kid);
	const header: { alg: "HS256"; kid?: string } = { alg: "HS256" };
	if (kid) header.kid = kid;
	return new jose.SignJWT({ v: params.jwtVersion })
		.setProtectedHeader(header)
		.setSubject("admin")
		.setJti(params.jti)
		.setIssuedAt()
		.setIssuer(ADMIN_JWT_ISSUER)
		.setAudience(ADMIN_JWT_AUDIENCE)
		.setExpirationTime(`${EIGHT_HOURS_SEC}s`)
		.sign(secret);
}

export type AdminJwtPayload = {
	jti: string;
	v: number;
};

export async function verifyAdminJwt(token: string): Promise<AdminJwtPayload | null> {
	try {
		// D4 / D12: peek at the kid header without verifying, then look up the
		// matching secret. Tokens without a kid header verify against the
		// legacy ADMIN_JWT_SECRET (backward compatible).
		let kid: string | null = null;
		try {
			const header = jose.decodeProtectedHeader(token);
			kid = typeof header.kid === "string" ? header.kid : null;
		} catch {
			return null;
		}
		const secret = resolveAdminJwtKeyBytes(kid);
		if (!secret) return null;
		const issuerAudiencePairs: { issuer: string; audience: string }[] = [
			{ issuer: ADMIN_JWT_ISSUER, audience: ADMIN_JWT_AUDIENCE },
			{ issuer: LEGACY_ADMIN_JWT_ISSUER, audience: LEGACY_ADMIN_JWT_AUDIENCE },
		];
		let payload: jose.JWTPayload | null = null;
		for (const { issuer, audience } of issuerAudiencePairs) {
			try {
				const verified = await jose.jwtVerify(token, secret, {
					issuer,
					audience,
					algorithms: ["HS256"],
				});
				payload = verified.payload;
				break;
			} catch {
				/* try legacy issuer */
			}
		}
		if (!payload) return null;
		const jti = typeof payload.jti === "string" ? payload.jti : null;
		if (!jti) return null;
		const v = typeof payload.v === "number" ? payload.v : Number(payload.v);
		if (!Number.isFinite(v)) return null;
		const current = await getAdminJwtVersion();
		if (v < current) return null;
		return { jti, v };
	} catch {
		return null;
	}
}

export function verifyAdminEmail(email: string): boolean {
	const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
	if (!expected) return false;
	return email.trim().toLowerCase() === expected;
}

export function verifyAdminTotpIfConfigured(token: string | undefined): boolean {
	const secret = process.env.ADMIN_TOTP_SECRET?.trim();
	if (!secret) return true;
	return verifyTotp(secret, token);
}
