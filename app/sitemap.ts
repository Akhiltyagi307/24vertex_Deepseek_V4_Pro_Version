import type { MetadataRoute } from "next";

import { getPublicSitemapPaths } from "@/lib/marketing/public-routes";
import { getAppUrl } from "@/lib/env";

/**
 * Public sitemap. We deliberately do NOT enumerate authenticated routes
 * (`/student/**`, `/parent/**`, `/teacher/**`, `/admin/**`) because they are
 * gated behind login and would otherwise leak the URL surface to indexers.
 * The companion `robots.ts` `Disallow` rules keep crawlers off those paths.
 *
 * Update `getPublicSitemapPaths()` when adding a new public marketing or legal page.
 */
function resolvePublicBaseUrl(): string {
	try {
		return getAppUrl();
	} catch {
		return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
	}
}

export default function sitemap(): MetadataRoute.Sitemap {
	const base = resolvePublicBaseUrl();
	const now = new Date();

	return getPublicSitemapPaths().map((path) => ({
		url: `${base}${path}`,
		lastModified: now,
		changeFrequency: path === "/" ? "weekly" : path.startsWith("/legal/") ? "yearly" : "monthly",
		priority: path === "/" ? 1 : path.startsWith("/legal/") ? 0.4 : path.includes("/boards/") || path.includes("/grades/") ? 0.5 : 0.7,
	}));
}
