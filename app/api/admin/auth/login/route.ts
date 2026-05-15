import { type NextRequest, type NextResponse } from "next/server";

import { adminSessionCookieDescriptor, performAdminLogin } from "@/lib/admin/login-core";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

/**
 * Marks responses from this Route Handler. If DevTools → Network → login shows the ADMIN_IP_ALLOWLIST
 * JSON body but this header is missing, the browser is not reaching this app build (wrong host / proxy / tunnel).
 */
function stampAdminLoginHandler(res: NextResponse, loginCode?: string): NextResponse {
	res.headers.set("X-EduAI-Admin-Login-Handler", "app-route");
	if (loginCode) res.headers.set("X-EduAI-Login-Code", loginCode);
	return res;
}

export async function POST(request: NextRequest) {
	try {
		return await Sentry.withScope(async (scope) => {
			scope.setTag("feature", "admin");
			let body: { email?: string; password?: string; totp?: string } = {};
			const ct = request.headers.get("content-type") ?? "";
			if (ct.includes("application/json")) {
				try {
					body = (await request.json()) as typeof body;
				} catch {
					return stampAdminLoginHandler(adminErrorResponse("Invalid JSON", { code: "bad_request" }), "bad_request");
				}
			} else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
				const form = await request.formData();
				body = {
					email: String(form.get("email") ?? ""),
					password: String(form.get("password") ?? ""),
					totp: form.get("totp") ? String(form.get("totp")) : undefined,
				};
			} else {
				return stampAdminLoginHandler(adminErrorResponse("Unsupported content type", { status: 415, code: "bad_request" }), "bad_request");
			}

			const email = String(body.email ?? "");
			const password = String(body.password ?? "");
			const totp = body.totp;

			let result: Awaited<ReturnType<typeof performAdminLogin>>;
			try {
				result = await performAdminLogin(request, { email, password, totp });
			} catch (e) {
				Sentry.captureException(e, { tags: { feature: "admin" } });
				return stampAdminLoginHandler(
					adminErrorResponse("Could not complete sign-in", {
						status: 500,
						code: "internal_error",
					}),
					"internal_error",
				);
			}
			if (!result.ok) {
				if (process.env.NODE_ENV === "development") {
					console.warn("[admin login] rejected:", result.code);
				}
				return stampAdminLoginHandler(
					adminErrorResponse(result.message, { status: result.status, code: result.code }),
					result.code,
				);
			}

			const { name, options } = adminSessionCookieDescriptor(request);
			const res = adminAckResponse();
			res.cookies.set(name, result.token, options);
			return stampAdminLoginHandler(res);
		});
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin", admin_login_fatal: "route" } });
		return stampAdminLoginHandler(
			adminErrorResponse(
				"Unexpected error while finishing sign-in (often a session cookie issue over HTTP). Check Sentry for admin_login_fatal.",
				{ status: 500, code: "login_route_crash" },
			),
			"login_route_crash",
		);
	}
}
