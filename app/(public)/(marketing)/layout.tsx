import type { ReactNode } from "react";

/**
 * Shared layout for marketing subpages (/about, /pricing, SEO templates, etc.).
 * The homepage at `/` keeps its own shell inside `page.tsx`.
 */
export default function MarketingRouteGroupLayout({ children }: { children: ReactNode }) {
	return children;
}
