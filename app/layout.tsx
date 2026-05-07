import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { WebVitalsIsland } from "@/components/observability/web-vitals-island";
import { cn } from "@/lib/utils";

const geist = Geist({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
	display: "swap",
	variable: "--font-sans",
});

// Allows Next to resolve relative URLs (og:image, twitter:image) against a real
// origin instead of falling back to localhost in production builds.
const siteUrl =
	process.env.NEXT_PUBLIC_APP_URL ??
	(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: "EduAI — Adaptive practice for grades 6 to 12",
		template: "%s · EduAI",
	},
	description:
		"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	applicationName: "EduAI",
	icons: {
		icon: "/brand/logo-icon.png",
	},
	openGraph: {
		type: "website",
		siteName: "EduAI",
		locale: "en_IN",
		url: "/",
		title: "EduAI — Adaptive practice for grades 6 to 12",
		description:
			"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	},
	twitter: {
		card: "summary_large_image",
		title: "EduAI — Adaptive practice for grades 6 to 12",
		description:
			"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	},
	robots: {
		index: true,
		follow: true,
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

// Per-request rendering is required so the CSP nonce generated in `proxy.ts` lands on the
// framework script tags Next.js emits. With statically pre-rendered pages, the build-time HTML
// has no nonce, but the root proxy sets a CSP that requires one — modern browsers then block
// every script on those pages.
export const dynamic = "force-dynamic";

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
				<Providers>{children}</Providers>
				<WebVitalsIsland />
			</body>
		</html>
	);
}
