import * as Sentry from "@sentry/nextjs";

import { SENTRY_DENY_URLS, scrubSentryEvent, scrubSentryLog } from "@/lib/sentry/before-send";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
	const defaultTraceRate = process.env.NODE_ENV === "production" ? "0.02" : "0.2";
	Sentry.init({
		dsn,
		tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? defaultTraceRate),
		profilesSampleRate: Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0"),
		environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
		enableLogs: true,
		denyUrls: SENTRY_DENY_URLS,
		beforeSend(event) {
			return scrubSentryEvent(event);
		},
		// enableLogs ships console.* to Sentry's Logs product, which bypasses
		// beforeSend (events only). Scrub the log stream too or PII leaks.
		beforeSendLog(log) {
			return scrubSentryLog(log);
		},
		beforeBreadcrumb(breadcrumb) {
			// Breadcrumbs feed into events; same redactor at the breadcrumb layer
			// catches fetch URLs / HTTP bodies that wouldn't be visible on the
			// final event request payload.
			if (typeof breadcrumb.message === "string") {
				breadcrumb.message = breadcrumb.message.replace(
					/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
					"[email]",
				);
			}
			return breadcrumb;
		},
		integrations: [
			Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
		],
	});
}
