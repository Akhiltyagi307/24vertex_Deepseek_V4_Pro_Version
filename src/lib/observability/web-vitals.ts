import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals/attribution";
import * as Sentry from "@sentry/nextjs";

type ReportableMetric = Metric & { rating?: "good" | "needs-improvement" | "poor" };

function send(metric: ReportableMetric) {
	try {
		Sentry.captureMessage(`web-vital ${metric.name}`, {
			level: "info",
			tags: { metric: metric.name, rating: metric.rating ?? "unknown" },
			extra: { value: metric.value, id: metric.id, delta: metric.delta, navigationType: metric.navigationType },
		});
	} catch {
		/* swallow — never let observability break the page */
	}
	if (process.env.NEXT_PUBLIC_VERCEL_ENV !== "production") {
		// eslint-disable-next-line no-console
		console.log(`[web-vital] ${metric.name}`, metric.value, { rating: metric.rating, id: metric.id });
	}
}

export function reportWebVitals(): void {
	onCLS(send);
	onFCP(send);
	onINP(send);
	onLCP(send);
	onTTFB(send);
}
