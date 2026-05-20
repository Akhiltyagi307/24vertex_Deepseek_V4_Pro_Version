"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

export function ThemeProvider({
	children,
	scriptProps: scriptPropsFromProps,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	// React 19 warns when a client-rendered tree includes executable <script>. next-themes
	// relies on an inline script for pre-hydration theme; keep that on SSR, mark inert on the client.
	// https://github.com/pacocoursey/next-themes/issues/387
	//
	// next-themes overrides `scriptProps.nonce` with its own top-level `nonce` prop in the SSR
	// branch (see internals: `nonce: typeof window=="undefined" ? d : ""`). So a CSP nonce
	// MUST be passed as a top-level `nonce` prop, not nested inside `scriptProps`.
	const scriptProps =
		typeof window === "undefined"
			? scriptPropsFromProps
			: ({ ...scriptPropsFromProps, type: "application/json" as const } as const);

	return (
		<NextThemesProvider {...props} scriptProps={scriptProps}>
			{children}
		</NextThemesProvider>
	);
}

export function useTheme() {
	return useNextTheme();
}
