import { type NextRequest, NextResponse } from "next/server";

import { adminSessionCookieDescriptor, performAdminLogin } from "@/lib/admin/login-core";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
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
					return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400, headers: adminHeaders() });
				}
			} else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
				const form = await request.formData();
				body = {
					email: String(form.get("email") ?? ""),
					password: String(form.get("password") ?? ""),
					totp: form.get("totp") ? String(form.get("totp")) : undefined,
				};
			} else {
				return NextResponse.json(
					{ error: "Unsupported content type", code: "bad_request" },
					{ status: 415, headers: adminHeaders() },
				);
			}

			const email = String(body.email ?? "");
			const password = String(body.password ?? "");
			const totp = body.totp;

			let result: Awaited<ReturnType<typeof performAdminLogin>>;
			try {
				result = await performAdminLogin(request, { email, password, totp });
			} catch (e) {
				Sentry.captureException(e, { tags: { feature: "admin" } });
				return NextResponse.json(
					{ error: "Could not complete sign-in", code: "internal_error" },
					{ status: 500, headers: adminHeaders() },
				);
			}
			if (!result.ok) {
				return NextResponse.json(
					{ error: result.message, code: result.code },
					{ status: result.status, headers: adminHeaders() },
				);
			}

			const { name, options } = adminSessionCookieDescriptor(request);
			const res = NextResponse.json({ ok: true }, { headers: adminHeaders() });
			res.cookies.set(name, result.token, options);
			return res;
		});
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin", admin_login_fatal: "route" } });
		return NextResponse.json(
			{
				error:
					"Unexpected error while finishing sign-in (often a session cookie issue over HTTP). Check Sentry for admin_login_fatal.",
				code: "login_route_crash",
			},
			{ status: 500, headers: adminHeaders() },
		);
	}
}
