"use client";

import { useMarketingThemeSync } from "@/components/marketing/use-marketing-theme-sync";

/**
 * Tiny client island so `HomeMarketingShell` can stay a server component while
 * still keeping `document.documentElement` aligned with `useTheme().resolvedTheme`.
 */
export function MarketingThemeSyncIsland(): null {
	useMarketingThemeSync();
	return null;
}
