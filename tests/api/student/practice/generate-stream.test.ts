/**
 * Route-handler tests for `POST /api/student/practice/generate-stream`.
 *
 * Stream-based handler tests need:
 *   - the production gate (PRACTICE_STREAM=true / NODE_ENV) flipped per test
 *   - the practice-generation pipeline mocked (safeParse / preflight / run)
 *   - the auth helper mocked
 *   - an NDJSON reader to assert the stream's last envelope
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readNdjson } from "../../../factories";

// Hoisted shared state. Types are deliberately wide (`unknown` returns,
// loose function shapes) so each test can flip the implementation to a
// different verdict (success / paywall / validation_error / throws)
// without fighting TypeScript narrowing.
type PipelineMockShape = {
	safeParseGenerationInput: (json: unknown) => { success: boolean; data?: unknown; error?: unknown };
	preflightPracticeGeneration: () => Promise<unknown>;
	runPracticeGenerationAfterResolve: (...args: unknown[]) => Promise<unknown>;
};

const { pipelineMock, authMock } = vi.hoisted(() => {
	type Shape = {
		safeParseGenerationInput: (json: unknown) => { success: boolean; data?: unknown; error?: unknown };
		preflightPracticeGeneration: () => Promise<unknown>;
		runPracticeGenerationAfterResolve: (...args: unknown[]) => Promise<unknown>;
	};
	return {
		pipelineMock: {
			current: {
				safeParseGenerationInput: (json: unknown) => ({ success: true, data: json }),
				preflightPracticeGeneration: async () => ({ ok: true, resolved: { ok: true, plan: "stub" } }),
				runPracticeGenerationAfterResolve: async () => ({ ok: true, testId: "abc", questions: [] }),
			} as Shape,
		},
		authMock: {
			current: {
				user: { id: "stud-1" } as { id: string } | null,
				role: "student" as string | null,
			},
		},
	};
});

vi.mock("@/lib/practice/practice-generation-pipeline", () => ({
	safeParseGenerationInput: (json: unknown) =>
		(pipelineMock.current as PipelineMockShape).safeParseGenerationInput(json),
	preflightPracticeGeneration: () =>
		(pipelineMock.current as PipelineMockShape).preflightPracticeGeneration(),
	runPracticeGenerationAfterResolve: (...args: unknown[]) =>
		(pipelineMock.current as PipelineMockShape).runPracticeGenerationAfterResolve(...args),
}));

vi.mock("@/lib/auth/api-request-user", () => ({
	// Mirrors the real requireApiStudent: 401 without a user, 403 unless the
	// caller's profile role is "student", else { ok, supabase, user }.
	requireApiStudent: async () => {
		const u = authMock.current.user;
		if (!u) return { ok: false, status: 401, message: "Unauthorized." };
		if (authMock.current.role !== "student") {
			return { ok: false, status: 403, message: "Sign in as a student to continue." };
		}
		return { ok: true, user: u, supabase: { from: () => ({ select: () => ({}) }) } };
	},
}));

import { POST } from "@/app/api/student/practice/generate-stream/route";

function makeRequest(body: unknown): Request {
	return new Request("http://localhost/api/student/practice/generate-stream", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

const DEFAULT_BODY = { subjectId: "x", topicId: "y" };

describe("POST /api/student/practice/generate-stream", () => {
	beforeEach(() => {
		// Reset to defaults
		pipelineMock.current.safeParseGenerationInput = (json: unknown) => ({
			success: true,
			data: json as Record<string, unknown>,
		});
		pipelineMock.current.preflightPracticeGeneration = async () => ({
			ok: true,
			resolved: { ok: true, plan: "stub" },
		});
		pipelineMock.current.runPracticeGenerationAfterResolve = async () => ({
			ok: true,
			testId: "abc",
			questions: [],
		});
		authMock.current.user = { id: "stud-1" };
		authMock.current.role = "student";
		vi.unstubAllEnvs();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
	});

	it("returns 404 when PRACTICE_STREAM is not 'true' in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("PRACTICE_STREAM", "");
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.message).toBe("Streaming disabled.");
	});

	it("returns 400 on bad JSON", async () => {
		const res = await POST(makeRequest("{not json"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toBe("Invalid JSON.");
	});

	it("returns 400 when safeParseGenerationInput rejects the body", async () => {
		pipelineMock.current.safeParseGenerationInput = () => ({ success: false, error: { message: "bad" } } as const);
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toBe("Validation error: invalid configuration.");
	});

	it("returns 401 when there is no authenticated user", async () => {
		authMock.current.user = null;
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.message).toBe("Unauthorized.");
	});

	it("returns 403 when the caller is signed in but not a student (S4 role gate)", async () => {
		authMock.current.user = { id: "parent-1" };
		authMock.current.role = "parent";
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.message).toBe("Sign in as a student to continue.");
	});

	it("returns 402 with paywall: true when preflight reports paywall", async () => {
		pipelineMock.current.preflightPracticeGeneration = async () => ({
			ok: false,
			result: {
				ok: false,
				code: "trial_expired",
				message: "Trial done.",
				paywall: true,
			},
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(402);
		const body = await res.json();
		expect(body.paywall).toBe(true);
		expect(body.code).toBe("trial_expired");
	});

	it("returns 400 when preflight reports a validation_error", async () => {
		pipelineMock.current.preflightPracticeGeneration = async () => ({
			ok: false,
			result: {
				ok: false,
				code: "validation_error",
				message: "Bad shape.",
			},
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("validation_error");
	});

	it("returns 400 when preflight reports a non-paywall non-validation failure", async () => {
		pipelineMock.current.preflightPracticeGeneration = async () => ({
			ok: false,
			result: {
				ok: false,
				code: "generation_failed",
				message: "Generic failure.",
			},
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(400);
	});

	it("returns 429 with Retry-After and code 'rate_limited' on a rate-limit (H-3)", async () => {
		pipelineMock.current.preflightPracticeGeneration = async () => ({
			ok: false,
			result: {
				ok: false,
				code: "rate_limited",
				message: "You have generated too many practice tests in the last hour.",
				resetAt: new Date(Date.now() + 60_000).toISOString(),
			},
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeTruthy();
		const body = await res.json();
		expect(body.success).toBe(false);
		expect(body.code).toBe("rate_limited");
	});

	it("streams a final 'done' envelope on success", async () => {
		pipelineMock.current.runPracticeGenerationAfterResolve = async () => ({
			ok: true,
			testId: "test-123",
			questions: [{ id: "q1" }],
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/x-ndjson");
		const lines = await readNdjson<{ type: string }>(res);
		expect(lines.at(-1)?.type).toBe("done");
	});

	it("streams a final 'error' envelope when the pipeline throws", async () => {
		pipelineMock.current.runPracticeGenerationAfterResolve = async () => {
			throw new Error("boom");
		};
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(200);
		const lines = await readNdjson<{ type: string; message?: string }>(res);
		expect(lines.at(-1)?.type).toBe("error");
		expect(lines.at(-1)?.message).toContain("boom");
	});

	it("streams a final 'error' envelope when the pipeline returns a generation_invalid failure", async () => {
		pipelineMock.current.runPracticeGenerationAfterResolve = async () => ({
			ok: false,
			code: "generation_invalid",
			message: "Schema mismatch.",
		});
		const res = await POST(makeRequest(DEFAULT_BODY));
		expect(res.status).toBe(200);
		const lines = await readNdjson<{ type: string; code?: string }>(res);
		expect(lines.at(-1)?.type).toBe("error");
		expect(lines.at(-1)?.code).toBe("generation_invalid");
	});
});
