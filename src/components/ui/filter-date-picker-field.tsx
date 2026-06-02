"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	appTimeZoneDateKey,
	dateKeyToNoonInAppTimeZone,
	formatDateShortDMYInAppTimeZone,
} from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";

export type FilterDatePickerFieldProps = {
	id: string;
	value: string | null;
	onValueChange: (dateKey: string | null) => void;
	placeholder?: string;
	className?: string;
	/** Inclusive lower bound (yyyy-MM-dd) for selectable days. */
	minDateKey?: string | null;
	/** Inclusive upper bound (yyyy-MM-dd) for selectable days. */
	maxDateKey?: string | null;
};

/**
 * Date-only filter control: Shadcn Calendar + Popover (same stack as teacher assignment due picker).
 * Values are yyyy-MM-dd keys in {@link APP_TIME_ZONE}.
 */
export function FilterDatePickerField({
	id,
	value,
	onValueChange,
	placeholder = "Pick a date",
	className,
	minDateKey,
	maxDateKey,
}: FilterDatePickerFieldProps) {
	const [open, setOpen] = React.useState(false);

	const selected = React.useMemo(
		() => (value ? dateKeyToNoonInAppTimeZone(value) : undefined),
		[value],
	);

	const disabledMatchers = React.useMemo((): Matcher[] | undefined => {
		const matchers: Matcher[] = [];
		if (minDateKey) {
			const min = dateKeyToNoonInAppTimeZone(minDateKey);
			if (Number.isFinite(min.getTime())) matchers.push({ before: min });
		}
		if (maxDateKey) {
			const max = dateKeyToNoonInAppTimeZone(maxDateKey);
			if (Number.isFinite(max.getTime())) matchers.push({ after: max });
		}
		return matchers.length > 0 ? matchers : undefined;
	}, [minDateKey, maxDateKey]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				id={id}
				type="button"
				className={cn(
					"flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left font-normal text-sm shadow-xs",
					"hover:bg-muted/40 dark:bg-input/35 dark:hover:bg-input/50",
					"focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
					className,
				)}
			>
				<span className="flex min-w-0 items-center gap-2">
					<CalendarIcon className="size-4 shrink-0 text-primary" aria-hidden />
					<span className={cn("min-w-0 truncate", value ? "text-foreground" : "text-muted-foreground")}>
						{value ? formatDateShortDMYInAppTimeZone(selected!) : placeholder}
					</span>
				</span>
				<ChevronDownIcon
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
						open && "rotate-180",
					)}
					aria-hidden
				/>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				sideOffset={10}
				className={cn(
					"w-[min(100vw-1.25rem,22rem)] max-w-none p-4 shadow-xl ring-1 ring-border/80 medium:w-auto medium:min-w-[min(100vw-2rem,32rem)] medium:p-5",
					"data-[slot=popover-content]:max-h-none",
				)}
			>
				<div className="flex flex-col gap-5">
					<Calendar
						mode="single"
						selected={selected}
						onSelect={(day) => {
							if (!day) return;
							onValueChange(appTimeZoneDateKey(day));
							setOpen(false);
						}}
						defaultMonth={selected ?? new Date()}
						disabled={disabledMatchers}
						showOutsideDays
						className="mx-auto w-full rounded-xl bg-muted/20 p-3 [--cell-size:3rem] medium:p-4 medium:[--cell-size:3.5rem]"
						formatters={{
							formatWeekdayName: (date, options) =>
								date.toLocaleDateString(options?.locale?.code ?? "en-IN", { weekday: "narrow" }),
						}}
					/>

					<div className="flex flex-wrap items-center gap-2 border-border border-t pt-4 dark:border-border/80">
						<Button
							type="button"
							size="sm"
							className="bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90"
							onClick={() => setOpen(false)}
						>
							Done
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="ml-auto border-dashed"
							disabled={!value}
							onClick={() => {
								onValueChange(null);
								setOpen(false);
							}}
						>
							Clear
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
