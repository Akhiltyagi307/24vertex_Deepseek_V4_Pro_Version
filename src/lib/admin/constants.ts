/** HttpOnly cookie for operator JWT (Path=/ so /api/admin/* receives it). */
export const ADMIN_SESSION_COOKIE = "edu_admin_session";

/** Set when an operator opens an impersonation magic link target session (student/parent/teacher UI shows banner). */
export const ADMIN_IMPERSONATION_COOKIE = "edu_admin_impersonating";

export const ADMIN_JWT_ISSUER = "eduai-admin";
export const ADMIN_JWT_AUDIENCE = "eduai-admin-panel";

/** `admin_runtime_kv.key` — increment on panic to invalidate JWTs with lower embedded `v`. */
export const ADMIN_RUNTIME_KV_JWT_VERSION = "jwt_version";
