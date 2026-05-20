/** HttpOnly cookie for operator JWT (Path=/ so /api/admin/* receives it). */
export const ADMIN_SESSION_COOKIE = "edu_admin_session";

/** Set when an operator opens an impersonation magic link target session (student/parent/teacher UI shows banner). */
export const ADMIN_IMPERSONATION_COOKIE = "edu_admin_impersonating";

export const ADMIN_JWT_ISSUER = "eduai-admin";
export const ADMIN_JWT_AUDIENCE = "eduai-admin-panel";

/** `admin_runtime_kv.key` — increment on panic to invalidate JWTs with lower embedded `v`. */
export const ADMIN_RUNTIME_KV_JWT_VERSION = "jwt_version";

/**
 * D10: cross-process logout tombstone key prefix. Logout writes a row
 * `revoked:<jti>` with `value_int = expires_at_epoch_ms`. `requireAdminApi`
 * checks the tombstone on cache hits so an admin session revoked on one
 * Node process cannot continue to validate on another for up to the
 * session-cache TTL (10s).
 */
export const ADMIN_RUNTIME_KV_REVOKED_PREFIX = "revoked:";

/**
 * Session revocation tombstone TTL (ms). Set slightly above the in-process
 * session cache TTL (10s) so a tombstone outlives any cached entry that
 * might still reference the revoked jti.
 */
export const ADMIN_SESSION_REVOKE_TTL_MS = 12_000;

/**
 * D3 / D13: SHA-256 fingerprint of the active `ADMIN_TOTP_SECRET`, stored as
 * hex in `admin_runtime_kv.value_json.fingerprint`. Compared on every login
 * that succeeds via TOTP; on mismatch a `TOTP_SECRET_ROTATED` audit row is
 * written and the stored fingerprint is updated, giving operators a clear
 * audit trail when the secret is rotated.
 */
export const ADMIN_RUNTIME_KV_TOTP_FINGERPRINT = "totp_secret_fingerprint";

/**
 * D4 / D12: current `kid` for admin JWTs, stored in `admin_runtime_kv`.
 * The associated key bytes are read from `ADMIN_JWT_SECRET_<kid>` (env-
 * keyed), falling back to `ADMIN_JWT_SECRET` for backward compatibility.
 * Panic rotates the kid alongside the jwt_version bump so a leaked HS256
 * key is immediately invalidated at the edge as well as inside Node.
 */
export const ADMIN_RUNTIME_KV_JWT_KID = "admin_jwt_kid";
