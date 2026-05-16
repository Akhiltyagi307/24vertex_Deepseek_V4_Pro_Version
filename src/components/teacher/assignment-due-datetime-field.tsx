"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

import { panelRaisedInputClass } from "@/app/student/settings/_settings-form-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/** Value accepted by `datetime-local` and `Date.parse` in browsers / Node. */
export function dateToDueAtFieldValue(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export type AssignmentDueDatetimeFieldProps = {
	/** Optional controlled key bump when the parent form resets (same as form remount). */
	id?: string;
	className?: string;
};

/**
 * Shadcn Calendar + Popover due picker for assignment forms.
 * Submits `due_at` via a hidden input (`datetime-local`-compatible string, empty when unset).
 */
export function AssignmentDueDatetimeField({ id, className }: AssignmentDueDatetimeFieldProps) {
	const labelId = id ?? "assignment-due-field-label";
	const timeId = `${labelId}-time`;
	const hintId = `${labelId}-hint`;

	const [open, setOpen] = React.useState(false);
	const [selected, setSelected] = React.useState<Date | undefined>(undefined);

	const timeInputValue = selected ? `${pad2(selected.getHours())}:${pad2(selected.getMinutes())}` : "";

	const mergeCalendarDay = React.useCallback((day: Date) => {
		setSelected((prev) => {
			const next = new Date(day);
			if (prev) {
				next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
			} else {
				next.setHours(12, 0, 0, 0);
			}
			return next;
		});
	}, []);

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<input type="hidden" name="due_at" value={selected ? dateToDueAtFieldValue(selected) : ""} readOnly aria-hidden />

			<div className="space-y-1.5">
				<span id={labelId} className="font-medium text-foreground text-sm leading-none">
					Due date
				</span>
				<p id={hintId} className="text-muted-foreground text-xs leading-relaxed">
					Optional. Students still see the assignment without one.
				</p>
			</div>

			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					type="button"
					aria-labelledby={labelId}
					aria-describedby={hintId}
					className={cn(
						buttonVariants({ variant: "outline" }),
						"h-auto min-h-12 w-full justify-between gap-3 rounded-xl px-4 py-3 text-left font-normal shadow-sm",
						"hover:bg-muted/50 dark:bg-input/35 dark:hover:bg-input/50",
						"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
					)}
				>
					<span className="flex min-w-0 items-center gap-2.5">
						<CalendarIcon className="size-5 shrink-0 text-primary" aria-hidden />
						<span className="min-w-0 truncate text-base text-foreground leading-snug medium:text-[17px]">
							{selected ? formatDateTimeMediumShortInAppTimeZone(selected) : "Pick date and time"}
						</span>
					</span>
					<ChevronDownIcon
						className={cn(
							"size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
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
								mergeCalendarDay(day);
							}}
							defaultMonth={selected ?? new Date()}
							showOutsideDays
							className="mx-auto rounded-xl bg-muted/20 p-3 [--cell-size:3rem] medium:p-4 medium:[--cell-size:3.5rem]"
							formatters={{
								formatWeekdayName: (date, options) =>
									date.toLocaleDateString(options?.locale?.code ?? "en-IN", { weekday: "narrow" }),
							}}
						/>

						<div className="flex flex-col gap-2 border-border border-t pt-4 dark:border-border/80">
							<Label htmlFor={timeId} className="text-foreground text-sm">
								Time
							</Label>
							<input
								id={timeId}
								type="time"
								step={300}
								disabled={!selected}
								value={timeInputValue}
								onChange={(e) => {
									const raw = e.target.value;
									if (!raw || !selected) return;
									const [hStr, mStr] = raw.split(":");
									const h = Number(hStr);
									const m = Number(mStr);
									if (!Number.isFinite(h) || !Number.isFinite(m)) return;
									const next = new Date(selected);
									next.setHours(h, m, 0, 0);
									setSelected(next);
								}}
								className={cn(
									panelRaisedInputClass,
									"h-12 w-full max-w-full rounded-xl border border-input px-4 font-medium text-foreground text-lg tabular-nums tracking-tight",
									"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
									"disabled:cursor-not-allowed disabled:opacity-45",
								)}
							/>
							<p className="text-muted-foreground text-xs leading-relaxed">
								Choose a date on the calendar first, then set the time (5-minute steps).
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2 border-border border-t pt-4 dark:border-border/80">
							<Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(false)}>
								Done
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="ml-auto border-dashed"
								onClick={() => {
									setSelected(undefined);
									setOpen(false);
								}}
							>
								Clear due date
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
