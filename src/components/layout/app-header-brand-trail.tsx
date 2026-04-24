"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CopyIcon, IdCardIcon, SchoolIcon, UserRoundIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";

const brandTrailIconClass = "size-4 shrink-0 text-muted-foreground";

const trailTextClass = "truncate font-normal text-foreground text-sm leading-tight";

/** Same slash as between organization / user segments (design-v2 breadcrumb). */
export function HeaderBreadcrumbSlash() {
	return (
		<span
			className="shrink-0 px-1 font-mono text-muted-foreground text-xs tabular-nums select-none"
			aria-hidden
		>
			/
		</span>
	);
}

export type AppHeaderBrandTrailProps = {
	organizationName?: string;
	userDisplayName?: string;
	shareableId?: string | null;
};

export function AppHeaderBrandTrail({
	organizationName = "EduAI",
	userDisplayName = "Student",
	shareableId = null,
}: AppHeaderBrandTrailProps) {
	return (
		<nav
			aria-label="App context"
			className="flex min-w-0 max-w-full items-center gap-x-2 text-sm md:gap-x-3"
		>
			<Image
				src="/brand/logo-icon.png"
				alt=""
				width={28}
				height={28}
				className="size-[1.725rem] shrink-0 rounded-md object-contain"
			/>
			<HeaderBreadcrumbSlash />
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
						<CopyableStudentIdSegment
							shareableId={shareableId}
							iconClassName={brandTrailIconClass}
							textClassName={trailTextClass}
						/>
					</>
				) : null}
			</div>
		</nav>
	);
}

function CopyableStudentIdSegment({
	shareableId,
	iconClassName,
	textClassName,
}: {
	shareableId: string;
	iconClassName: string;
	textClassName: string;
}) {
	const [copied, setCopied] = useState(false);
	const reduceMotion = useReducedMotion();

	async function copyId() {
		try {
			await navigator.clipboard.writeText(shareableId);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<button
			type="button"
			onClick={copyId}
			className="flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			aria-label={
				copied
					? "Student ID copied to clipboard"
					: `Copy student ID ${shareableId} to clipboard`
			}
		>
			<IdCardIcon className={iconClassName} strokeWidth={2} aria-hidden />
			<span
				className={`${textClassName} min-w-0 font-mono tabular-nums tracking-tight`}
			>
				<span className="truncate">{shareableId}</span>
			</span>
			<AnimatePresence mode="popLayout">
				{copied ? (
					<motion.span
						key="student-id-copied-badge"
						className="inline-flex shrink-0"
						initial={
							reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }
						}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
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
	);
}
