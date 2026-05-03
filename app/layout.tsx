import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "EduAI",
	description: "Adaptive assessment and practice",
	icons: {
		icon: "/brand/logo-icon.png",
	},
};

// Per-request rendering is required so the CSP nonce generated in `middleware.ts` lands on the
// framework script tags Next.js emits. With statically pre-rendered pages, the build-time HTML
// has no nonce, but the middleware sets a CSP that requires one — modern browsers then block
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
			</body>
		</html>
	);
}
