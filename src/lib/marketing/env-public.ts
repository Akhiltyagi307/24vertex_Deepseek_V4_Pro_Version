/** Optional registered entity name for marketing/contact pages. */
export function getPublicLegalEntityName(): string | null {
	const raw = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
	return raw || null;
}

/** Optional registered address for marketing/contact pages. */
export function getPublicRegisteredAddress(): string | null {
	const raw = process.env.NEXT_PUBLIC_REGISTERED_ADDRESS?.trim();
	return raw || null;
}
