import { beforeEach, describe, expect, it, vi } from "vitest";

// `db-email-templates.ts` imports the live Drizzle client at module load. The
// only thing we exercise here is the pure `interpolateTemplate` helper, so we
// short-circuit `@/db` to a stub. (The same pattern keeps unit tests in this
// repo from touching the network.) Sentry is also stubbed so we can assert on
// missing-token warnings without touching the real SDK. The mock factory is
// hoisted by Vitest, so the spy is created via `vi.hoisted` to keep the
// reference accessible from both the factory and the test bodies.
const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema/email-templates", () => ({ emailTemplates: {} }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { __test } from "@/lib/email/db-email-templates";

const { interpolateTemplate } = __test;

describe("interpolateTemplate", () => {
	beforeEach(() => {
		captureMessage.mockReset();
	});

	it("replaces a simple {{var}} with the value", () => {
		expect(interpolateTemplate("Hi {{name}}", { name: "Akhil" })).toBe("Hi Akhil");
	});

	it("replaces multiple occurrences of the same variable", () => {
		expect(interpolateTemplate("{{x}} + {{x}}", { x: "1" })).toBe("1 + 1");
	});

	it("escapes HTML metacharacters in values to defeat injection", () => {
		const out = interpolateTemplate("<p>Hello, {{name}}.</p>", {
			name: '<script>alert("xss")</script>',
		});
		expect(out).toBe(
			"<p>Hello, &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;.</p>",
		);
	});

	it("escapes ampersands and quotes (anchor href context)", () => {
		const out = interpolateTemplate('<a href="{{href}}">link</a>', {
			href: "https://example.com/?a=1&b=2",
		});
		expect(out).toBe('<a href="https://example.com/?a=1&amp;b=2">link</a>');
	});

	it("escapes single quotes so attribute injection fails", () => {
		const out = interpolateTemplate("<span title='{{title}}'></span>", {
			title: "O'Brien",
		});
		expect(out).toBe("<span title='O&#39;Brien'></span>");
	});

	it("blanks unknown {{tokens}} and warns Sentry", () => {
		const out = interpolateTemplate("Hi {{name}} - {{missing}}", { name: "A" });
		expect(out).toBe("Hi A - ");
		expect(captureMessage).toHaveBeenCalledTimes(1);
		const [message, options] = captureMessage.mock.calls[0];
		expect(message).toContain("missing");
		expect(options.level).toBe("warning");
		expect(options.extra.missing).toEqual(["missing"]);
	});

	it("does not warn when every token resolves", () => {
		interpolateTemplate("{{a}}-{{b}}", { a: "1", b: "2" });
		expect(captureMessage).not.toHaveBeenCalled();
	});
});
