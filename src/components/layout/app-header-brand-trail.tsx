"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CopyIcon, IdCardIcon, SchoolIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const brandTrailIconClass = "size-4 shrink-0 text-muted-foreground";

const trailTextClass = "truncate font-normal text-foreground text-sm leading-tight";

/** Slash trail signature, visually softened so it does not compete with labels. */
export function HeaderBreadcrumbSlash() {
	return (
		<span
			className="shrink-0 px-0.5 font-sans text-xs text-muted-foreground/50 tabular-nums select-none"
			aria-hidden
		>
			/
		</span>
	);
}

export type HeaderPortal = "student" | "parent";

export type AppHeaderBrandTrailProps = {
	organizationName?: string;
	userDisplayName?: string;
	shareableId?: string | null;
	/** Affects copy and aria for the shareable ID control. */
	headerPortal?: HeaderPortal;
	/** When true, hide leading logo (e.g. desktop expanded sidebar already shows brand). */
	omitLogo?: boolean;
};

export function AppHeaderBrandTrail({
	organizationName = "EduAI",
	userDisplayName = "Student",
	shareableId = null,
	headerPortal = "student",
	omitLogo = false,
}: AppHeaderBrandTrailProps) {
	return (
		<nav
			aria-label="App context"
			className="flex min-w-0 max-w-full items-center gap-x-1.5 text-sm md:gap-x-3"
		>
			{omitLogo ? null : (
				<>
					<Image
						src="/brand/logo-icon.png"
						alt=""
						width={28}
						height={28}
						sizes="28px"
						className="size-7 shrink-0 rounded-md object-contain"
					/>
					<HeaderBreadcrumbSlash />
				</>
			)}
			<div className="flex min-w-0 items-center gap-2">
				<SchoolIcon
					className={brandTrailIconClass}
					strokeWidth={2}
					aria-hidden
				/>
				<span className={trailTextClass}>{organizationName}</span>
			</div>
			<HeaderBreadcrumbSlash />
			<div className="flex min-w-0 items-center gap-2">
				<UserRoundIcon
					className={brandTrailIconClass}
					strokeWidth={2}
					aria-hidden
				/>
				<span className={trailTextClass}>{userDisplayName}</span>
				{shareableId ? (
					<>
						<HeaderBreadcrumbSlash />
						<CopyableShareableIdSegment
							shareableId={shareableId}
							iconClassName={brandTrailIconClass}
							textClassName={trailTextClass}
							headerPortal={headerPortal}
						/>
					</>
				) : null}
			</div>
		</nav>
	);
}

function copyLabels(portal: HeaderPortal, shareableId: string, copied: boolean) {
	if (portal === "parent") {
		return {
			tooltip: copied ? "Child link code copied" : "Copy child link code",
			ariaLabel: copied
				? "Child link code copied to clipboard"
				: `Copy child link code ${shareableId} to clipboard`,
		};
	}
	return {
		tooltip: copied ? "Student ID copied" : "Copy student ID",
		ariaLabel: copied
			? "Student ID copied to clipboard"
			: `Copy student ID ${shareableId} to clipboard`,
	};
}

function CopyableShareableIdSegment({
	shareableId,
	iconClassName,
	textClassName,
	headerPortal,
}: {
	shareableId: string;
	iconClassName: string;
	textClassName: string;
	headerPortal: HeaderPortal;
}) {
	const [copied, setCopied] = useState(false);
	const reduceMotion = useReducedMotion();
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { tooltip, ariaLabel } = copyLabels(headerPortal, shareableId, copied);

	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) {
				clearTimeout(copiedTimeoutRef.current);
			}
		};
	}, []);

	async function copyId() {
		try {
			await navigator.clipboard.writeText(shareableId);
			setCopied(true);
			if (copiedTimeoutRef.current) {
				clearTimeout(copiedTimeoutRef.current);
			}
			copiedTimeoutRef.current = setTimeout(() => {
				setCopied(false);
				copiedTimeoutRef.current = null;
			}, 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={() => void copyId()}
						aria-label={ariaLabel}
						className={cn(
							"flex cursor-pointer items-center rounded-sm border-0 bg-transparent outline-none",
							"max-md:min-h-11 max-md:min-w-11 max-md:shrink-0 max-md:justify-center max-md:rounded-md max-md:p-0",
							"hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"md:min-w-0 md:max-w-full md:justify-start md:gap-2 md:p-0 md:text-left",
						)}
					>
						<IdCardIcon
							className={cn(iconClassName, "max-md:size-4")}
							strokeWidth={2}
							aria-hidden
						/>
						<span
							className={cn(
								textClassName,
								"hidden min-w-0 font-mono tabular-nums tracking-tight md:block",
							)}
						>
							<span className="truncate">{shareableId}</span>
						</span>
						<AnimatePresence mode="popLayout">
							{copied ? (
								<motion.span
									key="shareable-id-copied-badge"
									className="hidden shrink-0 md:inline-flex"
									initial={
										reduceMotion
											? { opacity: 0 }
											: { opacity: 0, y: 8, scale: 0.96 }
									}
									animate={
										reduceMotion
											? { opacity: 1 }
											: { opacity: 1, y: 0, scale: 1 }
									}
									exit={
										reduceMotion
											? { opacity: 0 }
											: {
													opacity: 0,
													y: -4,
													scale: 0.98,
													transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
												}
									}
									transition={{
										duration: reduceMotion ? 0.12 : 0.28,
										ease: [0.22, 1, 0.36, 1],
									}}
								>
									<Badge variant="secondary" className="shrink-0">
										<CopyIcon strokeWidth={2} aria-hidden />
										Copied
									</Badge>
								</motion.span>
							) : null}
						</AnimatePresence>
						<span className="sr-only" aria-live="polite">
							{copied ? "Copied to clipboard" : ""}
						</span>
					</button>
				}
			/>
			<TooltipContent side="bottom" align="start" className="max-w-[14rem]">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}
