import { type NextRequest } from "next/server";

import { adminSessionCookieDescriptor, performAdminLogin } from "@/lib/admin/login-core";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

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
					return adminErrorResponse("Invalid JSON", { code: "bad_request" });
				}
			} else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
				const form = await request.formData();
				body = {
					email: String(form.get("email") ?? ""),
					password: String(form.get("password") ?? ""),
					totp: form.get("totp") ? String(form.get("totp")) : undefined,
				};
			} else {
				return adminErrorResponse("Unsupported content type", { status: 415, code: "bad_request" });
			}

			const email = String(body.email ?? "");
			const password = String(body.password ?? "");
			const totp = body.totp;

			let result: Awaited<ReturnType<typeof performAdminLogin>>;
			try {
				result = await performAdminLogin(request, { email, password, totp });
			} catch (e) {
				Sentry.captureException(e, { tags: { feature: "admin" } });
				return adminErrorResponse("Could not complete sign-in", {
					status: 500,
					code: "internal_error",
				});
			}
			if (!result.ok) {
				return adminErrorResponse(result.message, { status: result.status, code: result.code });
			}

			const { name, options } = adminSessionCookieDescriptor(request);
			const res = adminAckResponse();
			res.cookies.set(name, result.token, options);
			return res;
		});
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin", admin_login_fatal: "route" } });
		return adminErrorResponse(
			"Unexpected error while finishing sign-in (often a session cookie issue over HTTP). Check Sentry for admin_login_fatal.",
			{ status: 500, code: "login_route_crash" },
		);
	}
}
