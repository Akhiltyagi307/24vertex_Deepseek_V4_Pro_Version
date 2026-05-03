import { describe, expect, it } from "vitest";

import { compileMjmlToHtml } from "@/lib/email/mjml-compile";

describe("compileMjmlToHtml", () => {
	it("compiles minimal MJML", () => {
		const { html } = compileMjmlToHtml(
			"<mjml><mj-body><mj-text>Hello</mj-text></mj-body></mjml>",
		);
		expect(html).toContain("Hello");
	});
});
