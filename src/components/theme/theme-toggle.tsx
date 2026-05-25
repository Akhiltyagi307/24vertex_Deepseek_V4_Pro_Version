"use client";

import * as React from "react";
import { LogOutIcon, MoonStarIcon, SunIcon } from "lucide-react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { useTheme } from "@/components/theme-provider";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutEverywhere } from "@/lib/auth/sign-out";
import { cn } from "@/lib/utils";

/** Distinct from `bg-sidebar` header so controls do not disappear into the bar */
const headerControlChrome =
	"rounded-md border border-border/90 bg-sidebar-accent p-1 shadow-sm dark:border-border dark:bg-sidebar-accent";

export function ThemeToggle() {
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const { resolvedTheme, setTheme } = useTheme();
	const isDark = (resolvedTheme ?? "dark") === "dark";

	function signOut() {
		void signOutEverywhere();
	}

	const themeSwitchLabel = mounted
		? isDark
			? "Switch to light theme"
			: "Switch to dark theme"
		: "Theme";

	return (
		<div className="inline-flex items-center gap-2.5 medium:gap-4">
			<div className={cn("inline-flex shrink-0 items-center justify-center", headerControlChrome)}>
				{mounted ? (
					<AnimatedToggle
						checked={isDark}
						onChange={(checked) => setTheme(checked ? "dark" : "light")}
						variant="icon"
						size="sm"
						label={themeSwitchLabel}
						icons={{
							on: <MoonStarIcon />,
							off: <SunIcon />,
						}}
					/>
				) : (
					<div
						className="h-5 w-9 shrink-0 rounded-full bg-muted/70"
						aria-busy="true"
						aria-label="Loading theme toggle"
					/>
				)}
			</div>
			<span className="hidden text-foreground text-xs font-semibold medium:inline">
				{mounted ? (isDark ? "Dark" : "Light") : "\u00a0"}
			</span>
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"inline-flex size-8 shrink-0 items-center justify-center text-foreground transition-colors",
								"hover:bg-foreground/10 dark:hover:bg-foreground/15",
								"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								headerControlChrome,
							)}
							onClick={() => void signOut()}
							aria-label="Log out"
						>
							<LogOutIcon className="size-3.5" />
						</button>
					}
				/>
				<TooltipContent side="bottom">Log out</TooltipContent>
			</Tooltip>
		</div>
	);
}
