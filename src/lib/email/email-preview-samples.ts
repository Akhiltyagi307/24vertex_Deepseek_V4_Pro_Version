/**
 * Static HTML samples for every transactional email slug. Used by
 * `app/dev/emails` and `scripts/preview-emails.ts` — no Resend / DB.
 */
import type { EmailPreviewSample, OrganizationEmailEventPreview } from "@/lib/email/email-preview-types";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell-core";

export type { EmailPreviewSample, EmailPreviewSource } from "@/lib/email/email-preview-types";

const DEMO = {
	appUrl: "https://app.24vertex.example.com",
	studentName: "Akhil",
	parentName: "Sushma",
	childName: "Akhil",
	teacherName: "Priya Sharma",
	orgName: "Delhi Public School — Rohini",
	subjectName: "Mathematics",
	testId: "demo-test-id",
	studentId: "demo-student-id",
	pdfUrl:
		"https://demo.supabase.co/storage/v1/object/sign/practice-reports/demo-test.pdf?token=demo",
	renewal: "15 June 2026",
} as const;

function urls() {
	const a = DEMO.appUrl;
	return {
		studentReports: `${a}/student/reports?test=${DEMO.testId}`,
		parentReport: `${a}/parent/open-report?student=${DEMO.studentId}&test=${DEMO.testId}`,
		studentPlan: `${a}/student/subscription`,
		parentPlan: `${a}/parent/subscription`,
		studentSettings: `${a}/student/settings`,
		parentSettings: `${a}/parent/settings#notifications`,
		parentDashboard: `${a}/parent/dashboard`,
		teacherLogin: `${a}/login/educator`,
		teacherSettings: `${a}/teacher/settings`,
		authCallback: `${a}/auth/callback`,
	};
}

function sample(
	partial: Omit<EmailPreviewSample, "html"> & { html: string },
): EmailPreviewSample {
	return partial;
}

function organizationPreview(event: OrganizationEmailEventPreview): EmailPreviewSample {
	const u = urls();
	const org = escapeHtml(DEMO.orgName);
	const teacher = escapeHtml(DEMO.teacherName);
	const student = escapeHtml(DEMO.studentName);
	const displayName = escapeHtml(DEMO.studentName);

	const copies: Record<
		OrganizationEmailEventPreview,
		{ subject: string; preheader: string; title: string; paragraphs: string[]; ctaHref: string; ctaLabel: string }
	> = {
		student_organization_linked: {
			subject: `Connected to ${DEMO.orgName} on 24Vertex`,
			preheader: `Your 24Vertex account is now connected to ${DEMO.orgName}.`,
			title: "Organization connected",
			paragraphs: [
				`Your student account is now connected to <strong>${org}</strong>. Teachers associated with this organization may be able to view the student data 24Vertex makes available to them.`,
				"You can unlink from Account settings anytime.",
			],
			ctaHref: u.studentSettings,
			ctaLabel: "Open account settings",
		},
		student_organization_unlinked: {
			subject: `Disconnected from ${DEMO.orgName} on 24Vertex`,
			preheader: `Your 24Vertex account is no longer connected to ${DEMO.orgName}.`,
			title: "Organization disconnected",
			paragraphs: [
				`Your student account is no longer connected to <strong>${org}</strong>. Organization teachers will no longer get roster access through that organization.`,
				"Independent tutor links, if any, are unchanged.",
			],
			ctaHref: u.studentSettings,
			ctaLabel: "Open account settings",
		},
		student_organization_deactivated: {
			subject: `${DEMO.orgName} was removed from 24Vertex`,
			preheader: `Your account was disconnected from ${DEMO.orgName}.`,
			title: "Organization removed",
			paragraphs: [
				`<strong>${org}</strong> is no longer active on 24Vertex, so your student account was disconnected from it.`,
				"You can continue using 24Vertex without an organization, or connect to another active school or tuition center from Account settings.",
			],
			ctaHref: u.studentSettings,
			ctaLabel: "Open account settings",
		},
		teacher_organization_joined: {
			subject: `Connected to ${DEMO.orgName} on 24Vertex`,
			preheader: `Your teacher account is now connected to ${DEMO.orgName}.`,
			title: "Organization connected",
			paragraphs: [
				`Your teacher account is now connected to <strong>${org}</strong>. You can access students associated with this organization according to 24Vertex's teacher access rules.`,
				"Link-code access is disabled while your account is connected to an organization.",
			],
			ctaHref: u.teacherSettings,
			ctaLabel: "Open teacher settings",
		},
		teacher_organization_left: {
			subject: `Disconnected from ${DEMO.orgName} on 24Vertex`,
			preheader: `Your teacher account is no longer connected to ${DEMO.orgName}.`,
			title: "Organization disconnected",
			paragraphs: [
				`Your teacher account is no longer connected to <strong>${org}</strong>.`,
				"You can now link students independently using their 24Vertex link code.",
			],
			ctaHref: u.teacherSettings,
			ctaLabel: "Open teacher settings",
		},
		teacher_organization_deactivated: {
			subject: `${DEMO.orgName} was removed from 24Vertex`,
			preheader: `Your teacher account was disconnected from ${DEMO.orgName}.`,
			title: "Organization removed",
			paragraphs: [
				`<strong>${org}</strong> is no longer active on 24Vertex, so your teacher account was disconnected from it.`,
				"You can continue as an independent teacher or connect to another active organization from Teacher settings.",
			],
			ctaHref: u.teacherSettings,
			ctaLabel: "Open teacher settings",
		},
		teacher_linked_student: {
			subject: `${DEMO.teacherName} linked to your 24Vertex account`,
			preheader: `${DEMO.teacherName} can now access your 24Vertex student data as an independent teacher.`,
			title: "Teacher linked",
			paragraphs: [
				`<strong>${teacher}</strong> linked to your 24Vertex student account using your link code.`,
				"If this was not expected, contact your parent, school administrator, or 24Vertex support.",
			],
			ctaHref: u.studentSettings,
			ctaLabel: "Open account settings",
		},
		teacher_student_link_confirmed: {
			subject: `Connected to ${DEMO.studentName} on 24Vertex`,
			preheader: `You can now access ${DEMO.studentName}'s 24Vertex student data as an independent teacher.`,
			title: "Student linked",
			paragraphs: [
				`You are now linked to <strong>${student}</strong> as an independent teacher.`,
				"If you later join a school or tuition center on 24Vertex, independent student links will be revoked.",
			],
			ctaHref: u.teacherSettings,
			ctaLabel: "Open teacher settings",
		},
	};

	const copy = copies[event];
	const html = renderEmailShell({
		preheader: copy.preheader,
		greeting: `Hi ${displayName},`,
		title: copy.title,
		paragraphs: copy.paragraphs,
		primaryCta: { label: copy.ctaLabel, href: copy.ctaHref },
	});

	return sample({
		slug: event,
		category: "Organization",
		displayName: copy.title,
		description: `templateSlug: ${event}`,
		subject: copy.subject,
		html,
		source: "app",
	});
}

function supabaseAuthPreview(
	slug: string,
	displayName: string,
	description: string,
	subject: string,
	opts: {
		preheader: string;
		title: string;
		paragraphs: string[];
		ctaLabel: string;
		ctaHref: string;
		greeting?: string;
	},
): EmailPreviewSample {
	const html = renderEmailShell({
		preheader: opts.preheader,
		greeting: opts.greeting ?? "Hello,",
		title: opts.title,
		paragraphs: opts.paragraphs,
		primaryCta: { label: opts.ctaLabel, href: opts.ctaHref },
		signOff: "— 24Vertex (via Supabase Auth)",
	});
	return sample({
		slug,
		category: "Supabase Auth",
		displayName,
		description,
		subject,
		html,
		source: "supabase",
	});
}

/** Builds every preview sample. Call only in Node (dev page or preview script). */
export function buildEmailPreviewSamples(): EmailPreviewSample[] {
	const u = urls();
	const sn = escapeHtml(DEMO.studentName);
	const pn = escapeHtml(DEMO.parentName);
	const cn = escapeHtml(DEMO.childName);
	const tn = escapeHtml(DEMO.teacherName);
	const subjectName = escapeHtml(DEMO.subjectName);

	const samples: EmailPreviewSample[] = [
		// — Reports —
		sample({
			slug: "report-ready",
			category: "Reports & practice",
			displayName: "Report ready (student)",
			description: "After AI grading + PDF render.",
			subject: `Your ${DEMO.subjectName} report is ready`,
			source: "app",
			html: renderEmailShell({
				preheader: `78% on your ${DEMO.subjectName} report — open it now.`,
				greeting: `Hi ${sn},`,
				title: `Your ${DEMO.subjectName} report is ready`,
				paragraphs: [
					`We just finished grading your <strong>${subjectName}</strong> practice test — you scored <strong>78%</strong>.`,
					"Open the PDF for the full printable report. You don't need to sign in to 24Vertex to use this link, and it stays valid for 90 days.",
					"For topic breakdowns and your next recommended practice inside the app, use <em>View in 24Vertex</em>.",
				],
				primaryCta: { label: "Open PDF report", href: DEMO.pdfUrl },
				secondaryCta: { label: "View in 24Vertex", href: u.studentReports },
			}),
		}),
		sample({
			slug: "parent-portal-report-ready",
			category: "Reports & practice",
			displayName: "Report ready (parent)",
			description: "Linked parent when child's report is ready.",
			subject: `${DEMO.childName} — ${DEMO.subjectName} report ready`,
			source: "app",
			html: renderEmailShell({
				preheader: `${DEMO.childName} scored 78% on ${DEMO.subjectName}.`,
				greeting: `Hi ${pn},`,
				title: `${DEMO.childName} — ${DEMO.subjectName} report ready`,
				paragraphs: [
					`We just finished grading <strong>${cn}</strong>'s ${subjectName} practice test — they scored <strong>78%</strong>.`,
					"Open the PDF for the full printable report. You don't need to sign in to 24Vertex to use this link, and it stays valid for 90 days.",
					"For the interactive parent portal version, use <em>Open parent portal</em>.",
				],
				primaryCta: { label: "Open PDF report", href: DEMO.pdfUrl },
				secondaryCta: { label: "Open parent portal", href: u.parentReport },
				preferencesHref: u.parentSettings,
			}),
		}),

		// — Usage (student) —
		sample({
			slug: "usage-tests-80",
			category: "Usage & billing",
			displayName: "Usage 80% (practice tests)",
			description: "Student soft nudge before test quota cap.",
			subject: "You've used 80% of your practice tests this period",
			source: "app",
			html: renderEmailShell({
				preheader: "80% of practice tests used this period.",
				greeting: `Hi ${sn},`,
				title: "You've used 80% of your practice tests this period",
				paragraphs: [
					"You're approaching the limit of your plan's practice tests for this billing period.",
					"Consider upgrading soon so your practice doesn't pause when you hit 100%.",
				],
				stats: [
					{ label: "Tests used", value: "16 of 20" },
					{ label: "Threshold", value: "80%" },
				],
				primaryCta: { label: "View plan", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "usage-tests-100",
			category: "Usage & billing",
			displayName: "Usage 100% (practice tests)",
			description: "Student hard cap — practice paused.",
			subject: "You've used 100% of your practice tests this period",
			source: "app",
			html: renderEmailShell({
				preheader: "100% of practice tests used this period.",
				greeting: `Hi ${sn},`,
				title: "You've used 100% of your practice tests this period",
				paragraphs: [
					"You've reached the limit of your plan's practice tests for this billing period.",
					"Upgrade or top up to keep practicing without a pause.",
				],
				stats: [
					{ label: "Tests used", value: "20 of 20" },
					{ label: "Threshold", value: "100%" },
				],
				callout: { tone: "warning", text: "Practice is paused until your quota resets or you upgrade." },
				primaryCta: { label: "Upgrade plan", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "usage-tokens-80",
			category: "Usage & billing",
			displayName: "Usage 80% (doubt-chat tokens)",
			description: "Student token meter soft nudge.",
			subject: "You've used 80% of your doubt-chat tokens this period",
			source: "app",
			html: renderEmailShell({
				preheader: "80% of doubt-chat tokens used this period.",
				greeting: `Hi ${sn},`,
				title: "You've used 80% of your doubt-chat tokens this period",
				paragraphs: [
					"You're approaching the limit of your plan's doubt-chat tokens for this billing period.",
					"Consider upgrading soon so your practice doesn't pause when you hit 100%.",
				],
				stats: [
					{ label: "Tokens used", value: "8,000 of 10,000" },
					{ label: "Threshold", value: "80%" },
				],
				primaryCta: { label: "View plan", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "usage-tokens-100",
			category: "Usage & billing",
			displayName: "Usage 100% (doubt-chat tokens)",
			description: "Student token hard cap.",
			subject: "You've used 100% of your doubt-chat tokens this period",
			source: "app",
			html: renderEmailShell({
				preheader: "100% of doubt-chat tokens used this period.",
				greeting: `Hi ${sn},`,
				title: "You've used 100% of your doubt-chat tokens this period",
				paragraphs: [
					"You've reached the limit of your plan's doubt-chat tokens for this billing period.",
					"Upgrade or top up to keep practicing without a pause.",
				],
				stats: [
					{ label: "Tokens used", value: "10,000 of 10,000" },
					{ label: "Threshold", value: "100%" },
				],
				callout: { tone: "warning", text: "Practice is paused until your quota resets or you upgrade." },
				primaryCta: { label: "Upgrade plan", href: u.studentPlan },
			}),
		}),

		// — Usage (parent) —
		sample({
			slug: "parent-usage-tests-80",
			category: "Parent portal",
			displayName: "Child usage 80% (tests)",
			description: "Parent notified when linked child nears test quota.",
			subject: `${DEMO.childName}'s plan — 80% of practice tests used`,
			source: "app",
			html: renderEmailShell({
				preheader: `${DEMO.childName}: 80% of practice tests used this period.`,
				greeting: `Hi ${pn},`,
				title: `${DEMO.childName}'s plan — 80% of practice tests used`,
				paragraphs: [
					`<strong>${cn}</strong> is approaching the limit for practice tests on their current plan period.`,
					"You may want to review their plan soon so practice doesn't pause at 100%.",
				],
				stats: [
					{ label: "Tests used", value: "16 of 20" },
					{ label: "Threshold", value: "80%" },
				],
				primaryCta: { label: "View plan", href: u.parentPlan },
				preferencesHref: u.parentSettings,
			}),
		}),
		sample({
			slug: "parent-usage-tests-100",
			category: "Parent portal",
			displayName: "Child usage 100% (tests)",
			description: "Parent notified when child hits test cap.",
			subject: `${DEMO.childName}'s plan — 100% of practice tests used`,
			source: "app",
			html: renderEmailShell({
				preheader: `${DEMO.childName}: 100% of practice tests used this period.`,
				greeting: `Hi ${pn},`,
				title: `${DEMO.childName}'s plan — 100% of practice tests used`,
				paragraphs: [
					`<strong>${cn}</strong> has reached the limit for practice tests on their current plan period.`,
					"Upgrade or top up in the parent portal so their practice doesn't pause.",
				],
				stats: [
					{ label: "Tests used", value: "20 of 20" },
					{ label: "Threshold", value: "100%" },
				],
				callout: { tone: "warning", text: "Practice is paused until quota resets or the plan is upgraded." },
				primaryCta: { label: "Upgrade plan", href: u.parentPlan },
				preferencesHref: u.parentSettings,
			}),
		}),
		sample({
			slug: "parent-child-link-confirmed",
			category: "Parent portal",
			displayName: "Parent–child link confirmed",
			description: "Sent right after parent account links to a student.",
			subject: `Connected to ${DEMO.childName} on 24Vertex`,
			source: "app",
			html: renderEmailShell({
				preheader: `You're now linked to ${DEMO.childName} in 24Vertex.`,
				greeting: `Hi ${pn},`,
				title: `Connected to ${DEMO.childName} on 24Vertex`,
				paragraphs: [
					`Your parent account is now linked to <strong>${cn}</strong> in 24Vertex.`,
					"Open the parent portal to follow their progress, view test reports, and switch between children if you have more than one.",
				],
				primaryCta: { label: "Open parent portal", href: u.parentDashboard },
				preferencesHref: u.parentSettings,
			}),
		}),
		sample({
			slug: "parent-linked-student",
			category: "Parent portal",
			displayName: "Parent linked (student notice)",
			description: "Student notified when a parent links to their profile.",
			subject: "A parent account was linked to your 24Vertex profile",
			source: "app",
			html: renderEmailShell({
				preheader: "Heads up — a parent account is now linked to your 24Vertex profile.",
				greeting: `Hi ${sn},`,
				title: "A parent account was linked to your 24Vertex profile",
				paragraphs: [
					`Parent or guardian: <strong>${pn}</strong>.`,
					"They can use the parent portal for updates you share with them. If something looks off, open Account settings.",
				],
				primaryCta: { label: "Account settings", href: u.studentSettings },
			}),
		}),

		// — Subscription —
		sample({
			slug: "trial-ending",
			category: "Usage & billing",
			displayName: "Trial ending (3 days left)",
			description: "Cron trial reminder (daysLeft > 0).",
			subject: "Only 3 days left on your 24Vertex trial",
			source: "app",
			html: renderEmailShell({
				preheader: "3 days left — add a payment method now.",
				greeting: `Hi ${sn},`,
				title: "Only 3 days left on your 24Vertex trial",
				paragraphs: [
					"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
					"Switch to <strong>Pro Monthly</strong> or <strong>Pro Annual</strong> in one tap.",
				],
				primaryCta: { label: "Continue with Pro", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "trial-ending-today",
			category: "Usage & billing",
			displayName: "Trial ending (today)",
			description: "Same slug trial-ending when daysLeft <= 0.",
			subject: "Your 24Vertex trial ends today",
			source: "app",
			html: renderEmailShell({
				preheader: "Add a payment method today to keep practicing without interruption.",
				greeting: `Hi ${sn},`,
				title: "Your 24Vertex trial ends today",
				paragraphs: [
					"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
					"Switch to <strong>Pro Monthly</strong> or <strong>Pro Annual</strong> in one tap.",
				],
				primaryCta: { label: "Continue with Pro", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "payment-receipt",
			category: "Usage & billing",
			displayName: "Payment receipt",
			description: "After successful Razorpay charge.",
			subject: "Payment received — 24Vertex",
			source: "app",
			html: renderEmailShell({
				preheader: "₹499 paid for Pro Monthly.",
				greeting: `Hi ${sn},`,
				title: "Payment received — 24Vertex",
				paragraphs: [
					"Thanks for your payment. We've recorded it and your subscription remains active.",
					"Your hosted Razorpay invoice is available below.",
				],
				stats: [
					{ label: "Amount", value: "₹499" },
					{ label: "Plan", value: "Pro Monthly" },
					{ label: "Reference", value: "pay_demo123" },
				],
				primaryCta: { label: "View invoice", href: "https://rzp.io/i/demo-invoice" },
				secondaryCta: { label: "Payment history", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "subscription-active",
			category: "Usage & billing",
			displayName: "Subscription active",
			description: "Welcome email after plan activation.",
			subject: "Welcome to Pro Monthly!",
			source: "app",
			html: renderEmailShell({
				preheader: `Your Pro Monthly subscription is now active. Next renewal: ${DEMO.renewal}.`,
				greeting: `Hi ${sn},`,
				title: "Welcome to Pro Monthly!",
				paragraphs: [
					"Your <strong>Pro Monthly</strong> subscription is now active. Enjoy unlimited practice and the expanded AI output allowance for doubt chat.",
				],
				stats: [{ label: "Next renewal", value: DEMO.renewal }],
				primaryCta: { label: "Open 24Vertex", href: `${DEMO.appUrl}/student/dashboard` },
			}),
		}),
		sample({
			slug: "subscription-payment-failed",
			category: "Usage & billing",
			displayName: "Payment failed",
			description: "Initial dunning when charge is declined.",
			subject: "We couldn't collect your 24Vertex payment",
			source: "app",
			html: renderEmailShell({
				preheader: "Your payment was declined. Razorpay will retry — update your method to avoid an interruption.",
				greeting: `Hi ${sn},`,
				title: "We couldn't collect your 24Vertex payment",
				paragraphs: [
					"We tried to charge your payment method for your 24Vertex subscription but it was declined. Razorpay will retry automatically.",
					"To avoid an interruption, please check your UPI or card mandate status, or update your payment method.",
				],
				callout: {
					tone: "warning",
					text: "Practice continues for a short grace window. Updating payment now keeps things uninterrupted.",
				},
				primaryCta: { label: "Fix payment method", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "subscription-dunning-day-3",
			category: "Usage & billing",
			displayName: "Dunning day 3",
			description: "Follow-up when payment still pending.",
			subject: "Reminder: payment still pending on 24Vertex",
			source: "app",
			html: renderEmailShell({
				preheader: "It's been 3 days since we couldn't collect your subscription payment.",
				greeting: `Hi ${sn},`,
				title: "Reminder: payment still pending on 24Vertex",
				paragraphs: [
					"It's been 3 days since we couldn't collect your subscription payment.",
					"Common causes are an expired card, paused UPI mandate, or insufficient balance at the time of charge.",
				],
				callout: { tone: "warning", text: "Update your payment method now to keep practice access uninterrupted." },
				primaryCta: { label: "Update payment method", href: u.studentPlan },
			}),
		}),
		sample({
			slug: "subscription-dunning-day-7",
			category: "Usage & billing",
			displayName: "Dunning day 7",
			description: "Final reminder before cancellation.",
			subject: "Final reminder: your 24Vertex subscription will be cancelled in 7 days",
			source: "app",
			html: renderEmailShell({
				preheader: "It's been a week since your last successful payment.",
				greeting: `Hi ${sn},`,
				title: "Final reminder: your 24Vertex subscription will be cancelled in 7 days",
				paragraphs: [
					"It's been a week since your last successful payment.",
					"Common causes are an expired card, paused UPI mandate, or insufficient balance at the time of charge.",
				],
				callout: {
					tone: "warning",
					text: "If we don't hear from you in the next 7 days we'll cancel the subscription. You can resubscribe any time.",
				},
				primaryCta: { label: "Update payment method", href: u.studentPlan },
			}),
		}),

		// — Account security —
		sample({
			slug: "account-password-changed",
			category: "Account & security",
			displayName: "Password changed",
			description: "Security notice after password update.",
			subject: "Your 24Vertex password was changed",
			source: "app",
			html: renderEmailShell({
				preheader: "Confirming a password change on your 24Vertex account.",
				greeting: `Hi ${sn},`,
				title: "Your 24Vertex password was changed",
				paragraphs: [
					"This confirms the password for your 24Vertex account was just changed.",
					"If you did not make this change, reset your password from Account settings or contact support right away.",
				],
				callout: { tone: "info", text: "We'll always email you when something important changes on your account." },
				primaryCta: { label: "Account settings", href: u.studentSettings },
			}),
		}),
		sample({
			slug: "account-email-changed",
			category: "Account & security",
			displayName: "Sign-in email changed",
			description: "After login email update (app-sent, not Supabase OTP).",
			subject: "Your 24Vertex sign-in email was updated",
			source: "app",
			html: renderEmailShell({
				preheader: "Confirming a sign-in email change on your 24Vertex account.",
				greeting: `Hi ${sn},`,
				title: "Your 24Vertex sign-in email was updated",
				paragraphs: [
					"The email address you use to sign in to 24Vertex was updated.",
					"New address: <strong>new.address@example.com</strong>.",
					"If you did not request this, contact support immediately.",
				],
				primaryCta: { label: "Account settings", href: u.studentSettings },
			}),
		}),

		// — Teacher —
		sample({
			slug: "teacher-pending-approval",
			category: "Teacher",
			displayName: "Teacher signup received",
			description: "After teacher profile created, awaiting admin approval.",
			subject: "We received your 24Vertex teacher signup",
			source: "app",
			html: renderEmailShell({
				preheader: "The 24Vertex team will review your account shortly.",
				greeting: `Hi ${tn},`,
				title: "We received your 24Vertex teacher signup",
				paragraphs: [
					"Thanks for signing up as a teacher on 24Vertex.",
					"The 24Vertex team will review and approve your account within 24–48 hours. We'll email you again when you can sign in and use the full teacher workspace.",
					"If you have questions, reply to this email or contact your school administrator.",
				],
			}),
		}),
		sample({
			slug: "teacher-approved",
			category: "Teacher",
			displayName: "Teacher approved",
			description: "Admin approved teacher account.",
			subject: "Your teacher account is approved",
			source: "app",
			html: renderEmailShell({
				preheader: "Your 24Vertex teacher account is ready to sign in.",
				greeting: `Hi ${tn},`,
				title: "Your teacher account is approved",
				paragraphs: ["Your 24Vertex teacher account has been approved. You can sign in below."],
				primaryCta: { label: "Sign in to 24Vertex", href: u.teacherLogin },
			}),
		}),

		// — Compliance —
		sample({
			slug: "parental-consent-rerequest",
			category: "Compliance",
			displayName: "Parental consent rerequest",
			description: "Compliance flow for renewed parental consent.",
			subject: "Action needed: parental consent for 24Vertex",
			source: "app",
			html: renderEmailShell({
				preheader: `We need renewed parental consent for ${DEMO.studentName}.`,
				greeting: "Hello,",
				title: "Action needed: parental consent for 24Vertex",
				paragraphs: [
					`We need renewed parental consent for the 24Vertex student account belonging to <strong>${sn}</strong>.`,
					"Please review and complete consent using your usual parent account flow.",
					"If you did not expect this message, contact support.",
				],
				primaryCta: { label: "Open parent portal", href: `${DEMO.appUrl}/parent` },
			}),
		}),
		sample({
			slug: "compliance-dsr-fulfilled",
			category: "Compliance",
			displayName: "DSR fulfilled",
			description: "Data subject request completed.",
			subject: "Your 24Vertex privacy request update",
			source: "app",
			html: renderEmailShell({
				preheader: "Your data export request has been fulfilled.",
				greeting: "Hello,",
				title: "Your 24Vertex privacy request update",
				paragraphs: [
					"Your data subject request (<strong>data export</strong>) for 24Vertex has been marked fulfilled by our team.",
					"If you need further assistance, reply to this email.",
				],
			}),
		}),

		// — Admin / broadcasts —
		sample({
			slug: "broadcast",
			category: "Admin & broadcasts",
			displayName: "Broadcast (email channel)",
			description: "Markdown body via broadcastBodyToEmailHtml — not renderEmailShell.",
			subject: "Important update from 24Vertex",
			source: "admin",
			html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:system-ui,sans-serif"><div style="font-family:system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px;"><p style="margin:0 0 12px;">Hi everyone,</p><p style="margin:0 0 12px;">We're rolling out improved report PDFs this week. No action needed unless your school asked you to verify roster links.</p><p style="margin:0 0 12px;">— The 24Vertex team</p></div></body></html>`,
		}),
		sample({
			slug: "admin-weekly-digest",
			category: "Admin & broadcasts",
			displayName: "Admin weekly digest",
			description: "Operator cron digest — plain HTML, not renderEmailShell.",
			subject: "24Vertex admin weekly digest · 2026-05-11",
			source: "admin",
			html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;padding:24px">
<p>Summary for the last <strong>7 days</strong> (UTC).</p>
<ul>
<li>Total admin actions: <strong>142</strong></li>
<li>Logins: <strong>18</strong></li>
<li>High-friction actions: <strong>3</strong></li>
</ul>
<p class="muted" style="color:#666;font-size:12px">Sent automatically for 24Vertex admin operations.</p>
</body></html>`,
		}),
		sample({
			slug: "admin-panic",
			category: "Admin & broadcasts",
			displayName: "Admin panic alert",
			description: "Sent when all admin JWTs are invalidated.",
			subject: "24Vertex admin panic — all sessions invalidated",
			source: "admin",
			html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px"><p>All admin JWTs were invalidated (version <strong>42</strong>).</p></body></html>`,
		}),
	];

	const orgEvents: OrganizationEmailEventPreview[] = [
		"student_organization_linked",
		"student_organization_unlinked",
		"student_organization_deactivated",
		"teacher_organization_joined",
		"teacher_organization_left",
		"teacher_organization_deactivated",
		"teacher_linked_student",
		"teacher_student_link_confirmed",
	];

	const authLink = `${u.authCallback}?token_hash=demo&type=signup`;
	const recoveryLink = `${u.authCallback}?token_hash=demo&type=recovery`;
	const magicLink = `${u.authCallback}?token_hash=demo&type=magiclink`;
	const inviteLink = `${u.authCallback}?token_hash=demo&type=invite`;
	const emailChangeLink = `${u.authCallback}?token_hash=demo&type=email_change`;

	const authSamples: EmailPreviewSample[] = [
		supabaseAuthPreview(
			"auth-signup-confirm",
			"Confirm signup",
			"Supabase Auth · type=signup · configured in Supabase dashboard",
			"Confirm your signup",
			{
				preheader: "Confirm your email to finish creating your 24Vertex account.",
				title: "Confirm your email",
				paragraphs: [
					"Thanks for signing up for 24Vertex. Tap the button below to confirm this email address and finish setting up your account.",
					"If you didn't create an account, you can ignore this message.",
				],
				ctaLabel: "Confirm email",
				ctaHref: authLink,
			},
		),
		supabaseAuthPreview(
			"auth-recovery",
			"Password recovery",
			"Supabase Auth · type=recovery · resetPasswordForEmail redirect",
			"Reset your password",
			{
				preheader: "Reset your 24Vertex password.",
				title: "Reset your password",
				paragraphs: [
					"We received a request to reset the password for your 24Vertex account.",
					"This link expires after a short time. If you didn't request a reset, ignore this email.",
				],
				ctaLabel: "Reset password",
				ctaHref: recoveryLink,
			},
		),
		supabaseAuthPreview(
			"auth-magic-link",
			"Magic link",
			"Supabase Auth · type=magiclink · passwordless sign-in",
			"Your magic link",
			{
				preheader: "Sign in to 24Vertex without a password.",
				title: "Sign in to 24Vertex",
				paragraphs: [
					"Use the button below to sign in. This link can only be used once and expires soon.",
				],
				ctaLabel: "Sign in",
				ctaHref: magicLink,
			},
		),
		supabaseAuthPreview(
			"auth-invite",
			"Invite user",
			"Supabase Auth · type=invite · admin or service invite",
			"You've been invited to 24Vertex",
			{
				preheader: "Accept your invitation to join 24Vertex.",
				title: "You've been invited",
				paragraphs: [
					"You've been invited to create an account on 24Vertex. Accept the invitation to set your password and get started.",
				],
				ctaLabel: "Accept invitation",
				ctaHref: inviteLink,
			},
		),
		supabaseAuthPreview(
			"auth-email-change",
			"Confirm email change",
			"Supabase Auth · type=email_change · OTP before new address is active",
			"Confirm your new email",
			{
				preheader: "Confirm the new sign-in email for your 24Vertex account.",
				title: "Confirm your new email",
				paragraphs: [
					"You requested to change the email address used to sign in to 24Vertex.",
					"Confirm below to apply the change. If this wasn't you, contact support immediately.",
				],
				ctaLabel: "Confirm new email",
				ctaHref: emailChangeLink,
			},
		),
	];

	return [...samples, ...orgEvents.map(organizationPreview), ...authSamples];
}
