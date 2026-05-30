/**
 * Live render verification for the doubt-chat KaTeX + Markdown pipeline.
 *
 * Deterministic by design: instead of waiting on a real (non-deterministic,
 * paid) LLM turn, we seed a `doubt_conversations` row plus a crafted assistant
 * `doubt_messages` row directly via Supabase REST (using the student's own
 * token — RLS allows own-row inserts), then load `/student/doubt-chat?c=<id>`
 * and assert the renderer typesets it. The seeded answer exercises every path
 * the renderer fix added: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, mhchem
 * `\ce{}`, Unicode math, and Markdown structure. The conversation is deleted in
 * afterAll.
 *
 * Runs under the `student` Playwright project (storage state from auth.setup.ts).
 */
import { expect, test } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const APIKEY =
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
	"";
const USER_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL?.trim() ?? "";
const USER_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD?.trim() ?? "";

const SEED_ASSISTANT_CONTENT = `## Solving the quadratic

To solve a quadratic $ax^2 + bx + c = 0$, apply the **quadratic formula**:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

In LaTeX-bracket form the kinematics relation is \\(v = u + at\\), and a definite integral renders as:

\\[ \\int_0^1 x^2 \\, dx = \\tfrac{1}{3} \\]

**Chemistry.** Methane combustion is $\\ce{CH4 + 2O2 -> CO2 + 2H2O}$ and ammonia equilibrium is $\\ce{N2 + 3H2 <=> 2NH3}$.

The area works out to 5 cm² and the phase angle is π/2.

| Quantity | Symbol | Value |
| --- | --- | --- |
| Velocity | v | 5 m/s |
| Mass | m | 2 kg |`;

type ApiInit = Omit<RequestInit, "headers"> & {
	token?: string;
	headers?: Record<string, string>;
};

async function api(pathname: string, init: ApiInit = {}): Promise<Response> {
	const { token, headers, ...rest } = init;
	const h: Record<string, string> = {
		apikey: APIKEY,
		"Content-Type": "application/json",
		...(headers ?? {}),
	};
	if (token) h.Authorization = `Bearer ${token}`;
	return fetch(`${SUPABASE_URL}${pathname}`, { ...rest, headers: h });
}

let seeded: { conversationId: string; token: string } | null = null;

test.describe("Doubt-chat KaTeX + Markdown rendering (seeded)", () => {
	test.beforeAll(async () => {
		test.skip(
			!SUPABASE_URL || !APIKEY || !USER_EMAIL || !USER_PASSWORD,
			"Needs NEXT_PUBLIC_SUPABASE_URL + publishable key + PLAYWRIGHT_USER_EMAIL/PASSWORD in .env.local.",
		);

		// 1. Password grant → access token + the REAL student id (the admin
		//    email lookup returns a homonym teacher account, so use the grant).
		const tokRes = await api("/auth/v1/token?grant_type=password", {
			method: "POST",
			body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
		});
		expect(tokRes.ok, `password grant failed: ${tokRes.status}`).toBeTruthy();
		const tok = (await tokRes.json()) as { access_token: string; user: { id: string } };
		const token = tok.access_token;
		const studentId = tok.user.id;

		// 2. Reuse a subject/topic the student already has (valid FKs). The page's
		//    ?c= loader only checks ownership, so enrollment currency is irrelevant.
		let subjectId: string | null = null;
		let topicId: string | null = null;
		const convRes = await api(
			"/rest/v1/doubt_conversations?select=subject_id,topic_id&order=created_at.desc&limit=1",
			{ token },
		);
		if (convRes.ok) {
			const rows = (await convRes.json()) as Array<{ subject_id: string; topic_id: string | null }>;
			if (rows[0]) {
				subjectId = rows[0].subject_id;
				topicId = rows[0].topic_id;
			}
		}
		if (!subjectId) {
			const ptRes = await api("/rest/v1/performance_tracker?select=subject_id,topic_id&limit=1", {
				token,
			});
			if (ptRes.ok) {
				const rows = (await ptRes.json()) as Array<{ subject_id: string; topic_id: string | null }>;
				if (rows[0]) {
					subjectId = rows[0].subject_id;
					topicId = rows[0].topic_id ?? null;
				}
			}
		}
		expect(subjectId, "could not resolve an enrolled subject for the student").toBeTruthy();

		// 3. Create a conversation + a user question + the crafted assistant answer.
		const cRes = await api("/rest/v1/doubt_conversations", {
			method: "POST",
			token,
			headers: { Prefer: "return=representation" },
			body: JSON.stringify({
				student_id: studentId,
				subject_id: subjectId,
				topic_id: topicId,
				title: "KaTeX render check (e2e)",
			}),
		});
		expect(cRes.ok, `conversation insert failed: ${cRes.status} ${await cRes.clone().text()}`).toBeTruthy();
		const conversationId = ((await cRes.json()) as Array<{ id: string }>)[0]!.id;

		await api("/rest/v1/doubt_messages", {
			method: "POST",
			token,
			body: JSON.stringify({
				conversation_id: conversationId,
				role: "user",
				content: "Show me the quadratic formula, a definite integral, methane combustion, and a units table.",
			}),
		});
		const aRes = await api("/rest/v1/doubt_messages", {
			method: "POST",
			token,
			body: JSON.stringify({
				conversation_id: conversationId,
				role: "assistant",
				content: SEED_ASSISTANT_CONTENT,
			}),
		});
		expect(aRes.ok, `assistant insert failed: ${aRes.status} ${await aRes.clone().text()}`).toBeTruthy();

		seeded = { conversationId, token };
	});

	test.afterAll(async () => {
		if (!seeded) return;
		// FK cascade removes the messages with the conversation.
		await api(`/rest/v1/doubt_conversations?id=eq.${seeded.conversationId}`, {
			method: "DELETE",
			token: seeded.token,
		}).catch(() => undefined);
	});

	test("typesets math, chemistry (mhchem) and Markdown for a seeded answer", async ({ page }) => {
		// Webpack dev compiles the route on first navigation — allow headroom.
		test.setTimeout(120_000);
		test.skip(!seeded, "Seeding did not complete.");
		await page.goto(`/student/doubt-chat?c=${seeded!.conversationId}`, {
			waitUntil: "domcontentloaded",
		});
		expect(new URL(page.url()).pathname, "should not bounce to /login").not.toMatch(/\/login/);

		// First dev compile of the route can be slow.
		await expect(page.locator(".katex").first()).toBeVisible({ timeout: 45_000 });

		const katexCount = await page.locator(".katex").count();
		const displayCount = await page.locator(".katex-display").count();
		const errorCount = await page.locator(".katex-error").count();
		const tableCount = await page.locator("table").count();
		const tdCount = await page.locator("td").count();
		const strongCount = await page.locator("strong").count();

		await page.screenshot({ path: "test-results/doubt-katex-render.png", fullPage: true });

		// Multiple inline + display formulae rendered.
		expect(katexCount, "expected several KaTeX spans").toBeGreaterThan(3);
		// `$$...$$` and the converted `\[...\]` both render as display blocks.
		expect(displayCount, "expected >=2 display blocks").toBeGreaterThanOrEqual(2);
		// mhchem must resolve \ce without producing a KaTeX error node.
		expect(errorCount, "no KaTeX errors (mhchem loaded, delimiters valid)").toBe(0);
		// Markdown structure rendered.
		await expect(
			page.locator("h4", { hasText: "Solving the quadratic" }),
			"## heading renders (mapped to h4)",
		).toBeVisible();
		expect(tableCount, "comparison table renders").toBeGreaterThanOrEqual(1);
		expect(tdCount, "table cells render").toBeGreaterThanOrEqual(4);
		expect(strongCount, "bold renders").toBeGreaterThanOrEqual(1);

		// The literal LaTeX bracket delimiters must NOT survive as visible text
		// (proves the normalizer converted them before remark-math ran).
		const visible = await page.locator("body").innerText();
		expect(visible).not.toContain("\\(");
		expect(visible).not.toContain("\\[");
	});
});
