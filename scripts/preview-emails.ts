/**
 * Generates static HTML samples of every transactional email type so the
 * design can be reviewed in a browser without sending real mail. Output goes
 * to `artifacts/email-previews/`.
 *
 * Run with:   pnpm exec tsx scripts/preview-emails.ts
 * Then open:  artifacts/email-previews/index.html
 *
 * The script imports `renderEmailShell` directly — no Resend / Drizzle / DB
 * dependency — so it works without `RESEND_API_KEY`, `DATABASE_URL`, etc.
 * The only env var it touches is `NEXT_PUBLIC_APP_URL`, which `getAppUrl()`
 * reads to compose CTA hrefs; we set a placeholder if unset.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { primeEmailLogoForPreview } from "../src/lib/email/email-brand-logo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
	process.env.NEXT_PUBLIC_APP_URL = "https://app.eduai.example.com";
}

primeEmailLogoForPreview();

import { escapeHtml, renderEmailShell } from "../src/lib/email/render-email-shell-core";

type Sample = {
	slug: string;
	displayName: string;
	description: string;
	html: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const PORTAL_REPORT_URL = `${APP_URL}/student/reports?test=demo-test-id`;
const PARENT_PORTAL_REPORT_URL = `${APP_URL}/parent/open-report?student=demo-student-id&test=demo-test-id`;
const PDF_URL = "https://demo.supabase.co/storage/v1/object/sign/practice-reports/demo-test.pdf?token=demo-signed";
const STUDENT_PLAN_URL = `${APP_URL}/student/subscription`;
const PARENT_PLAN_URL = `${APP_URL}/parent/subscription`;

function buildReportReadyStudent(): Sample {
	const studentName = "Akhil";
	const subjectName = "Mathematics";
	const pct = "78%";
	const html = renderEmailShell({
		preheader: `${pct} on your ${subjectName} report — open it now.`,
		greeting: `Hi ${escapeHtml(studentName)},`,
		title: `Your ${subjectName} report is ready`,
		paragraphs: [
			`We just finished grading your <strong>${escapeHtml(subjectName)}</strong> practice test — you scored <strong>${pct}</strong>.`,
			"Open the PDF for the full printable report. You don't need to sign in to EduAI to use this link, and it stays valid for 90 days.",
			"For topic breakdowns and your next recommended practice inside the app, use <em>View in EduAI</em>.",
		],
		primaryCta: { label: "Open PDF report", href: PDF_URL },
		secondaryCta: { label: "View in EduAI", href: PORTAL_REPORT_URL },
	});
	return {
		slug: "report-ready-student",
		displayName: "Report ready (student)",
		description: "After AI grading + PDF render. PDF signed URL + portal link.",
		html,
	};
}

function buildReportReadyParent(): Sample {
	const parentName = "Sushma";
	const childName = "Akhil";
	const subjectName = "Mathematics";
	const pct = "78%";
	const html = renderEmailShell({
		preheader: `${childName} scored ${pct} on ${subjectName}.`,
		greeting: `Hi ${escapeHtml(parentName)},`,
		title: `${childName} — ${subjectName} report ready`,
		paragraphs: [
			`We just finished grading <strong>${escapeHtml(childName)}</strong>'s ${escapeHtml(subjectName)} practice test — they scored <strong>${pct}</strong>.`,
			"Open the PDF for the full printable report. You don't need to sign in to EduAI to use this link, and it stays valid for 90 days.",
			"For the interactive parent portal version, use <em>Open parent portal</em>.",
		],
		primaryCta: { label: "Open PDF report", href: PDF_URL },
		secondaryCta: { label: "Open parent portal", href: PARENT_PORTAL_REPORT_URL },
		preferencesHref: `${APP_URL}/parent/settings#notifications`,
	});
	return {
		slug: "report-ready-parent",
		displayName: "Report ready (parent portal)",
		description: "Mirror of the student email, addressed to a linked parent.",
		html,
	};
}

function buildUsageThreshold80Tests(): Sample {
	const studentName = "Akhil";
	const html = renderEmailShell({
		preheader: "80% of practice tests used this period.",
		greeting: `Hi ${escapeHtml(studentName)},`,
		title: "You've used 80% of your practice tests this period",
		paragraphs: [
			"You're approaching the limit of your plan's practice tests for this billing period.",
			"Consider upgrading soon so your practice doesn't pause when you hit 100%.",
		],
		stats: [
			{ label: "Tests used", value: "16 of 20" },
			{ label: "Threshold", value: "80%" },
		],
		primaryCta: { label: "View plan", href: STUDENT_PLAN_URL },
	});
	return {
		slug: "usage-threshold-80-tests",
		displayName: "Usage threshold 80% (tests)",
		description: "Soft nudge — stat card, no callout, single CTA.",
		html,
	};
}

function buildUsageThreshold100Tokens(): Sample {
	const studentName = "Akhil";
	const html = renderEmailShell({
		preheader: "100% of doubt-chat tokens used this period.",
		greeting: `Hi ${escapeHtml(studentName)},`,
		title: "You've used 100% of your doubt-chat tokens this period",
		paragraphs: [
			"You've reached the limit of your plan's doubt-chat tokens for this billing period.",
			"Upgrade or top up to keep practicing without a pause.",
		],
		stats: [
			{ label: "Tokens used", value: "10,000 of 10,000" },
			{ label: "Threshold", value: "100%" },
		],
		callout: {
			tone: "warning",
			text: "Practice is paused until your quota resets or you upgrade.",
		},
		primaryCta: { label: "Upgrade plan", href: STUDENT_PLAN_URL },
	});
	return {
		slug: "usage-threshold-100-tokens",
		displayName: "Usage threshold 100% (tokens)",
		description: "Hard cap reached — warning callout + urgent priority CTA.",
		html,
	};
}

function buildUsageThreshold80ParentPortal(): Sample {
	const parentName = "Sushma";
	const childName = "Akhil";
	const html = renderEmailShell({
		preheader: `${childName}: 80% of practice tests used this period.`,
		greeting: `Hi ${escapeHtml(parentName)},`,
		title: `${childName}'s plan — 80% of practice tests used`,
		paragraphs: [
			`<strong>${escapeHtml(childName)}</strong> is approaching the limit for practice tests on their current plan period.`,
			"You may want to review their plan soon so practice doesn't pause at 100%.",
		],
		stats: [
			{ label: "Tests used", value: "16 of 20" },
			{ label: "Threshold", value: "80%" },
		],
		primaryCta: { label: "View plan", href: PARENT_PLAN_URL },
		preferencesHref: `${APP_URL}/parent/settings#notifications`,
	});
	return {
		slug: "usage-threshold-80-parent",
		displayName: "Usage threshold 80% (parent portal)",
		description: "Parent-voice variant referring to the linked child.",
		html,
	};
}

function buildTrialEnding3Days(): Sample {
	const studentName = "Akhil";
	const html = renderEmailShell({
		preheader: "3 days left — add a payment method now.",
		greeting: `Hi ${escapeHtml(studentName)},`,
		title: "Only 3 days left on your EduAI trial",
		paragraphs: [
			"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
			"Switch to <strong>Pro Monthly</strong> or <strong>Pro Annual</strong> in one tap.",
		],
		primaryCta: { label: "Continue with Pro", href: STUDENT_PLAN_URL },
	});
	return {
		slug: "trial-ending-3d",
		displayName: "Trial ending (3 days left)",
		description: "Two-bucket cron: this is the soft reminder at T-3.",
		html,
	};
}

function buildTrialEndingToday(): Sample {
	const studentName = "Akhil";
	const html = renderEmailShell({
		preheader: "Add a payment method today to keep practicing without interruption.",
		greeting: `Hi ${escapeHtml(studentName)},`,
		title: "Your EduAI trial ends today",
		paragraphs: [
			"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
			"Switch to <strong>Pro Monthly</strong> or <strong>Pro Annual</strong> in one tap.",
		],
		primaryCta: { label: "Continue with Pro", href: STUDENT_PLAN_URL },
	});
	return {
		slug: "trial-ending-today",
		displayName: "Trial ending (today)",
		description: "Final push at T-1.",
		html,
	};
}

function buildIndex(samples: Sample[]): string {
	const FONT =
		"'Geist','GeistFallback',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
	const cards = samples
		.map(
			(s) => `
<a href="${s.slug}.html" style="display:block;background:#ffffff;border:1px solid #e6e8eb;border-radius:14px;padding:20px;text-decoration:none;color:#0f172a;">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#2ea070;">${s.slug}</div>
  <div style="margin-top:6px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(s.displayName)}</div>
  <div style="margin-top:6px;font-size:14px;line-height:1.5;color:#5d6470;">${escapeHtml(s.description)}</div>
</a>`,
		)
		.join("\n");
	return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>EduAI email previews</title>
</head>
<body style="margin:0;background:#f5f5f4;font-family:${FONT};color:#0f172a;">
<main style="max-width:760px;margin:48px auto;padding:0 24px;">
  <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#e6f4ee;color:#1f6f4f;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">EduAI</div>
  <h1 style="margin:14px 0 4px;font-size:32px;font-weight:700;letter-spacing:-0.025em;">Email previews</h1>
  <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#5d6470;">Static samples generated by <code>scripts/preview-emails.ts</code>. These render the exact HTML <code>renderEmailShell()</code> ships to Resend.</p>
  <div style="display:grid;grid-template-columns:1fr;gap:14px;">${cards}</div>
</main>
</body></html>`;
}

const samples: Sample[] = [
	buildReportReadyStudent(),
	buildReportReadyParent(),
	buildUsageThreshold80Tests(),
	buildUsageThreshold100Tokens(),
	buildUsageThreshold80ParentPortal(),
	buildTrialEnding3Days(),
	buildTrialEndingToday(),
];

const outDir = resolve(__dirname, "..", "artifacts", "email-previews");
mkdirSync(outDir, { recursive: true });

for (const s of samples) {
	writeFileSync(resolve(outDir, `${s.slug}.html`), s.html, "utf8");
	console.log(`✓ ${s.slug}.html`);
}
writeFileSync(resolve(outDir, "index.html"), buildIndex(samples), "utf8");
console.log(`✓ index.html`);
console.log(`\nOpen: ${resolve(outDir, "index.html")}`);
