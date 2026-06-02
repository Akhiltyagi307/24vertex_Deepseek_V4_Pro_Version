import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/env";

/**
 * Robots policy. We let crawlers index the marketing surface (`/`, `/legal/*`)
 * but explicitly disallow every authenticated portal and the API surface.
 * The admin portal already serves `X-Robots-Tag: noindex, nofollow` per-response
 * (see `app/admin/(authenticated)/layout.tsx`); this is the canonical
 * site-wide gate that crawlers honour before they fetch.
 *
 * `/login` and `/signup` are root-level routes (not under `/auth/`), so they
 * need their own disallow entries — the `/auth/` prefix only covers callbacks
 * like `/auth/callback` and `/auth/update-password`.
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

export default function robots(): MetadataRoute.Robots {
	const base = resolvePublicBaseUrl();
	return {
		rules: [
			{
				userAgent: "*",
				allow: [
					"/",
					"/legal/",
					"/about",
					"/contact",
					"/security",
					"/parents",
					"/schools",
					"/teachers",
					"/students",
					"/ai-tutor",
					"/adaptive-practice",
					"/parent-dashboard",
					"/pricing",
					"/help",
					"/guides",
					"/blog",
					"/boards/",
					"/grades/",
					"/subjects/",
					"/vs/",
				],
				disallow: [
					"/admin/",
					"/student/",
					"/parent/",
					"/teacher/",
					"/api/",
					"/auth/",
					"/login",
					"/signup",
					"/maintenance",
					"/dev/",
				],
			},
		],
		sitemap: `${base}/sitemap.xml`,
		host: base,
	};
}
