"use client";

import * as React from "react";

import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Shared frosted panel shell for testimonial and avatar strip.
 * `transform-gpu` promotes a layer so `backdrop-filter` paints reliably once parent `overflow` is visible.
 */
const AUTH_FROST_GLASS =
	"isolate transform-gpu rounded-xl border border-white/12 ring-1 ring-white/[0.06] bg-black/[0.58] shadow-2xl shadow-black/45 backdrop-blur-xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(1.5)] supports-[backdrop-filter]:bg-black/[0.38]";

/** Slightly slower on auth so the strip feels calmer next to form work (critique: peripheral motion). */
const ROTATE_MS = 7500;

const REVIEWS = [
	{
		quote:
			"Practice finally feels targeted. I can see weak chapters in my report and spend time there first.",
		attribution: "Aarav, Grade 10",
	},
	{
		quote:
			"Having doubt help in one place keeps me from bouncing between tabs when I get stuck at night.",
		attribution: "Meera, Grade 12",
	},
	{
		quote:
			"Assignments show up clearly, and I like knowing what is from my teacher versus what I chose myself.",
		attribution: "Jordan, Grade 9",
	},
	{
		quote:
			"The performance view is honest. My parents see the same numbers I do, so there is no guessing.",
		attribution: "Sam, Grade 11",
	},
	{
		quote:
			"Short practice sessions work on my phone after practice. Loading is quick and the layout stays readable.",
		attribution: "Priya, Grade 8",
	},
] as const;

const quoteMarkFlankClass =
	"select-none text-[1.65rem] font-semibold leading-none text-primary md:text-4xl";

function ReviewQuoteBlock({
	text,
	attribution,
	reduceMotion,
	contentKey,
}: {
	text: string;
	attribution: string;
	reduceMotion: boolean;
	contentKey: number;
}) {
	return (
		<div
			aria-live="polite"
			aria-atomic="true"
			className={cn(
				!reduceMotion &&
					"motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 motion-safe:ease-out",
			)}
			key={contentKey}
		>
			<blockquote className="m-0 grid min-w-0 grid-cols-[auto_1fr_auto] items-stretch gap-x-2.5 md:gap-x-3">
				<span
					aria-hidden
					className={cn(quoteMarkFlankClass, "pointer-events-none pt-0.5 leading-none")}
				>
					&ldquo;
				</span>
				<div className="min-w-0">
					<p className="text-[0.9375rem] font-normal leading-relaxed tracking-[-0.01em] text-card-foreground md:text-base">
						{text}
					</p>
					<footer className="mt-4 md:mt-5">
						<cite className="text-[0.8125rem] font-medium italic leading-snug text-card-foreground/90 md:text-sm">
							{attribution}
						</cite>
					</footer>
				</div>
				<span
					aria-hidden
					className={cn(
						quoteMarkFlankClass,
						"pointer-events-none self-end pb-0.5 leading-none",
					)}
				>
					&rdquo;
				</span>
			</blockquote>
		</div>
	);
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = React.useState(false);
	React.useEffect(() => {
		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReduced(mql.matches);
		sync();
		mql.addEventListener("change", sync);
		return () => mql.removeEventListener("change", sync);
	}, []);
	return reduced;
}

function useDesktopMd(): boolean {
	const [desktop, setDesktop] = React.useState(false);
	React.useEffect(() => {
		const mql = window.matchMedia("(min-width: 768px)");
		const sync = () => setDesktop(mql.matches);
		sync();
		mql.addEventListener("change", sync);
		return () => mql.removeEventListener("change", sync);
	}, []);
	return desktop;
}

export function AuthStudentReviewsRotator() {
	const desktop = useDesktopMd();
	const reduceMotion = usePrefersReducedMotion();
	const [index, setIndex] = React.useState(0);
	const [hoverPaused, setHoverPaused] = React.useState(false);
	const [tabHidden, setTabHidden] = React.useState(false);

	React.useEffect(() => {
		const onVis = () => setTabHidden(document.visibilityState === "hidden");
		onVis();
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);

	React.useEffect(() => {
		if (!desktop || hoverPaused || tabHidden) return;
		const id = window.setInterval(() => {
			setIndex((i) => (i + 1) % REVIEWS.length);
		}, ROTATE_MS);
		return () => window.clearInterval(id);
	}, [desktop, hoverPaused, tabHidden]);

	const active = REVIEWS[index] ?? REVIEWS[0];

	if (!desktop) return null;

	return (
		<section
			aria-label="Student perspectives"
			className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-3 py-6 md:px-5"
			onPointerEnter={() => setHoverPaused(true)}
			onPointerLeave={() => setHoverPaused(false)}
		>
			<div
				className={cn(
					AUTH_FROST_GLASS,
					"relative w-full max-w-sm px-5 pb-5 pt-10 text-card-foreground md:px-6 md:pb-6 md:pt-11",
				)}
			>
				<Badge
					variant="outline"
					className={cn(
						"absolute left-1/2 top-0 z-30 h-auto min-h-8 -translate-x-1/2 -translate-y-1/2",
						"border-white/18 bg-black/55 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-card-foreground",
						"shadow-md shadow-black/30 backdrop-blur-md supports-[backdrop-filter]:bg-black/45",
					)}
				>
					From students
				</Badge>
				<ReviewQuoteBlock
					text={active.quote}
					attribution={active.attribution}
					reduceMotion={reduceMotion}
					contentKey={index}
				/>
			</div>

			<div
				className={cn(
					AUTH_FROST_GLASS,
					"flex w-full max-w-sm items-center justify-center px-4 py-4 md:px-6 md:py-5",
				)}
			>
				<AvatarGroup
					className="grayscale -space-x-3"
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
					<AvatarGroupCount className="h-10 min-h-10 min-w-10 w-auto shrink-0 rounded-full border border-white/12 bg-black/55 px-2 text-xs font-semibold leading-none tracking-tight text-card-foreground backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] supports-[backdrop-filter]:bg-black/45">
						+40K
					</AvatarGroupCount>
				</AvatarGroup>
			</div>
		</section>
	);
}
