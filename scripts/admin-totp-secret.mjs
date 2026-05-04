#!/usr/bin/env node
/**
 * Generates ADMIN_TOTP_SECRET (base32) and an otpauth:// URI for Google Authenticator / compatible apps.
 * Uses the same `otplib` stack as `src/lib/admin/totp.ts`.
 *
 *   pnpm run admin:totp-secret
 *   pnpm run admin:totp-secret -- --issuer "EduAI" --label "admin@example.com"
 */
import { generateSecret, generateURI } from "otplib";

function parseArgs(argv) {
	const rest = argv.filter((a) => a !== "--");
	let issuer = "EduAI-Admin";
	let label = "admin";
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--issuer" && rest[i + 1]) {
			issuer = rest[++i];
			continue;
		}
		if (a === "--label" && rest[i + 1]) {
			label = rest[++i];
			continue;
		}
		if (a === "-h" || a === "--help") return { help: true, issuer, label };
	}
	return { help: false, issuer, label };
}

const { help, issuer, label } = parseArgs(process.argv.slice(2));
if (help) {
	console.error("Usage: pnpm run admin:totp-secret [-- --issuer NAME --label ACCOUNT]");
	process.exit(0);
}

const secret = generateSecret();
const uri = generateURI({ issuer, label, secret });

console.log("");
console.log("1) Put this in .env.local (then restart the dev server):");
console.log("");
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log("");
console.log("2) Google Authenticator → + → Enter a setup key");
console.log(`   Name: ${issuer} (${label})`);
console.log("   Key: paste the secret above (same line, no spaces)");
console.log("   Type: Time based");
console.log("");
console.log("3) Optional: scan a QR code — encode this URI (do not log in CI):");
console.log(uri);
console.log("");
