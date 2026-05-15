"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { AUTH_FROST_GLASS, AuthTrustedStudentsGlassStrip } from "./auth-trusted-students-glass-strip";

const ROTATE_MS = 7500;

const REVIEWS = [
	{
		quote:
			"I can spot gaps class-wide and nudge students to the right practice sets without another spreadsheet.",
		attribution: "Ms. Kapoor, Science lead",
	},
	{
		quote:
			"Assignments from me and self-practice show up in one timeline—fewer \"which app is this?\" moments.",
		attribution: "Mr. Patel, Mathematics",
	},
	{
		quote:
			"When a parent asks how their child is doing, I point to the same progress view they can see at home.",
		attribution: "Ananya, Grade coordinator",
	},
	{
		quote:
			"Approval took a day; after that, linking students by link code was faster than our old roster export.",
		attribution: "Rahul, Private tutor",
	},
] as const;

const quoteMarkFlankClass =
	"select-none text-[1.65rem] font-semibold leading-none text-primary medium:text-4xl";

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
			<blockquote className="m-0 grid min-w-0 grid-cols-[auto_1fr_auto] items-stretch gap-x-2.5 medium:gap-x-3">
				<span
					aria-hidden
					className={cn(quoteMarkFlankClass, "pointer-events-none pt-0.5 leading-none")}
				>
					&ldquo;
				</span>
				<div className="min-w-0">
					<p className="text-[0.9375rem] font-normal leading-relaxed tracking-[-0.01em] text-card-foreground medium:text-base">
						{text}
					</p>
					<footer className="mt-4 medium:mt-5">
						<cite className="text-[0.8125rem] font-medium italic leading-snug text-card-foreground/90 medium:text-sm">
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

export function AuthEducatorReviewsRotator() {
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
			aria-label="Educator perspectives"
			className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-3 py-6 medium:px-5"
			onPointerEnter={() => setHoverPaused(true)}
			onPointerLeave={() => setHoverPaused(false)}
		>
			<div
				className={cn(
					AUTH_FROST_GLASS,
					"relative w-full max-w-sm px-5 pb-5 pt-10 text-card-foreground medium:px-6 medium:pb-6 medium:pt-11",
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
					From teachers
				</Badge>
				<ReviewQuoteBlock
					text={active.quote}
					attribution={active.attribution}
					reduceMotion={reduceMotion}
					contentKey={index}
				/>
			</div>

			<AuthTrustedStudentsGlassStrip trustKind="educators" />
		</section>
	);
}
