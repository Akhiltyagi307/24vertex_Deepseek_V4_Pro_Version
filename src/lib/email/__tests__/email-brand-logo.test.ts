import { afterEach, describe, expect, it } from "vitest";

import {
	buildEmailBrandHeaderRow,
	emailHtmlHasBrandLogo,
	injectEmailBrandHeaderIfAbsent,
	resolveEmailLogoUrl,
} from "@/lib/email/email-brand-logo";

describe("email-brand-logo", () => {
	const prevEmbed = process.env.EMAIL_LOGO_EMBED;
	const prevUrl = process.env.EMAIL_LOGO_URL;

	afterEach(() => {
		if (prevEmbed === undefined) delete process.env.EMAIL_LOGO_EMBED;
		else process.env.EMAIL_LOGO_EMBED = prevEmbed;
		if (prevUrl === undefined) delete process.env.EMAIL_LOGO_URL;
		else process.env.EMAIL_LOGO_URL = prevUrl;
	});

	it("embeds logo by default for sent mail HTML", () => {
		delete process.env.EMAIL_LOGO_URL;
		delete process.env.EMAIL_LOGO_EMBED;
		const src = resolveEmailLogoUrl("https://app.example.com");
		expect(src.startsWith("data:image/png;base64,")).toBe(true);
	});

	it("uses hosted PNG when embed is disabled", () => {
		delete process.env.EMAIL_LOGO_URL;
		process.env.EMAIL_LOGO_EMBED = "0";
		const src = resolveEmailLogoUrl("https://app.example.com");
		expect(src).toBe("https://app.example.com/brand/logo-icon.png");
	});

	it("injects header when HTML has no brand mark", () => {
		const out = injectEmailBrandHeaderIfAbsent("<html><body><p>Hi</p></body></html>", "https://app.example.com");
		expect(emailHtmlHasBrandLogo(out)).toBe(true);
		expect(out).toContain('alt="EduAI"');
	});

	it("does not double-inject when shell already has logo", () => {
		const withLogo = buildEmailBrandHeaderRow("https://app.example.com") + "<p>body</p>";
		const out = injectEmailBrandHeaderIfAbsent(withLogo, "https://app.example.com");
		expect(out).toBe(withLogo);
	});
});
