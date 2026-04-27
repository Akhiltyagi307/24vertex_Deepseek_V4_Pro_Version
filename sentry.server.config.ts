import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
	const defaultTraceRate = process.env.NODE_ENV === "production" ? "0.02" : "0.2";
	Sentry.init({
		dsn,
		tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? defaultTraceRate),
		profilesSampleRate: Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0"),
		environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
	});
}
