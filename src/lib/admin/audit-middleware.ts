import "server-only";

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";

/**
 * Context passed to admin route handlers wrapped by `withAdminAudit`.
 *
 * `gate` is whatever `requireAdminApi` produced (currently `{ jti }`).
 * `audit.scope` is a stable per-admin identifier suitable for the
 * `consumeAdminActionRateLimit` scope argument.
 *
 * Why a wrapper instead of having every handler call `requireAdminApi`,
 * `clientIpFromRequest`, `userAgentFromRequest` separately:
 *
 *   - Twelve admin routes were found during the audit that wrote audit
 *     rows without IP or UA because the call sites just forgot. Centralizing
 *     the extraction makes that impossible.
 *   - Wrapping in `Sentry.withScope` here means every admin handler gets a
 *     `feature: admin` tag without each handler having to remember.
 *   - Encourages a uniform return shape — handlers return `NextResponse`
 *     directly, no more `gate instanceof NextResponse` boilerplate at the
 *     top of every file.
 *
 * Failure semantics: if the auth gate rejects, the wrapper short-circuits
 * with that response. If the inner handler throws, we let it propagate to
 * Next's error boundary so the existing error UX still applies.
 */

export interface AdminAuditContext {
	jti: string;
	ip: string;
	userAgent: string;
	/** Stable scope for per-admin rate-limit keys. */
	scope: string;
}

export type AdminRouteHandler<TParams = Record<string, never>> = (
	request: NextRequest,
	ctx: { params: TParams; audit: AdminAuditContext },
) => Promise<NextResponse>;

/**
 * Build the scope key with the same precedence as `adminActionScope` in
 * `rate-limit-action.ts`. Inlined here to avoid a circular import — both
 * modules currently start clean.
 */
function buildScope(jti: string, ip: string): string {
	if (jti) return `jti:${jti}`;
	if (ip && ip !== "0.0.0.0") return `ip:${ip}`;
	return "scope:unknown";
}

export function withAdminAudit<TParams = Record<string, never>>(
	handler: AdminRouteHandler<TParams>,
): (request: NextRequest, routerCtx: { params: Promise<TParams> }) => Promise<NextResponse> {
	return async (request, routerCtx) => {
		return Sentry.withScope(async (scope) => {
			scope.setTag("feature", "admin");

			const gate = await requireAdminApi();
			if (gate instanceof NextResponse) return gate;

			const ip = clientIpFromRequest(request);
			const userAgent = userAgentFromRequest(request);
			const scopeKey = buildScope(gate.jti, ip);

			scope.setTag("admin_jti", gate.jti);

			const params = await routerCtx.params;
			return handler(request, {
				params,
				audit: {
					jti: gate.jti,
					ip,
					userAgent,
					scope: scopeKey,
				},
			});
		});
	};
}
