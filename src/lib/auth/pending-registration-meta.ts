/**
 * Client-safe metadata key for pending signup payloads in Supabase Auth `user_metadata`.
 * Keep this module free of server-only imports so signup forms can import it from `"use client"` files.
 */
export const EDUAI_PENDING_REGISTRATION_META_KEY = "eduai_pending_registration_v1";
