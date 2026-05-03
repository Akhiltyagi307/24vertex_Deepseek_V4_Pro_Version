import "server-only";

import { verifySync } from "otplib";

export function verifyTotp(secret: string | undefined, token: string | undefined): boolean {
	if (!secret || !token?.trim()) return false;
	try {
		const result = verifySync({
			secret,
			token: token.trim(),
			epochTolerance: 1,
		});
		return result.valid === true;
	} catch {
		return false;
	}
}
