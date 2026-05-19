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

export function qnaError(status: number, message: string) {
	return qnaJson({ error: message }, { status });
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
		{ error: "Too many requests. Try again shortly." },
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
