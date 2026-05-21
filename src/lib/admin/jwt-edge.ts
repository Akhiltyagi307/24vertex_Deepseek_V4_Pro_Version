import * as jose from "jose";

import {
	ADMIN_JWT_AUDIENCE,
	ADMIN_JWT_ISSUER,
	LEGACY_ADMIN_JWT_AUDIENCE,
	LEGACY_ADMIN_JWT_ISSUER,
} from "@/lib/admin/constants";

/**
 * D4 / D12: edge-safe key resolver. Mirrors `resolveAdminJwtKeyBytes` in
 * `auth.ts` so the edge guard can pick the right secret based on the kid
 * header without doing a DB roundtrip. Edge runtime can read env vars
 * the same way as Node; no `server-only` import (the file must stay edge-safe).
 */
function resolveAdminJwtKeyBytesEdge(kid: string | null): Uint8Array | null {
	if (kid) {
		const raw = process.env[`ADMIN_JWT_SECRET_${kid}`]?.trim();
		if (!raw) return null;
		return new TextEncoder().encode(raw);
	}
	const fallback = process.env.ADMIN_JWT_SECRET?.trim();
	if (!fallback) return null;
	return new TextEncoder().encode(fallback);
}

/** Edge-safe JWT verify (no server-only). Redis revocation is checked in Node handlers / RSC guards. */
export async function verifyAdminJwtShape(token: string): Promise<{ jti: string; v: number } | null> {
	try {
		let kid: string | null = null;
		try {
			const header = jose.decodeProtectedHeader(token);
			kid = typeof header.kid === "string" ? header.kid : null;
		} catch {
			return null;
		}
		const secret = resolveAdminJwtKeyBytesEdge(kid);
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
		return { jti, v };
	} catch {
		return null;
	}
}
