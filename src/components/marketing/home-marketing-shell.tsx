import type * as React from "react";

import { cn } from "@/lib/utils";
import { MarketingThemeSyncIsland } from "@/components/marketing/marketing-theme-sync-island";

export function HomeMarketingShell({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"box-border min-h-screen min-w-0 w-full overflow-x-clip bg-transparent",
				className,
			)}
		>
			<MarketingThemeSyncIsland />
			{children}
		</div>
	);
}
