import { NextRequest } from "next/server";

/**
 * D32: shared helpers for admin Route Handler unit tests.
 *
 * Each test file declares its own `vi.mock("@/lib/admin/api-auth", …)` so
 * the gate can return either the fake admin payload below or a 401/403
 * NextResponse — but the JTI / session id constants and request-building
 * helpers live here so the call shape stays uniform across the suite.
 */

export const FAKE_ADMIN_JTI = "00000000-0000-4000-8000-000000000001";
export const FAKE_ADMIN_SESSION_ID = "00000000-0000-4000-8000-0000000000aa";

export const ADMIN_GATE_ALLOW = {
	jti: FAKE_ADMIN_JTI,
	sessionId: FAKE_ADMIN_SESSION_ID,
};

/** Build a NextRequest pointed at a fake admin route. */
export function adminRequest(
	url: string,
	init: {
		method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
		body?: unknown;
		headers?: Record<string, string>;
	} = {},
): NextRequest {
	const headers = new Headers(init.headers ?? {});
	if (init.body !== undefined && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	return new NextRequest(new URL(url, "http://localhost:3001"), {
		method: init.method ?? "POST",
		headers,
		body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
	});
}
