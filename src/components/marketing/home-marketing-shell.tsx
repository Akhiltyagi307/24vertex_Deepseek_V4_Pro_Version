"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

import { useMarketingThemeSync } from "@/components/marketing/use-marketing-theme-sync";

export function HomeMarketingShell({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	useMarketingThemeSync();
	return (
		<div
			className={cn(
				"box-border min-h-screen min-w-0 w-full overflow-x-clip bg-transparent",
				className,
			)}
		>
			{children}
		</div>
	);
}
