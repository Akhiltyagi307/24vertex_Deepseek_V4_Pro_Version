import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from "@/lib/brand/constants";

/**
 * Client-safe metadata key for pending signup payloads in Supabase Auth `user_metadata`.
 * Keep this module free of server-only imports so signup forms can import it from `"use client"` files.
 */
export const VERTEX24_PENDING_REGISTRATION_META_KEY = `${PRODUCT_SLUG}_pending_registration_v1`;

/** @deprecated Read shim only — new signups write `VERTEX24_PENDING_REGISTRATION_META_KEY`. */
export const EDUAI_PENDING_REGISTRATION_META_KEY = `${LEGACY_PRODUCT_SLUG}_pending_registration_v1`;

export const PENDING_REGISTRATION_META_KEYS = [
	VERTEX24_PENDING_REGISTRATION_META_KEY,
	EDUAI_PENDING_REGISTRATION_META_KEY,
] as const;
