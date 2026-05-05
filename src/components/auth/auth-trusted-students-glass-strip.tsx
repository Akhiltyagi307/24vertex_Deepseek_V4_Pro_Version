import { TrendingUpIcon } from "lucide-react";

import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Shared frosted panel shell for testimonial and avatar strip.
 * `transform-gpu` promotes a layer so `backdrop-filter` paints reliably once parent `overflow` is visible.
 */
export const AUTH_FROST_GLASS =
	"isolate transform-gpu rounded-xl border border-border/70 ring-1 ring-border/30 bg-background/80 shadow-lg shadow-black/[0.06] backdrop-blur-xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(1.5)] supports-[backdrop-filter]:bg-background/60 dark:shadow-black/25";

/** Matches marketing `Card variant="soft"` (feature section cards). */
export const AUTH_SOFT_PANEL =
	"rounded-xl border border-border/50 bg-muted/40 shadow-none ring-1 ring-foreground/5 dark:bg-muted/25";

type AuthTrustedStudentsGlassStripProps = {
	className?: string;
	/** Marketing hero: larger type, centered row, roomier padding. Default is compact (e.g. auth rotator). */
	prominence?: "default" | "hero";
	/** `frost` matches auth testimonial card; `soft` is a lighter muted panel (e.g. landing hero). */
	surface?: "frost" | "soft";
};

export function AuthTrustedStudentsGlassStrip({
	className,
	prominence = "default",
	surface = "frost",
}: AuthTrustedStudentsGlassStripProps) {
	const hero = prominence === "hero";
	const panelShell = surface === "frost" ? AUTH_FROST_GLASS : AUTH_SOFT_PANEL;

	return (
		<div
			className={cn(
				panelShell,
				hero
					? "flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl px-5 py-4 medium:flex-row medium:justify-center medium:gap-5 medium:px-7 medium:py-4"
					: "flex w-full max-w-sm items-center justify-start gap-2 px-4 py-4 medium:px-6 medium:py-5",
				className,
			)}
		>
			<AvatarGroup
				className={cn("grayscale", hero ? "-space-x-2.5 medium:-space-x-3" : "-space-x-3")}
				role="group"
				aria-label="Example student avatars; illustrative only"
			>
				<Avatar size="lg">
					<AvatarImage src="https://github.com/shadcn.png" alt="" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage src="https://github.com/maxleiter.png" alt="" />
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage src="https://github.com/evilrabbit.png" alt="" />
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount
					className={cn(
						"shrink-0 rounded-full border border-border/70 bg-muted/90 px-0 text-lg font-bold leading-none tracking-tight text-foreground backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] supports-[backdrop-filter]:bg-muted/75",
						hero ? "h-11 min-h-11 min-w-11 w-11 [&>svg]:size-[18px]" : "h-10 min-h-10 min-w-10 w-10 [&>svg]:size-4",
					)}
				>
					<TrendingUpIcon aria-hidden />
				</AvatarGroupCount>
			</AvatarGroup>
			<p
				className={cn(
					hero
						? "text-center text-[0.9375rem] font-medium leading-snug tracking-tight text-foreground/88 medium:text-left medium:text-[1.0625rem]"
						: "text-xs font-medium tracking-[-0.01em] text-muted-foreground",
				)}
			>
				Trusted by 40K+ students
			</p>
		</div>
	);
}
