"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ANY_VALUE = "__any__";

export type ReportsPillSelectOption = {
	value: string;
	label: string;
};

export type ReportsPillSelectOptionGroup = {
	heading: string;
	options: ReportsPillSelectOption[];
};

type ReportsPillSelectProps = {
	menuTitle: string;
	ariaLabel: string;
	options: ReportsPillSelectOption[];
	/** When set, renders grade/stream headings between subject rows (options still drives the trigger label). */
	optionGroups?: ReportsPillSelectOptionGroup[];
	/** URL / state value; use "" for “Any” when that option exists. */
	value: string;
	onValueChange: (next: string) => void;
	icon: LucideIcon;
	className?: string;
	/**
	 * Stretch the trigger to the parent width (e.g. stacked filters in a fixed column).
	 * Default keeps a compact pill (`min-w` / `medium:w-56`) for horizontal filter bars.
	 */
	fullWidth?: boolean;
	/** Wider scrollable panel for long subject lists (teacher scope filters). */
	menuWide?: boolean;
};

export function ReportsPillSelect({
	menuTitle,
	ariaLabel,
	options,
	optionGroups,
	value,
	onValueChange,
	icon: Icon,
	className,
	fullWidth = false,
	menuWide = false,
}: ReportsPillSelectProps) {
	const toRadio = (v: string) => (v === "" ? ANY_VALUE : v);
	const fromRadio = (v: string) => (v === ANY_VALUE ? "" : v);

	const radioValue = toRadio(value);
	const selectedLabel =
		options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "—";

	const leadingOptions = options.filter((o) => o.value === "");
	const grouped = optionGroups != null && optionGroups.length > 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={ariaLabel}
				render={
					<Button
						type="button"
						variant="outline"
						size="sm"
						className={cn(
							"h-8 justify-start gap-1.5 rounded-full border-border px-3 font-normal shadow-none",
							fullWidth ?
								"w-full min-w-0 shrink"
							:	"min-w-[12rem] shrink-0 medium:w-56 medium:max-w-[min(100%,18rem)]",
							menuWide && fullWidth && "medium:min-w-[16rem]",
							"[&_svg]:text-emerald-700 dark:[&_svg]:text-emerald-400",
							"hover:[&_svg]:text-white data-[popup-open]:[&_svg]:text-white",
							"[&_span]:text-emerald-900 dark:[&_span]:text-emerald-200",
							"hover:[&_span]:text-white data-[popup-open]:[&_span]:text-white",
							className,
						)}
					/>
				}
			>
				<Icon className="size-3.5 shrink-0" aria-hidden />
				<span className="min-w-0 flex-1 truncate text-left font-medium">{selectedLabel}</span>
				<ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				className={cn(
					"rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
					menuWide ?
						"min-w-[min(100vw-2rem,22rem)] max-w-[min(100vw-2rem,36rem)] max-h-[min(70vh,28rem)] overflow-y-auto"
					:	"min-w-52 max-w-[min(100vw-2rem,20rem)]",
				)}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="px-2 py-1.5 font-normal text-muted-foreground text-xs">
						{menuTitle}
					</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={radioValue}
						onValueChange={(v) => onValueChange(fromRadio(v))}
					>
						{grouped ?
							<>
								{leadingOptions.map((opt) => (
									<DropdownMenuRadioItem
										key={ANY_VALUE}
										value={toRadio(opt.value)}
										className="cursor-pointer rounded-lg px-2 py-2 pr-8 text-sm"
									>
										{opt.label}
									</DropdownMenuRadioItem>
								))}
								{optionGroups.map((group) => (
									<Fragment key={group.heading}>
										<DropdownMenuSeparator className="my-1.5" />
										<DropdownMenuLabel className="px-2 py-1 font-medium text-foreground text-xs">
											{group.heading}
										</DropdownMenuLabel>
										{group.options.map((opt) => (
											<DropdownMenuRadioItem
												key={opt.value}
												value={toRadio(opt.value)}
												className={cn(
													"cursor-pointer rounded-lg px-2 py-2 pr-8 text-sm leading-snug",
													menuWide && "whitespace-normal text-pretty",
												)}
											>
												{opt.label}
											</DropdownMenuRadioItem>
										))}
									</Fragment>
								))}
							</>
						:	options.map((opt) => (
								<DropdownMenuRadioItem
									key={opt.value === "" ? ANY_VALUE : opt.value}
									value={toRadio(opt.value)}
									className={cn(
										"cursor-pointer rounded-lg px-2 py-2 pr-8",
										menuWide && "whitespace-normal text-pretty text-sm leading-snug",
									)}
								>
									{opt.label}
								</DropdownMenuRadioItem>
							))
						}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
