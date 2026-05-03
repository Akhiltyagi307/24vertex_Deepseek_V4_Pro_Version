import * as jose from "jose";

import { ADMIN_JWT_AUDIENCE, ADMIN_JWT_ISSUER } from "@/lib/admin/constants";

function getJwtSecretKey(): Uint8Array {
	const raw = process.env.ADMIN_JWT_SECRET?.trim();
	if (!raw) {
		throw new Error("ADMIN_JWT_SECRET is not set");
	}
	return new TextEncoder().encode(raw);
}

/** Edge-safe JWT verify (no server-only). Redis revocation is checked in Node handlers / RSC guards. */
export async function verifyAdminJwtShape(token: string): Promise<{ jti: string; v: number } | null> {
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
		return { jti, v };
	} catch {
		return null;
	}
}
