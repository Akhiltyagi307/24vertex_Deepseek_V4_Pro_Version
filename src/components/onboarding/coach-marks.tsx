"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CoachMarkStep = {
	/** Matches an element rendered with `data-onboarding-id="<targetId>"`. */
	targetId: string;
	title: string;
	body: string;
	/** Preferred side to anchor the card; auto-flips when it would overflow. */
	placement?: "top" | "bottom" | "left" | "right";
};

export type CoachMarksProps = {
	steps: CoachMarkStep[];
	active: boolean;
	/** User skipped / pressed Esc / clicked the backdrop. */
	onClose: () => void;
	/** User reached and confirmed the final step. */
	onFinish: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const CARD_WIDTH = 320;
const CARD_GAP = 12;
const RING_PAD = 6;
const VIEWPORT_MARGIN = 12;

function locateTarget(targetId: string): HTMLElement | null {
	if (typeof document === "undefined") return null;
	return document.querySelector<HTMLElement>(`[data-onboarding-id="${CSS.escape(targetId)}"]`);
}

/** Resolve the next reachable step at or after `from`, walking `dir`. -1 if none. */
function findReachableStep(steps: CoachMarkStep[], from: number, dir: 1 | -1): number {
	for (let i = from; i >= 0 && i < steps.length; i += dir) {
		if (locateTarget(steps[i].targetId)) return i;
	}
	return -1;
}

/**
 * True when at least one step's target is currently in the DOM. Callers use this
 * to decide whether starting the tour is worthwhile — on mobile the sidebar is a
 * closed (unmounted) drawer, so every `data-onboarding-id` target is absent and a
 * tour would render a contentless card. Must be called client-side (reads the DOM).
 */
export function hasReachableTourTarget(steps: CoachMarkStep[]): boolean {
	return findReachableStep(steps, 0, 1) !== -1;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Position the card next to the highlighted rect, flipping/clamping to stay on
 * screen. Coordinates are viewport-relative (the overlay is `position: fixed`).
 */
function computeCardPosition(
	rect: Rect,
	placement: CoachMarkStep["placement"],
	cardHeight: number,
	viewport: { width: number; height: number },
): { top: number; left: number } {
	const pref = placement ?? "bottom";
	const fitsBottom = rect.top + rect.height + CARD_GAP + cardHeight <= viewport.height - VIEWPORT_MARGIN;
	const fitsTop = rect.top - CARD_GAP - cardHeight >= VIEWPORT_MARGIN;
	const fitsRight = rect.left + rect.width + CARD_GAP + CARD_WIDTH <= viewport.width - VIEWPORT_MARGIN;
	const fitsLeft = rect.left - CARD_GAP - CARD_WIDTH >= VIEWPORT_MARGIN;

	let side = pref;
	if (pref === "bottom" && !fitsBottom && fitsTop) side = "top";
	else if (pref === "top" && !fitsTop && fitsBottom) side = "bottom";
	else if (pref === "right" && !fitsRight && fitsLeft) side = "left";
	else if (pref === "left" && !fitsLeft && fitsRight) side = "right";

	let top: number;
	let left: number;
	if (side === "top") {
		top = rect.top - CARD_GAP - cardHeight;
		left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
	} else if (side === "left") {
		top = rect.top + rect.height / 2 - cardHeight / 2;
		left = rect.left - CARD_GAP - CARD_WIDTH;
	} else if (side === "right") {
		top = rect.top + rect.height / 2 - cardHeight / 2;
		left = rect.left + rect.width + CARD_GAP;
	} else {
		top = rect.top + rect.height + CARD_GAP;
		left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
	}

	return {
		top: clamp(top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.height - cardHeight - VIEWPORT_MARGIN)),
		left: clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.width - CARD_WIDTH - VIEWPORT_MARGIN)),
	};
}

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CoachMarks({ steps, active, onClose, onFinish }: CoachMarksProps) {
	const reduceMotion = useReducedMotion();
	// Start on the first reachable step. The orchestrator remounts this component
	// (via `key`) each time the tour starts, so the lazy initializer re-runs fresh
	// — no need (and not allowed) to reset via a synchronous setState in an effect.
	const [stepIndex, setStepIndex] = React.useState(() => {
		const first = findReachableStep(steps, 0, 1);
		return first === -1 ? 0 : first;
	});
	const [rect, setRect] = React.useState<Rect | null>(null);
	const [cardHeight, setCardHeight] = React.useState(160);
	const [viewport, setViewport] = React.useState<{ width: number; height: number }>(() => ({
		width: typeof window !== "undefined" ? window.innerWidth : 0,
		height: typeof window !== "undefined" ? window.innerHeight : 0,
	}));
	const cardRef = React.useRef<HTMLDivElement | null>(null);
	const restoreFocusRef = React.useRef<HTMLElement | null>(null);
	const overlayRef = React.useRef<HTMLDivElement | null>(null);

	const stepCount = steps.length;
	const currentStep = steps[stepIndex];

	// Capture the previously-focused element when the tour opens and restore it on
	// close/unmount. No setState here, so the `set-state-in-effect` rule is safe.
	React.useEffect(() => {
		if (!active) return;
		restoreFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		return () => {
			restoreFocusRef.current?.focus?.();
		};
	}, [active]);

	// While the tour is open, mark every other top-level element inert so assistive
	// tech can't reach the visually-dimmed background. The overlay is portaled to
	// <body> (below), so it's a sibling we skip. The Base UI welcome modal gets this
	// from its primitive; the hand-rolled tour needs it explicit.
	React.useEffect(() => {
		if (!active) return;
		const overlay = overlayRef.current;
		const inerted: HTMLElement[] = [];
		for (const child of Array.from(document.body.children)) {
			if (child === overlay || !(child instanceof HTMLElement) || child.inert) continue;
			child.inert = true;
			inerted.push(child);
		}
		return () => {
			for (const el of inerted) el.inert = false;
		};
	}, [active]);

	// Track the highlighted target's rect across scroll/resize. We schedule the
	// read inside rAF (async) so we never call setState in the effect body, which
	// the `react-hooks/set-state-in-effect` lint rule forbids.
	React.useEffect(() => {
		if (!active || !currentStep) return;
		let frame = 0;
		const measure = () => {
			const el = locateTarget(currentStep.targetId);
			if (!el) {
				setRect(null);
				return;
			}
			const r = el.getBoundingClientRect();
			setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
			setViewport({ width: window.innerWidth, height: window.innerHeight });
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		const el = locateTarget(currentStep.targetId);
		el?.scrollIntoView({
			behavior: reduceMotion ? "auto" : "smooth",
			block: "center",
			inline: "nearest",
		});
		schedule();
		window.addEventListener("scroll", schedule, true);
		window.addEventListener("resize", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
		};
	}, [active, currentStep, reduceMotion]);

	// Measure the card height (for top/left placement) without setState-in-effect:
	// a ResizeObserver fires asynchronously after layout.
	React.useEffect(() => {
		if (!active) return;
		const node = cardRef.current;
		if (!node) return;
		const observer = new ResizeObserver(() => {
			setCardHeight(node.offsetHeight);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [active, stepIndex]);

	// Move focus into the card when the step changes (async via rAF to avoid
	// setstate-in-effect ordering and to wait for the card to paint).
	React.useEffect(() => {
		if (!active) return;
		const frame = requestAnimationFrame(() => {
			cardRef.current?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [active, stepIndex]);

	const goToStep = React.useCallback(
		(next: number, dir: 1 | -1) => {
			const reachable = findReachableStep(steps, next, dir);
			if (reachable === -1) {
				onFinish();
				return;
			}
			setStepIndex(reachable);
		},
		[steps, onFinish],
	);

	const isLast = React.useMemo(() => {
		if (stepIndex >= stepCount - 1) return true;
		// Last *reachable* step: nothing valid remains after the current one.
		return findReachableStep(steps, stepIndex + 1, 1) === -1;
	}, [steps, stepIndex, stepCount]);

	const isFirst = React.useMemo(() => {
		if (stepIndex <= 0) return true;
		return findReachableStep(steps, stepIndex - 1, -1) === -1;
	}, [steps, stepIndex]);

	const handleNext = React.useCallback(() => {
		if (isLast) {
			onFinish();
			return;
		}
		goToStep(stepIndex + 1, 1);
	}, [isLast, goToStep, stepIndex, onFinish]);

	const handleBack = React.useCallback(() => {
		if (isFirst) return;
		goToStep(stepIndex - 1, -1);
	}, [isFirst, goToStep, stepIndex]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key === "ArrowRight" || event.key === "Enter") {
				event.preventDefault();
				handleNext();
				return;
			}
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				handleBack();
				return;
			}
			if (event.key === "Tab") {
				// Trap focus inside the card.
				const node = cardRef.current;
				if (!node) return;
				const focusable = Array.from(
					node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
				).filter((el) => el.offsetParent !== null || el === document.activeElement);
				if (focusable.length === 0) {
					event.preventDefault();
					node.focus();
					return;
				}
				const firstEl = focusable[0];
				const lastEl = focusable[focusable.length - 1];
				const activeEl = document.activeElement;
				if (event.shiftKey && (activeEl === firstEl || activeEl === node)) {
					event.preventDefault();
					lastEl.focus();
				} else if (!event.shiftKey && activeEl === lastEl) {
					event.preventDefault();
					firstEl.focus();
				}
			}
		},
		[onClose, handleNext, handleBack],
	);

	if (!active || stepCount === 0 || !currentStep) return null;

	const cardPos = rect ? computeCardPosition(rect, currentStep.placement, cardHeight, viewport) : null;
	const transitionClass = reduceMotion
		? ""
		: "transition-[top,left,width,height] duration-200 ease-out";

	return createPortal(
		<div
			ref={overlayRef}
			className="fixed inset-0 z-[100]"
			role="presentation"
			onKeyDown={handleKeyDown}
		>
			{/* Click-catcher that skips the tour. The dim scrim normally comes from the
				spotlight element below (which cuts a hole around the target); only fall
				back to a flat full-screen dim when there's no target rect to spotlight. */}
			<button
				type="button"
				aria-label="Skip tour"
				tabIndex={-1}
				onClick={onClose}
				className={cn(
					"absolute inset-0 h-full w-full cursor-default outline-none",
					rect ? "" : "bg-[color-mix(in_oklab,oklch(0.13_0.01_285)_55%,transparent)]",
					reduceMotion ? "" : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
				)}
			/>

			{/* Highlight ring + spotlight tracking the target via getBoundingClientRect.
				The viewport-sized box-shadow scrims everything EXCEPT this element's rect,
				so the highlighted target shows through at full brightness. The scrim is a
				fixed dark (faint brand-violet tint) so it darkens the surroundings in BOTH
				light and dark themes — a foreground-based dim would invert to a light wash
				in dark mode. The rounded-xl shape gives a soft cut-out; the emerald ring frames it. */}
			{rect ? (
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute rounded-xl ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent",
						"shadow-[0_0_0_9999px_color-mix(in_oklab,oklch(0.13_0.01_285)_55%,transparent)]",
						reduceMotion ? "" : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
						transitionClass,
					)}
					style={{
						top: rect.top - RING_PAD,
						left: rect.left - RING_PAD,
						width: rect.width + RING_PAD * 2,
						height: rect.height + RING_PAD * 2,
					}}
				/>
			) : null}

			{/* The coach-mark card. Anchored to the target; centered fallback if no rect. */}
			<div
				ref={cardRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="coach-mark-title"
				aria-describedby="coach-mark-body"
				tabIndex={-1}
				className={cn(
					"absolute w-[20rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
					transitionClass,
					reduceMotion
						? ""
						: "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
				)}
				style={
					cardPos
						? { top: cardPos.top, left: cardPos.left }
						: {
								top: "50%",
								left: "50%",
								transform: "translate(-50%, -50%)",
							}
				}
			>
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between gap-2">
						<p
							id="coach-mark-title"
							className="font-heading text-sm font-semibold leading-snug text-foreground"
						>
							{currentStep.title}
						</p>
						<span className="shrink-0 text-2xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
							{stepIndex + 1} / {stepCount}
						</span>
					</div>
					<p id="coach-mark-body" className="text-sm leading-snug text-muted-foreground">
						{currentStep.body}
					</p>
				</div>
				<div className="mt-4 flex items-center justify-between gap-2">
					<Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
						Skip
					</Button>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleBack}
							disabled={isFirst}
						>
							Back
						</Button>
						<Button size="sm" onClick={handleNext}>
							{isLast ? "Done" : "Next"}
						</Button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
