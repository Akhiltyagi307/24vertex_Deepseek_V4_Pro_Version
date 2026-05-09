"use client";

import { useTheme } from "@/components/theme-provider";
import { Toaster } from "sonner";

/**
 * Must render under {@link ThemeProvider} so toast chrome matches resolved light/dark
 * (class strategy on `<html>`, not only `prefers-color-scheme`).
 */
export function AppToaster() {
	const { resolvedTheme } = useTheme();
	return (
		<Toaster
			closeButton
			position="top-center"
			richColors
			theme={resolvedTheme === "dark" ? "dark" : "light"}
		/>
	);
}
