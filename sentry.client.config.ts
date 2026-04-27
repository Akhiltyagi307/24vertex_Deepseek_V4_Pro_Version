import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
	const defaultTraceRate = process.env.NODE_ENV === "production" ? "0.02" : "0.1";
	Sentry.init({
		dsn,
		tracesSampleRate: Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? defaultTraceRate),
		replaysOnErrorSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
		integrations: [],
	});
}
