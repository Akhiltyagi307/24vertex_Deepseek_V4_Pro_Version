"use client";

import { Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
import { useId } from "react";

import { accountReadonlyInputClass } from "../_settings-form-styles";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AccountFieldEditButton({
	tooltipContent,
	ariaLabel,
	onClick,
}: {
	tooltipContent: string;
	ariaLabel: string;
	onClick?: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={onClick}
						className={cn(
							"rounded-md p-1.5",
							"text-muted-foreground transition-colors",
							"hover:bg-muted/80 hover:text-foreground",
							"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
						)}
						aria-label={ariaLabel}
					>
						<Pencil className="size-4" />
					</button>
				}
			/>
			<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
				{tooltipContent}
			</TooltipContent>
		</Tooltip>
	);
}

export function AccountReadonlyField({
	label,
	value,
	schoolManaged,
	onSchoolPlacementEdit,
	placementEditTooltip,
	placementEditAriaLabel,
	lockedFieldHint,
	description,
	className,
}: {
	label: string;
	value: string;
	schoolManaged?: boolean;
	/** Opens the school placement editor for this row. */
	onSchoolPlacementEdit?: () => void;
	placementEditTooltip?: string;
	placementEditAriaLabel?: string;
	/** Shows the same pencil affordance with this message (non–school-managed fields). */
	lockedFieldHint?: string;
	/** Muted helper below the field (no edit affordance). */
	description?: string;
	className?: string;
}) {
	const id = useId();
	const showSchoolEdit = Boolean(schoolManaged);
	const showLockedEdit = Boolean(lockedFieldHint) && !schoolManaged;
	const trailing = showSchoolEdit ? (
		<div className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2">
			<AccountFieldEditButton
				tooltipContent={
					onSchoolPlacementEdit
						? (placementEditTooltip ?? "Edit this field.")
						: "Set by your school. It cannot be edited here."
				}
				ariaLabel={
					onSchoolPlacementEdit
						? (placementEditAriaLabel ?? "Edit placement")
						: "School-managed field. Cannot be changed in EduAI."
				}
				onClick={onSchoolPlacementEdit}
			/>
		</div>
	) : showLockedEdit ? (
		<div className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2">
			<AccountFieldEditButton
				tooltipContent={lockedFieldHint!}
				ariaLabel="This field cannot be edited in EduAI."
			/>
		</div>
	) : null;

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<label htmlFor={id} className="text-foreground/70 text-sm font-medium leading-snug">
				{label}
			</label>
			<div className="relative">
				<Input
					id={id}
					readOnly
					value={value}
					className={cn(
						accountReadonlyInputClass,
						"font-medium text-foreground",
						trailing ? "pr-11" : "pr-3",
						description && !trailing && "cursor-default",
					)}
				/>
				{trailing}
			</div>
			{description ? (
				<p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">{description}</p>
			) : null}
		</div>
	);
}

export function LoginEmailField({
	email,
	isVerified,
}: {
	email: string;
	isVerified: boolean | null;
}) {
	const id = useId();
	const verificationAffordance =
		isVerified === true ? (
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"rounded-md p-1.5",
								"text-emerald-600 transition-colors dark:text-emerald-400",
								"hover:bg-muted/80",
								"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
							)}
							aria-label="Verified account"
						>
							<ShieldCheck className="size-4" aria-hidden />
						</button>
					}
				/>
				<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
					Verified account
				</TooltipContent>
			</Tooltip>
		) : isVerified === false ? (
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"rounded-md p-1.5",
								"text-amber-600 transition-colors dark:text-amber-500",
								"hover:bg-muted/80",
								"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
							)}
							aria-label="Verification pending"
						>
							<ShieldAlert className="size-4" aria-hidden />
						</button>
					}
				/>
				<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
					Verification pending
				</TooltipContent>
			</Tooltip>
		) : null;

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="text-foreground/70 text-sm font-medium leading-snug">
				Login email
			</label>
			<div className="relative">
				<Input
					id={id}
					readOnly
					value={email || "—"}
					className={cn(
						accountReadonlyInputClass,
						"font-medium text-foreground",
						verificationAffordance ? "pr-[5.25rem]" : "pr-11",
					)}
				/>
				<div className="absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-0.5">
					{verificationAffordance}
					<AccountFieldEditButton
						tooltipContent="Your login email is tied to your sign-in and cannot be changed here."
						ariaLabel="Login email cannot be edited in EduAI."
					/>
				</div>
			</div>
		</div>
	);
}

export const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 medium:p-5";
