"use client";

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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ANY_VALUE = "__any__";

export type ReportsPillSelectOption = {
	value: string;
	label: string;
};

type ReportsPillSelectProps = {
	menuTitle: string;
	ariaLabel: string;
	options: ReportsPillSelectOption[];
	/** URL / state value; use "" for “Any” when that option exists. */
	value: string;
	onValueChange: (next: string) => void;
	icon: LucideIcon;
	className?: string;
};

export function ReportsPillSelect({
	menuTitle,
	ariaLabel,
	options,
	value,
	onValueChange,
	icon: Icon,
	className,
}: ReportsPillSelectProps) {
	const toRadio = (v: string) => (v === "" ? ANY_VALUE : v);
	const fromRadio = (v: string) => (v === ANY_VALUE ? "" : v);

	const radioValue = toRadio(value);
	const selectedLabel =
		options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "—";

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
							"h-8 min-w-[12rem] shrink-0 justify-start gap-1.5 rounded-full border-border px-3 font-normal shadow-none sm:w-56 sm:max-w-[min(100%,18rem)]",
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
				className="min-w-52 max-w-[min(100vw-2rem,20rem)] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="px-2 py-1.5 font-normal text-muted-foreground text-xs">
						{menuTitle}
					</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={radioValue}
						onValueChange={(v) => onValueChange(fromRadio(v))}
					>
						{options.map((opt) => (
							<DropdownMenuRadioItem
								key={opt.value === "" ? ANY_VALUE : opt.value}
								value={toRadio(opt.value)}
								className="cursor-pointer rounded-lg px-2 py-2 pr-8"
							>
								{opt.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
