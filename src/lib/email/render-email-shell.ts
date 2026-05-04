import "server-only";

import { getAppUrl } from "@/lib/env";

/**
 * Centralized HTML escape used by every transactional email. Callers must escape
 * any value that originated from user input *before* embedding it in a section's
 * `text`/`paragraphs`. The shell itself only escapes the values it controls
 * (URLs, labels) so callers stay flexible (e.g. wrapping a name in `<strong>`).
 */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const BRAND_GREEN = "#2ea070";
const BRAND_GREEN_SOFT = "#e6f4ee";
const TEXT_FOREGROUND = "#0f172a";
const TEXT_MUTED = "#5d6470";
const SURFACE = "#ffffff";
const SURFACE_SOFT = "#f7faf9";
const BORDER = "#e6e8eb";
const PAGE_BG = "#f5f5f4";
const FONT_STACK =
	"'Geist','GeistFallback',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export type EmailCallout = {
	tone?: "info" | "warning" | "success";
	text: string;
};

export type EmailStat = {
	label: string;
	value: string;
};

export type EmailCta = {
	label: string;
	href: string;
};

export type EmailShellOptions = {
	/** Hidden preview line shown by inbox clients before the user opens the message. */
	preheader?: string;
	/** Optional greeting line shown above the title (e.g., "Hi Akhil,"). HTML-escaped by caller. */
	greeting?: string;
	/** Title rendered as a level-1 heading. HTML-escaped by caller (e.g. allow `<strong>`). */
	title: string;
	/**
	 * Body paragraphs. Each entry is pre-escaped HTML — callers should call
	 * `escapeHtml` on any user-controlled substring before composing the line.
	 */
	paragraphs?: string[];
	/** Optional callout block (info/warning/success). */
	callout?: EmailCallout;
	/** Optional stat rows shown as a soft card (e.g. "Tests used: 4 of 5"). */
	stats?: EmailStat[];
	/** Solid green CTA. */
	primaryCta?: EmailCta;
	/** Outline CTA shown below the primary one. */
	secondaryCta?: EmailCta;
	/** Optional sign-off line; defaults to "— The EduAI team". */
	signOff?: string;
	/**
	 * URL the "Manage notifications" footer link points to. When omitted we use
	 * `/student/settings#notifications` so users always have a way out.
	 */
	preferencesHref?: string;
};

function renderPreheader(text: string | undefined): string {
	if (!text) return "";
	const safe = escapeHtml(text);
	// Hidden preheader: rendered in inbox preview, invisible in body.
	return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};opacity:0;">${safe}</div>`;
}

/**
 * Resolves the URL the email's `<img>` should point at. Defaults to the same
 * asset the marketing top bar uses (`/brand/logo-icon.png`); an explicit
 * `EMAIL_LOGO_URL` env var overrides — useful for serving the logo from a
 * CDN, and for the local preview script (which points at a `file://` path
 * so the static HTML samples render the real artwork in a browser).
 */
function getEmailLogoUrl(): string {
	const override = process.env.EMAIL_LOGO_URL?.trim();
	if (override) return override;
	return `${getAppUrl()}/brand/logo-icon.png`;
}

function renderHeader(): string {
	const appUrl = getAppUrl();
	const logoUrl = getEmailLogoUrl();
	return `
<tr>
  <td align="left" style="padding:32px 32px 16px;">
    <a href="${escapeHtml(appUrl)}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:${TEXT_FOREGROUND};">
      <img src="${escapeHtml(logoUrl)}" alt="EduAI" width="36" height="36" style="display:block;border:0;object-fit:contain;" />
      <span style="font-family:${FONT_STACK};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_FOREGROUND};">EduAI</span>
    </a>
  </td>
</tr>`;
}

function renderTitleBlock(greeting: string | undefined, title: string): string {
	const greet = greeting
		? `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${TEXT_MUTED};">${greeting}</p>`
		: "";
	return `
<tr>
  <td style="padding:8px 32px 4px;">
    ${greet}
    <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${TEXT_FOREGROUND};">${title}</h1>
  </td>
</tr>`;
}

function renderParagraphs(paragraphs: string[] | undefined): string {
	if (!paragraphs?.length) return "";
	const lines = paragraphs
		.map(
			(p) =>
				`<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${TEXT_FOREGROUND};">${p}</p>`,
		)
		.join("\n");
	return `
<tr>
  <td style="padding:16px 32px 0;">
    ${lines}
  </td>
</tr>`;
}

function renderStats(stats: EmailStat[] | undefined): string {
	if (!stats?.length) return "";
	const rows = stats
		.map((s, i) => {
			const borderTop = i === 0 ? "none" : `1px solid ${BORDER}`;
			return `
<tr>
  <td style="padding:12px 16px;border-top:${borderTop};font-family:${FONT_STACK};font-size:14px;color:${TEXT_MUTED};">${escapeHtml(s.label)}</td>
  <td align="right" style="padding:12px 16px;border-top:${borderTop};font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${TEXT_FOREGROUND};">${escapeHtml(s.value)}</td>
</tr>`;
		})
		.join("");
	return `
<tr>
  <td style="padding:20px 32px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SURFACE_SOFT};border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;">
      ${rows}
    </table>
  </td>
</tr>`;
}

function renderCallout(callout: EmailCallout | undefined): string {
	if (!callout) return "";
	const palette: Record<NonNullable<EmailCallout["tone"]>, { bg: string; border: string; fg: string }> = {
		info: { bg: BRAND_GREEN_SOFT, border: "#bfe3d3", fg: "#1f6f4f" },
		success: { bg: BRAND_GREEN_SOFT, border: "#bfe3d3", fg: "#1f6f4f" },
		warning: { bg: "#fff7ed", border: "#fcd9b4", fg: "#9a4a06" },
	};
	const tone = callout.tone ?? "info";
	const c = palette[tone];
	return `
<tr>
  <td style="padding:18px 32px 0;">
    <div style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:14px 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.55;color:${c.fg};">
      ${callout.text}
    </div>
  </td>
</tr>`;
}

function renderCtas(primary: EmailCta | undefined, secondary: EmailCta | undefined): string {
	if (!primary && !secondary) return "";
	const primaryHtml = primary
		? `<a href="${escapeHtml(primary.href)}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;letter-spacing:-0.005em;">${escapeHtml(primary.label)}</a>`
		: "";
	const secondaryHtml = secondary
		? `<a href="${escapeHtml(secondary.href)}" style="display:inline-block;background:#ffffff;color:${BRAND_GREEN};border:1.5px solid ${BRAND_GREEN};font-family:${FONT_STACK};font-size:15px;font-weight:600;text-decoration:none;padding:10.5px 20.5px;border-radius:10px;letter-spacing:-0.005em;margin-top:10px;">${escapeHtml(secondary.label)}</a>`
		: "";
	return `
<tr>
  <td style="padding:24px 32px 8px;">
    ${primaryHtml}
    ${secondary ? `<br/>` : ""}
    ${secondaryHtml}
  </td>
</tr>`;
}

function renderSignOff(signOff: string | undefined): string {
	const text = signOff ?? "— The EduAI team";
	return `
<tr>
  <td style="padding:24px 32px 8px;">
    <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${TEXT_FOREGROUND};">${escapeHtml(text)}</p>
  </td>
</tr>`;
}

function renderFooter(preferencesHref: string | undefined): string {
	const appUrl = getAppUrl();
	const prefs = preferencesHref ?? `${appUrl}/student/settings#notifications`;
	return `
<tr>
  <td style="padding:32px 32px 36px;border-top:1px solid ${BORDER};">
    <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;line-height:1.55;color:${TEXT_MUTED};">
      You received this from <strong style="color:${TEXT_FOREGROUND};">EduAI</strong> because of activity on your account.
      <a href="${escapeHtml(prefs)}" style="color:${BRAND_GREEN};text-decoration:underline;">Manage notification preferences</a>.
    </p>
    <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.55;color:${TEXT_MUTED};">
      <a href="${escapeHtml(appUrl)}" style="color:${TEXT_MUTED};text-decoration:none;">${escapeHtml(appUrl)}</a>
    </p>
  </td>
</tr>`;
}

/**
 * Renders an HTML email built from the EduAI design tokens (brand `#2ea070`,
 * Geist-style typography, soft surface card on a neutral page). The layout is
 * a single-column 600px table for maximum email-client compatibility (Outlook,
 * Gmail, Apple Mail, Yahoo).
 */
export function renderEmailShell(opts: EmailShellOptions): string {
	const sections = [
		renderHeader(),
		renderTitleBlock(opts.greeting, opts.title),
		renderParagraphs(opts.paragraphs),
		renderStats(opts.stats),
		renderCallout(opts.callout),
		renderCtas(opts.primaryCta, opts.secondaryCta),
		renderSignOff(opts.signOff),
		renderFooter(opts.preferencesHref),
	].join("\n");

	return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>EduAI</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT_STACK};color:${TEXT_FOREGROUND};">
${renderPreheader(opts.preheader)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;">
        ${sections}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
