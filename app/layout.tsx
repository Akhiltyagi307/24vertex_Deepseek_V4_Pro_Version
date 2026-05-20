import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { WebVitalsIsland } from "@/components/observability/web-vitals-island";
import { cn } from "@/lib/utils";
import { getAppUrl } from "@/lib/env";
import { CSP_NONCE_REQUEST_HEADER } from "@/lib/security/csp";

const geist = Geist({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
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
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Per-request nonce, generated in `proxy.ts` and stamped on the CSP header.
	// Forwarded to `<Providers>` so `next-themes` can attach it to its inline
	// pre-hydration `<script>`. Without this, the strict-dynamic CSP blocks the
	// theme script and the page loads with no theme class until React hydrates
	// (flash of incorrect theme). Reading `headers()` here makes the layout
	// dynamic — page segments can still declare `force-static` to keep their
	// own HTML cached at the segment level.
	const nonce = (await headers()).get(CSP_NONCE_REQUEST_HEADER) ?? undefined;

	return (
		<html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
			<body
				className="min-h-screen bg-background text-foreground antialiased"
				suppressHydrationWarning
			>
				<Providers nonce={nonce}>{children}</Providers>
				<WebVitalsIsland />
			</body>
		</html>
	);
}
