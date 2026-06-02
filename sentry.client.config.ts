import * as Sentry from "@sentry/nextjs";

import { SENTRY_DENY_URLS, scrubSentryEvent, scrubSentryLog } from "@/lib/sentry/before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
	const defaultTraceRate = process.env.NODE_ENV === "production" ? "0.02" : "0.1";
	Sentry.init({
		dsn,
		tracesSampleRate: Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? defaultTraceRate),
		replaysOnErrorSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
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
		integrations: [
			Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
		],
	});
}
