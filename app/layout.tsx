import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { WebVitalsIsland } from "@/components/observability/web-vitals-island";
import { cn } from "@/lib/utils";
import { getAppUrl } from "@/lib/env";

const geist = Geist({
	subsets: ["latin"],
	weight: ["400", "600", "700"],
	display: "swap",
	variable: "--font-sans",
});

// `getAppUrl()` throws on a loopback `NEXT_PUBLIC_APP_URL` in `NODE_ENV=production`,
// which is the case during CI bundle-budget builds (placeholder localhost env). Fall
// back to the raw env so the build doesn't fail; real deploys get the live origin.
function resolveMetadataBaseUrl(): string {
	try {
		return getAppUrl();
	} catch {
		return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
	}
}

/**
 * Root metadata holds only what every surface needs:
 *   - `metadataBase`: resolves relative og:image / twitter:image URLs to a real
 *     origin in production. Setting it as a static export costs nothing.
 *   - `icons`: favicon override so all surfaces use the brand mark.
 *
 * Public-surface SEO (title template, openGraph, twitter, robots) lives in
 * `app/(public)/layout.tsx` so authenticated portals don't inherit it.
 */
export const metadata: Metadata = {
	metadataBase: new URL(resolveMetadataBaseUrl()),
	icons: {
		icon: "/brand/logo-icon.png",
	},
};

// `viewport-fit=cover` lets `env(safe-area-inset-*)` resolve to non-zero values on iOS
// devices with notches / Dynamic Island and on Android with rounded corners. Fixed and
// sticky surfaces (sidebar, sheet, dialog, toasts) consume those insets via arbitrary
// Tailwind utilities to avoid clipping under the system chrome.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	// Tints mobile browser chrome to the brand colour (matches manifest.ts theme_color).
	themeColor: "#2ea070",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
			<body
				className="min-h-screen bg-background text-foreground antialiased"
				suppressHydrationWarning
			>
				{children}
				<WebVitalsIsland />
			</body>
		</html>
	);
}
