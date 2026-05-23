import type { ReactNode } from "react";

import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { MarketingSiteHeader } from "@/components/marketing/marketing-site-header";
import { Footer7 } from "@/components/ui/footer-7";
import { HomeMarketingShell } from "@/components/marketing/home-marketing-shell";

type MarketingSubpageShellProps = {
	children: ReactNode;
};

export function MarketingSubpageShell({ children }: MarketingSubpageShellProps) {
	return (
		<HomeMarketingShell className="min-h-screen w-full bg-background">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
			>
				Skip to main content
			</a>
			<MarketingSiteHeader />
			<MotionPageEnter>
				<main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
					{children}
				</main>
			</MotionPageEnter>
			<footer className="bg-background w-full px-4 medium:px-6 xl:px-8">
				<Footer7 />
			</footer>
		</HomeMarketingShell>
	);
}
