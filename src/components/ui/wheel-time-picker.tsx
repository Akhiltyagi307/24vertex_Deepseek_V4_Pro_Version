"use client";

import * as React from "react";

import {
	snapMinuteToWheelStep,
	toWheelTime12Hour,
	toWheelTime24Hour,
	WHEEL_TIME_HOURS_12,
	WHEEL_TIME_MINUTES,
	WHEEL_TIME_PERIODS,
	type WheelTimeParts,
	type WheelTimePeriod,
} from "@/lib/datetime/wheel-time";
import { cn } from "@/lib/utils";

export type { WheelTimeParts };

export type WheelTimePickerSize = "default" | "compact";

type WheelMetrics = {
	itemHeightPx: number;
	visibleCount: number;
	rowClassName: string;
	colonClassName: string;
	fadeClassName: string;
	bandClassName: string;
};

const WHEEL_METRICS: Record<WheelTimePickerSize, WheelMetrics> = {
	default: {
		itemHeightPx: 40,
		visibleCount: 5,
		rowClassName: "text-lg",
		colonClassName: "w-4 text-xl",
		fadeClassName: "h-14",
		bandClassName: "inset-x-2 h-10 rounded-lg",
	},
	compact: {
		itemHeightPx: 30,
		visibleCount: 3,
		rowClassName: "text-base",
		colonClassName: "w-3 text-base",
		fadeClassName: "h-7",
		bandClassName: "inset-x-4 h-[30px] rounded-md",
	},
};

function edgePaddingPx(metrics: WheelMetrics): number {
	return ((metrics.visibleCount - 1) / 2) * metrics.itemHeightPx;
}

export type WheelTimePickerProps = {
	value: WheelTimeParts;
	onChange: (value: WheelTimeParts) => void;
	disabled?: boolean;
	className?: string;
	size?: WheelTimePickerSize;
	"aria-label"?: string;
};

function WheelColumn<T extends string | number>({
	items,
	value,
	onChange,
	format,
	disabled,
	ariaLabel,
	metrics,
}: {
	items: readonly T[];
	value: T;
	onChange: (value: T) => void;
	format: (item: T) => string;
	disabled?: boolean;
	ariaLabel: string;
	metrics: WheelMetrics;
}) {
	const scrollerRef = React.useRef<HTMLDivElement>(null);
	const scrollEndTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const { itemHeightPx, visibleCount, rowClassName } = metrics;
	const wheelHeightPx = itemHeightPx * visibleCount;
	const edgePadding = edgePaddingPx(metrics);

	const indexForValue = React.useCallback(
		(v: T) => {
			const idx = items.indexOf(v);
			return idx >= 0 ? idx : 0;
		},
		[items],
	);

	const scrollToIndex = React.useCallback(
		(index: number, behavior: ScrollBehavior = "auto") => {
			const el = scrollerRef.current;
			if (!el) return;
			el.scrollTo({ top: index * itemHeightPx, behavior });
		},
		[itemHeightPx],
	);

	React.useLayoutEffect(() => {
		scrollToIndex(indexForValue(value));
	}, [value, indexForValue, scrollToIndex]);

	const emitIndex = React.useCallback(
		(index: number) => {
			const clamped = Math.max(0, Math.min(items.length - 1, index));
			const next = items[clamped];
			if (next !== value) onChange(next);
		},
		[items, onChange, value],
	);

	const handleScroll = React.useCallback(() => {
		if (disabled) return;
		if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
		scrollEndTimerRef.current = setTimeout(() => {
			const el = scrollerRef.current;
			if (!el) return;
			const index = Math.round(el.scrollTop / itemHeightPx);
			emitIndex(index);
			scrollToIndex(index, "smooth");
		}, 80);
	}, [disabled, emitIndex, itemHeightPx, scrollToIndex]);

	React.useEffect(
		() => () => {
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
		},
		[],
	);

	return (
		<div
			className={cn("relative min-w-0 flex-1", disabled && "pointer-events-none opacity-45")}
			aria-label={ariaLabel}
		>
			<div
				ref={scrollerRef}
				onScroll={handleScroll}
				tabIndex={disabled ? -1 : 0}
				className={cn(
					"h-[--wheel-h] overflow-y-auto overscroll-y-contain scroll-smooth",
					"snap-y snap-mandatory",
					"[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
				)}
				style={
					{
						"--wheel-h": `${wheelHeightPx}px`,
						"--wheel-item-h": `${itemHeightPx}px`,
					} as React.CSSProperties
				}
			>
				<div aria-hidden style={{ height: edgePadding }} />
				{items.map((item) => {
					const selected = item === value;
					return (
						<div
							key={String(item)}
							className={cn(
								"flex h-[--wheel-item-h] shrink-0 snap-center items-center justify-center font-medium tabular-nums tracking-tight",
								rowClassName,
								selected ? "text-foreground" : "text-muted-foreground/50",
							)}
						>
							{format(item)}
						</div>
					);
				})}
				<div aria-hidden style={{ height: edgePadding }} />
			</div>
		</div>
	);
}

/**
 * iOS-style scroll wheel for time (12-hour clock, 5-minute steps).
 * Use `size="compact"` in popovers and dense forms (3 visible rows).
 */
export function WheelTimePicker({
	value,
	onChange,
	disabled,
	className,
	size = "compact",
	"aria-label": ariaLabel = "Time",
}: WheelTimePickerProps) {
	const metrics = WHEEL_METRICS[size];
	const { hour12, period } = toWheelTime12Hour(value.hour24);
	const minute = snapMinuteToWheelStep(value.minute);

	const updateFrom12h = React.useCallback(
		(nextHour12: number, nextMinute: number, nextPeriod: WheelTimePeriod) => {
			onChange({
				hour24: toWheelTime24Hour(nextHour12, nextPeriod),
				minute: snapMinuteToWheelStep(nextMinute),
			});
		},
		[onChange],
	);

	return (
		<div
			className={cn("relative mx-auto w-full max-w-[13.5rem] select-none", className)}
			role="group"
			aria-label={ariaLabel}
			aria-disabled={disabled || undefined}
		>
			<div
				className={cn(
					"pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 border border-border/60 bg-muted/40 dark:bg-muted/30",
					metrics.bandClassName,
				)}
				aria-hidden
			/>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-[1] bg-gradient-to-b from-popover via-popover/80 to-transparent",
					metrics.fadeClassName,
				)}
				aria-hidden
			/>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-popover via-popover/80 to-transparent",
					metrics.fadeClassName,
				)}
				aria-hidden
			/>

			<div className="relative z-[2] flex items-stretch">
				<WheelColumn
					items={WHEEL_TIME_HOURS_12}
					value={hour12}
					onChange={(h) => updateFrom12h(h, minute, period)}
					format={(h) => String(h)}
					disabled={disabled}
					ariaLabel="Hour"
					metrics={metrics}
				/>
				<div
					className={cn(
						"flex shrink-0 items-center justify-center self-center font-semibold text-foreground",
						metrics.colonClassName,
					)}
					aria-hidden
				>
					:
				</div>
				<WheelColumn
					items={WHEEL_TIME_MINUTES}
					value={minute}
					onChange={(m) => updateFrom12h(hour12, m, period)}
					format={(m) => String(m).padStart(2, "0")}
					disabled={disabled}
					ariaLabel="Minute"
					metrics={metrics}
				/>
				<WheelColumn
					items={WHEEL_TIME_PERIODS}
					value={period}
					onChange={(p) => updateFrom12h(hour12, minute, p)}
					format={(p) => p}
					disabled={disabled}
					ariaLabel="AM or PM"
					metrics={metrics}
				/>
			</div>
		</div>
	);
}
