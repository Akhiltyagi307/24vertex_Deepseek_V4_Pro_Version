"use client";

import Link from "next/link";
import {
	BookOpenCheck,
	Bot,
	Building2,
	ChevronDown,
	ClipboardList,
	GraduationCap,
	LayoutDashboard,
	Users,
	type LucideIcon,
} from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import type { MarketingNavIconId, MarketingNavItem } from "@/lib/marketing/marketing-nav";
import { cn } from "@/lib/utils";

const MARKETING_NAV_ICONS: Record<MarketingNavIconId, LucideIcon> = {
	practice: BookOpenCheck,
	tutor: Bot,
	"parent-dashboard": LayoutDashboard,
	assignments: ClipboardList,
	parents: Users,
	students: GraduationCap,
	schools: Building2,
};

type MarketingNavDropdownProps = {
	label: string;
	items: readonly MarketingNavItem[];
	align?: "start" | "center" | "end";
	className?: string;
};

export function MarketingNavDropdown({
	label,
	items,
	align = "center",
	className,
}: MarketingNavDropdownProps) {
	const panelWidthClass =
		items.length > 3 ? "w-[min(100vw-2rem,22.75rem)]" : "w-[min(100vw-2rem,20.75rem)]";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"group/trigger text-muted-foreground hover:text-card-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition-[color,background-color] duration-200 ease-out",
					"hover:bg-muted/40 data-popup-open:bg-muted/50 data-popup-open:text-card-foreground",
					className,
				)}
			>
				{label}
				<ChevronDown
					className="size-4 shrink-0 transition-transform duration-200 ease-out group-data-popup-open/trigger:rotate-180"
					aria-hidden
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={align}
				sideOffset={10}
				className={cn(
					landingFeatureBentoShell,
					panelWidthClass,
					"gap-0.5 border-border/80 p-2 shadow-xl ring-foreground/8",
				)}
			>
				<DropdownMenuGroup className="flex flex-col gap-0.5">
					<DropdownMenuLabel className="font-mono text-2xs px-2.5 pb-1 pt-0.5 uppercase tracking-wider text-muted-foreground">
						{label}
					</DropdownMenuLabel>
					{items.map((item) => {
						const Icon = MARKETING_NAV_ICONS[item.icon];
						return (
							<DropdownMenuItem
								key={item.href}
								className="rounded-lg p-0 focus:bg-transparent focus:text-inherit data-highlighted:bg-transparent"
								render={
									<Link
										href={item.href}
										className="group/item flex w-full gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-200 ease-out hover:bg-muted/45 focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
									/>
								}
							>
								<span
									className="border-border/70 bg-muted/35 text-muted-foreground group-hover/item:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ease-out group-hover/item:border-border group-hover/item:bg-muted/55"
									aria-hidden
								>
									<Icon className="size-[1.125rem] stroke-[1.75]" />
								</span>
								<span className="min-w-0 flex-1 py-0.5">
									<span className="text-foreground block text-sm font-medium leading-snug">
										{item.label}
									</span>
									<span className="text-muted-foreground mt-0.5 block text-pretty text-xs leading-snug">
										{item.description}
									</span>
								</span>
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
