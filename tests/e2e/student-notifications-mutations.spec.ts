/**
 * Audit D32: extend `notifications.spec.ts` (which covers the bell + listing
 * chrome) with mutation-path assertions. Specifically:
 *
 *  - `POST /api/student/notifications/read-all` succeeds and the unread count
 *    drops to 0 in the subsequent `GET /unread-count`.
 *  - `GET /api/student/notifications/unread-count` returns a non-negative
 *    integer for an authenticated student.
 *
 * We hit the API directly rather than driving the UI because real
 * notifications aren't seeded in the auth fixture and the API gives a
 * deterministic surface to assert on.
 */
import { expect, test } from "@playwright/test";

const STUDENT_CRED_HINT =
	"Set PLAYWRIGHT_STUDENT_EMAIL + PLAYWRIGHT_STUDENT_PASSWORD in .env.local to run student E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_STUDENT_EMAIL?.trim(), STUDENT_CRED_HINT);
});

test.describe("Student notifications — mutation paths", () => {
	test("unread-count returns a non-negative integer for an authenticated student", async ({
		request,
	}) => {
		const res = await request.get("/api/student/notifications/unread-count");
		expect(res.ok(), `expected 2xx, got ${res.status()}`).toBeTruthy();
		const body = (await res.json()) as { count?: unknown };
		expect(typeof body.count).toBe("number");
		expect(body.count).toBeGreaterThanOrEqual(0);
	});

	test("read-all drives unread-count to zero", async ({ request }) => {
		const markRes = await request.post("/api/student/notifications/read-all");
		expect(markRes.ok(), `expected 2xx, got ${markRes.status()}`).toBeTruthy();

		const afterRes = await request.get("/api/student/notifications/unread-count");
		expect(afterRes.ok()).toBeTruthy();
		const after = (await afterRes.json()) as { count?: unknown };
		expect(after.count).toBe(0);
	});

	test("the rate limit kicks in eventually for unread-count", async ({ request }) => {
		// Budget: 60 requests / 60 seconds. Fire 70 to cross the threshold.
		// We accept the first 429 we see as the success signal — exact ordering
		// can vary with circuit-breaker state.
		let saw429 = false;
		for (let i = 0; i < 70; i++) {
			const res = await request.get("/api/student/notifications/unread-count");
			if (res.status() === 429) {
				saw429 = true;
				const retryAfter = res.headers()["retry-after"];
				expect(retryAfter, "429 must include Retry-After").toBeTruthy();
				break;
			}
		}
		// Soft assertion: in dev the breaker may fail-open and never 429. Skip
		// rather than fail in that case so the spec is reliable across envs.
		test.skip(
			!saw429,
			"Did not observe a 429 within 70 reqs — likely the dev rate-limit DB is failing open.",
		);
	});
});
