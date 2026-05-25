"use client";

import * as React from "react";

import { useTheme } from "@/components/theme-provider";

/**
 * Keeps `document.documentElement` class list and `color-scheme` aligned with
 * `useTheme().resolvedTheme` during hydration. Avoid stacking separate marketing
 * `bg-background` / `bg-white` layers on top of `body` — they can disagree with
 * the real document theme and read as a black hero while the toggle shows light.
 */
export function useMarketingThemeSync(): void {
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	React.useEffect(() => {
		if (!mounted) return;
		if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
		const root = document.documentElement;
		// Tailwind dark mode uses `.dark` on `<html>` only; drop legacy `light` class.
		root.classList.remove("light");
		root.classList.toggle("dark", resolvedTheme === "dark");
		root.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
	}, [mounted, resolvedTheme]);
}
