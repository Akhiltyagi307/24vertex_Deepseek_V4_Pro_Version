import "server-only";

import { NextResponse } from "next/server";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { consumeStudentRateLimit } from "@/lib/student/rate-limit";

export function qnaPrivateHeaders(extra?: Record<string, string>): HeadersInit {
	return {
		"X-Robots-Tag": "noindex, nofollow",
		"Cache-Control": "no-store",
		...extra,
	};
}

export function qnaJson<T>(body: T, init?: ResponseInit) {
	return NextResponse.json(body, {
		...init,
		headers: qnaPrivateHeaders(init?.headers as Record<string, string> | undefined),
	});
}

/** Maps an HTTP status to a canonical {@link ApiErrorCode}-style code (B3). */
function qnaCodeForStatus(status: number): string {
	switch (status) {
		case 400:
			return "validation_error";
		case 401:
			return "unauthorized";
		case 403:
			return "forbidden";
		case 404:
			return "not_found";
		case 409:
			return "conflict";
		case 429:
			return "rate_limited";
		default:
			return status >= 500 ? "internal_error" : "error";
	}
}

export function qnaError(status: number, message: string) {
	// B3 unification: canonical `{ success, code, message }` + legacy `error`
	// alias (== message) so existing readers keep working.
	return qnaJson({ success: false, code: qnaCodeForStatus(status), message, error: message }, { status });
}

export async function qnaRateLimitCheck(args: {
	userId: string;
	bucket: string;
	limitN: number;
	windowSeconds: number;
}): Promise<NextResponse | null> {
	const result = await consumeStudentRateLimit(args);
	if (result.ok) return null;
	const retryAfterSec = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
	return qnaJson(
		{
			success: false,
			code: "rate_limited",
			message: "Too many requests. Try again shortly.",
			error: "Too many requests. Try again shortly.",
		},
		{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
	);
}

export async function resolveStudentQnaViewer(): Promise<
	| { ok: true; studentId: string; userId: string }
	| { ok: false; response: NextResponse }
> {
	const user = await getServerUser();
	if (!user) return { ok: false, response: qnaError(401, "Unauthorized") };
	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "student") {
		return { ok: false, response: qnaError(403, "Forbidden") };
	}
	return { ok: true, studentId: user.id, userId: user.id };
}

export async function resolveParentQnaViewer(): Promise<
	| { ok: true; studentId: string; userId: string }
	| { ok: false; response: NextResponse }
> {
	const user = await getServerUser();
	if (!user) return { ok: false, response: qnaError(401, "Unauthorized") };
	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "parent") {
		return { ok: false, response: qnaError(403, "Forbidden") };
	}
	const activeStudentId = await getParentActiveStudentIdFromCookie();
	if (!activeStudentId) {
		// Avoid leaking parent-link state in API responses.
		return { ok: false, response: qnaError(404, "Not found.") };
	}
	const linked = await assertParentActiveLink(user.id, activeStudentId);
	if (!linked) {
		return { ok: false, response: qnaError(404, "Not found.") };
	}
	return { ok: true, studentId: activeStudentId, userId: user.id };
}
