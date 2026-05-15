/** Canonical charset for `organizations.linking_code` (matches DB check constraint). */
export const ORGANIZATION_LINKING_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 8;

/** Matches DB constraint `organizations_linking_code_format_ck`. */
export const organizationLinkingCodeRegex = new RegExp(
	`^[${ORGANIZATION_LINKING_CODE_CHARSET}]{${CODE_LENGTH}}$`,
);

export function normalizeOrganizationLinkingCodeInput(raw: string): string {
	return raw.replace(/\s+/g, "").toUpperCase();
}

export function generateOrganizationLinkingCode(): string {
	const bytes = new Uint8Array(CODE_LENGTH);
	crypto.getRandomValues(bytes);
	let out = "";
	for (let i = 0; i < CODE_LENGTH; i++) {
		out += ORGANIZATION_LINKING_CODE_CHARSET[bytes[i]! % ORGANIZATION_LINKING_CODE_CHARSET.length]!;
	}
	return out;
}
