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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Distinct from `bg-sidebar` header so controls do not disappear into the bar */
const headerControlChrome =
	"rounded-md border border-border/90 bg-sidebar-accent p-1 shadow-sm dark:border-border dark:bg-sidebar-accent";

export function ThemeToggle() {
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const { resolvedTheme, setTheme } = useTheme();
	const isDark = (resolvedTheme ?? "dark") === "dark";

	async function signOut() {
		const supabase = createClient();
		await supabase.auth.signOut();
		window.location.href = "/";
	}

	return (
		<div className="inline-flex items-center gap-3 sm:gap-4">
			<div className={cn("inline-flex shrink-0 items-center justify-center", headerControlChrome)}>
				{mounted ? (
					<AnimatedToggle
						checked={isDark}
						onChange={(checked) => setTheme(checked ? "dark" : "light")}
						variant="icon"
						size="sm"
						label="Toggle theme"
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
			<span className="hidden text-foreground text-xs font-semibold sm:inline">
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
								"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
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
