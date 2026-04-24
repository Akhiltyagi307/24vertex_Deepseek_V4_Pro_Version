"use client";

import * as React from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
			<TooltipProvider delay={0}>{children}</TooltipProvider>
			<Toaster richColors closeButton position="bottom-right" />
		</ThemeProvider>
	);
}
