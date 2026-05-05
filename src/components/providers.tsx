"use client";

import * as React from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * `defaultTheme="system"` aligns with PRODUCT.md's "scene-driven theme" rule:
 * a student on a phone at midnight sees dark, on a school laptop at noon sees
 * light. Hardcoding `"dark"` overrode that signal and was the exact
 * "dark mode chosen because dashboards look cool dark" anti-pattern listed
 * in the product brief. `enableSystem` keeps the user's manual override
 * working — once they toggle, next-themes persists their choice.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
			<TooltipProvider delay={0}>{children}</TooltipProvider>
		</ThemeProvider>
	);
}
