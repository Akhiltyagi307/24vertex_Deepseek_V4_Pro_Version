import "server-only";

import { timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import * as jose from "jose";

import { ADMIN_JWT_AUDIENCE, ADMIN_JWT_ISSUER } from "@/lib/admin/constants";
import { getAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { verifyTotp } from "@/lib/admin/totp";

const EIGHT_HOURS_SEC = 8 * 60 * 60;

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

function getJwtSecretKey(): Uint8Array {
	const raw = process.env.ADMIN_JWT_SECRET?.trim();
	if (!raw) {
		throw new Error("ADMIN_JWT_SECRET is not set");
	}
	return new TextEncoder().encode(raw);
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
	const secret = getJwtSecretKey();
	return new jose.SignJWT({ v: params.jwtVersion })
		.setProtectedHeader({ alg: "HS256" })
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
		const secret = getJwtSecretKey();
		const { payload } = await jose.jwtVerify(token, secret, {
			issuer: ADMIN_JWT_ISSUER,
			audience: ADMIN_JWT_AUDIENCE,
			algorithms: ["HS256"],
		});
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
