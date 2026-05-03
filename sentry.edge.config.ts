import * as Sentry from "@sentry/nextjs";

import { SENTRY_DENY_URLS, scrubSentryEvent } from "@/lib/sentry/before-send";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
	const defaultTraceRate = process.env.NODE_ENV === "production" ? "0.02" : "0.2";
	Sentry.init({
		dsn,
		tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? defaultTraceRate),
		environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
		enableLogs: true,
		denyUrls: SENTRY_DENY_URLS,
		beforeSend(event) {
			return scrubSentryEvent(event);
		},
		integrations: [
			Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
		],
	});
}
