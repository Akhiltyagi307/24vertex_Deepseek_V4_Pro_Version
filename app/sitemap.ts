import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/env";

/**
 * Public sitemap. We deliberately do NOT enumerate authenticated routes
 * (`/student/**`, `/parent/**`, `/teacher/**`, `/admin/**`) because they are
 * gated behind login and would otherwise leak the URL surface to indexers.
 * The companion `robots.ts` `Disallow` rules keep crawlers off those paths.
 *
 * Update this list when adding a new public marketing or legal page.
 */
function resolvePublicBaseUrl(): string {
	// `getAppUrl()` throws when `NEXT_PUBLIC_APP_URL` is a loopback host while
	// `NODE_ENV === "production"` — which is exactly the case during the CI
	// bundle-budget build (uses placeholder `http://localhost:3000`). Fall back
	// to the raw env so the static prerender doesn't fail; in any real
	// production deploy `NEXT_PUBLIC_APP_URL` points to the live origin.
	try {
		return getAppUrl();
	} catch {
		return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
	}
}

export default function sitemap(): MetadataRoute.Sitemap {
	const base = resolvePublicBaseUrl();
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [
		{
			url: `${base}/`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${base}/legal/terms`,
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.4,
		},
		{
			url: `${base}/legal/privacy`,
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.4,
		},
		{
			url: `${base}/legal/refund`,
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: `${base}/legal/shipping`,
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.3,
		},
	];

	return entries;
}
