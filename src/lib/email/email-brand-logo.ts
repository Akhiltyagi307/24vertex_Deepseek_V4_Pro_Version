import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_NAME } from "@/lib/brand/constants";

/** Hosted path for the header mark (PNG — best email-client support). */
export const EMAIL_BRAND_LOGO_PUBLIC_PATH = "/brand/logo-icon.png";

const LOGO_CANDIDATES: { file: string; mime: string }[] = [
	{ file: "logo-icon.png", mime: "image/png" },
	{ file: "logo-icon.webp", mime: "image/webp" },
	{ file: "logo-icon.avif", mime: "image/avif" },
];

const TEXT_FOREGROUND = "#0f172a";
const FONT_STACK =
	"'Geist','GeistFallback',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

let cachedDataUri: string | null | undefined;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function readLogoAsDataUri(): string | null {
	if (cachedDataUri !== undefined) return cachedDataUri;
	const brandDir = path.join(process.cwd(), "public", "brand");
	for (const { file, mime } of LOGO_CANDIDATES) {
		const filePath = path.join(brandDir, file);
		if (!existsSync(filePath)) continue;
		const buf = readFileSync(filePath);
		cachedDataUri = `data:${mime};base64,${buf.toString("base64")}`;
		return cachedDataUri;
	}
	cachedDataUri = null;
	return null;
}

/**
 * Logo `src` for transactional email `<img>` tags.
 *
 * - `EMAIL_LOGO_URL` — full override (CDN, file URL, or data URI).
 * - `EMAIL_LOGO_EMBED=0` — use hosted `${appUrl}/brand/logo-icon.png` instead of inline base64.
 * - Default — inline PNG from `public/brand/` when readable (works in Resend + dev previews);
 *   falls back to the hosted PNG URL if the file is missing.
 */
export function resolveEmailLogoUrl(appUrl: string): string {
	const override = process.env.EMAIL_LOGO_URL?.trim();
	if (override) return override;

	const embedFlag = process.env.EMAIL_LOGO_EMBED?.trim().toLowerCase();
	const disableEmbed = embedFlag === "0" || embedFlag === "false" || embedFlag === "no";
	if (!disableEmbed) {
		const embedded = readLogoAsDataUri();
		if (embedded) return embedded;
	}

	const base = appUrl.replace(/\/$/, "");
	return `${base}${EMAIL_BRAND_LOGO_PUBLIC_PATH}`;
}

/** Detects whether HTML already includes the 24Vertex header mark. */
export function emailHtmlHasBrandLogo(html: string): boolean {
	return (
		/\blogo-icon(?:\.png|\.webp|\.avif)?\b/i.test(html) ||
		/data:image\/(?:png|webp|avif);base64,/i.test(html) ||
		/alt=["']24Vertex["'][^>]*width=["']36["']/i.test(html) ||
		/alt=["']EduAI["'][^>]*width=["']36["']/i.test(html)
	);
}

/** Header row used by `renderEmailShell` and injected into custom / DB template bodies. */
export function buildEmailBrandHeaderRow(appUrl: string, logoUrl?: string): string {
	const href = appUrl.replace(/\/$/, "");
	const src = logoUrl ?? resolveEmailLogoUrl(appUrl);
	return `
<tr>
  <td align="left" style="padding:32px 32px 16px;">
    <a href="${escapeHtml(href)}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:${TEXT_FOREGROUND};">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(PRODUCT_NAME)}" width="36" height="36" style="display:block;border:0;object-fit:contain;" />
      <span style="font-family:${FONT_STACK};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_FOREGROUND};">${escapeHtml(PRODUCT_NAME)}</span>
    </a>
  </td>
</tr>`;
}

/**
 * Prepends the standard 24Vertex logo + wordmark when the HTML body does not already
 * include it (e.g. admin broadcasts, DB MJML overrides).
 */
export function injectEmailBrandHeaderIfAbsent(html: string, appUrl: string): string {
	if (emailHtmlHasBrandLogo(html)) return html;

	const headerRow = buildEmailBrandHeaderRow(appUrl);
	const block = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e8eb;border-radius:18px 18px 0 0;border-bottom:none;"><tbody>${headerRow}</tbody></table>`;

	if (/<body\b[^>]*>/i.test(html)) {
		return html.replace(/<body\b[^>]*>/i, (match) => `${match}${block}`);
	}
	return block + html;
}

/** Dev gallery / static preview — always inline the mark so iframe srcDoc shows it. */
export function primeEmailLogoForPreview(): void {
	const embedded = readLogoAsDataUri();
	if (embedded) {
		process.env.EMAIL_LOGO_URL = embedded;
	}
}
