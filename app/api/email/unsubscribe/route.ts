import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { userPreferences } from "@/db/schema/comms-audit";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { rlConsume } from "@/lib/ratelimit/consume";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { logServerError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noindexHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

async function flipEmailNotificationsOff(userId: string): Promise<{ ok: boolean; error?: string }> {
	try {
		await db
			.insert(userPreferences)
			.values({
				userId,
				enableEmailNotifications: false,
			})
			.onConflictDoUpdate({
				target: userPreferences.userId,
				set: {
					enableEmailNotifications: false,
					updatedAt: new Date(),
				},
			});
		return { ok: true };
	} catch (err) {
		logServerError("email.unsubscribe.upsert_prefs", err, { userId });
		return { ok: false, error: "Could not update preferences." };
	}
}

function renderConfirmationHtml(state: "ok" | "expired" | "invalid"): string {
	const title = state === "ok" ? "You're unsubscribed" : state === "expired" ? "This link has expired" : "Link not recognised";
	const body =
		state === "ok"
			? "We've turned off transactional email for your 24Vertex account. You can re-enable it anytime from Account settings."
			: state === "expired"
				? "Open the latest 24Vertex email and use the unsubscribe link inside it, or sign in and adjust notification preferences directly."
				: "We couldn't verify this unsubscribe link. Open a recent 24Vertex email and try again, or sign in to manage notification preferences directly.";
	const accent = state === "ok" ? "#2ea070" : "#9a4a06";
	return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — 24Vertex</title>
</head>
<body style="margin:0;background:#f5f5f4;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
<main style="max-width:520px;margin:48px auto;background:#ffffff;border:1px solid #e6e8eb;border-radius:18px;padding:36px;">
  <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#e6f4ee;color:${accent};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">24Vertex</div>
  <h1 style="margin:18px 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.02em;">${title}</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">${body}</p>
  <p style="margin:0;"><a href="/student/settings#notifications" style="display:inline-block;background:#2ea070;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:10px;">Account settings</a></p>
</main>
</body></html>`;
}

// Per-IP rate limit on unsubscribe attempts. The endpoint accepts an HMAC
// token in `?t=`; without throttling, an attacker could brute-force valid
// tokens (16^64 search space is theoretically large but the gate would log
// a verification attempt for each guess at full network speed). 20 attempts
// per 5 minutes is generous for a real user (one click per email) and harsh
// for any automated probe. Rate limit is keyed on IP because we don't have
// a user identity until the token verifies.
const UNSUBSCRIBE_RATE_LIMIT_PER_WINDOW = 20;
const UNSUBSCRIBE_RATE_WINDOW_SEC = 300;

async function handle(request: NextRequest, method: "GET" | "POST"): Promise<NextResponse> {
	const ip = clientIpFromHeaders(request.headers);
	const rl = await rlConsume({
		key: `unsubscribe:ip:${ip}`,
		limit: UNSUBSCRIBE_RATE_LIMIT_PER_WINDOW,
		windowSec: UNSUBSCRIBE_RATE_WINDOW_SEC,
	});
	if (!rl.allowed) {
		// Capture the rate-limit hit so we can spot brute-force patterns.
		// Sentry already de-duplicates similar events; this won't spam.
		Sentry.captureMessage("email.unsubscribe.rate_limited", {
			level: "warning",
			tags: { feature: "email.unsubscribe", phase: "rate_limit" },
		});
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return method === "POST"
			? NextResponse.json(
					{ ok: false, error: "rate_limited" },
					{ status: 429, headers: { ...noindexHeaders(), "Retry-After": String(retryAfterSec) } },
				)
			: new NextResponse(renderConfirmationHtml("invalid"), {
					status: 429,
					headers: {
						...noindexHeaders(),
						"content-type": "text/html; charset=utf-8",
						"Retry-After": String(retryAfterSec),
					},
				});
	}

	// RFC 8058 one-click unsubscribe sends `List-Unsubscribe=One-Click` as the
	// POST body. We don't require it (some clients send empty), but if the
	// body is set it must say so — otherwise this looks like a CSRF probe.
	if (method === "POST") {
		const ct = (request.headers.get("content-type") ?? "").toLowerCase();
		if (ct.startsWith("application/x-www-form-urlencoded")) {
			try {
				const text = await request.text();
				const params = new URLSearchParams(text);
				const flag = params.get("List-Unsubscribe")?.trim();
				if (flag && flag !== "One-Click") {
					return NextResponse.json(
						{ ok: false, error: "Unsupported one-click body." },
						{ status: 400, headers: noindexHeaders() },
					);
				}
			} catch {
				// Empty / malformed body is OK — treat as a bare one-click POST.
			}
		}
	}

	const token = request.nextUrl.searchParams.get("t")?.trim();
	if (!token) {
		return method === "POST"
			? NextResponse.json({ ok: false, error: "missing token" }, { status: 400, headers: noindexHeaders() })
			: new NextResponse(renderConfirmationHtml("invalid"), {
					status: 400,
					headers: { ...noindexHeaders(), "content-type": "text/html; charset=utf-8" },
				});
	}

	const decoded = verifyUnsubscribeToken(token);
	if (!decoded) {
		// Failed verification gets a Sentry warning so a probing pattern
		// shows up (the per-IP rate limit alone wouldn't tell us "many IPs
		// each tried 5 different tokens" — Sentry aggregations will).
		Sentry.captureMessage("email.unsubscribe.token_invalid", {
			level: "warning",
			tags: { feature: "email.unsubscribe", phase: "verify_token" },
		});
		// We can't tell expired vs invalid from the verify result; expired tokens
		// are far more common in practice, so we surface that copy when the
		// payload looks well-formed (two segments) and "invalid" otherwise.
		const looksWellFormed = token.split(".").length === 2;
		const state = looksWellFormed ? "expired" : "invalid";
		return method === "POST"
			? NextResponse.json({ ok: false, error: state }, { status: 410, headers: noindexHeaders() })
			: new NextResponse(renderConfirmationHtml(state), {
					status: state === "expired" ? 410 : 400,
					headers: { ...noindexHeaders(), "content-type": "text/html; charset=utf-8" },
				});
	}

	const result = await flipEmailNotificationsOff(decoded.userId);
	if (!result.ok) {
		return method === "POST"
			? NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: noindexHeaders() })
			: new NextResponse(renderConfirmationHtml("invalid"), {
					status: 500,
					headers: { ...noindexHeaders(), "content-type": "text/html; charset=utf-8" },
				});
	}

	return method === "POST"
		? NextResponse.json({ ok: true }, { headers: noindexHeaders() })
		: new NextResponse(renderConfirmationHtml("ok"), {
				status: 200,
				headers: { ...noindexHeaders(), "content-type": "text/html; charset=utf-8" },
			});
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	return handle(request, "GET");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	return handle(request, "POST");
}
