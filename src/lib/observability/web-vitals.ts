import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals/attribution";
import * as Sentry from "@sentry/nextjs";

type ReportableMetric = Metric & { rating?: "good" | "needs-improvement" | "poor" };

/**
 * Normalize the current pathname into a low-cardinality route tag. Concrete
 * UUIDs / numeric ids would explode the tag dimension; collapse them into
 * `:id` so Sentry dashboards can group by route shape.
 */
function routeTagFromPathname(pathname: string): string {
	if (!pathname) return "/";
	return pathname
		.split("/")
		.map((seg) => {
			if (!seg) return seg;
			// UUID v4
			if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
			// Bare integer
			if (/^\d+$/.test(seg)) return ":id";
			// Tracker / link codes (XX#### or 24+-char tokens)
			if (/^[A-Z]{2}\d{4}$/.test(seg)) return ":code";
			if (/^[A-Za-z0-9_-]{24,}$/.test(seg)) return ":token";
			return seg;
		})
		.join("/");
}

function send(metric: ReportableMetric) {
	const route =
		typeof window !== "undefined" ? routeTagFromPathname(window.location.pathname) : "/";
	try {
		Sentry.captureMessage(`web-vital ${metric.name}`, {
			level: "info",
			tags: {
				metric: metric.name,
				rating: metric.rating ?? "unknown",
				route,
			},
			extra: {
				value: metric.value,
				id: metric.id,
				delta: metric.delta,
				navigationType: metric.navigationType,
			},
		});
	} catch {
		/* swallow — never let observability break the page */
	}
	if (process.env.NEXT_PUBLIC_VERCEL_ENV !== "production") {
		console.log(`[web-vital] ${metric.name}`, metric.value, { rating: metric.rating, route, id: metric.id });
	}
}

// Exported for unit testing; not part of the public surface.
export const __test_routeTagFromPathname = routeTagFromPathname;

export function reportWebVitals(): void {
	onCLS(send);
	onFCP(send);
	onINP(send);
	onLCP(send);
	onTTFB(send);
}
