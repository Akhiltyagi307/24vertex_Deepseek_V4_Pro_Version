"use client";

import { ChevronDownIcon } from "lucide-react";

import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { practiceSolidCtaClassName } from "./types";

export type WizardFooterProps = {
	step: number;
	pending: boolean;
	generating: boolean;
	isResultStep: boolean;
	isSubmitStep: boolean;
	showPromptPreview: boolean;
	subjectId: string | null;
	canPickEnoughTopics: boolean;
	hasGeneratedPreview: boolean;
	onBack: () => void;
	onContinue: () => void;
	onGenerate: () => void;
};

export function WizardFooter({
	step,
	pending,
	generating,
	isResultStep,
	isSubmitStep,
	showPromptPreview,
	subjectId,
	canPickEnoughTopics,
	hasGeneratedPreview,
	onBack,
	onContinue,
	onGenerate,
}: WizardFooterProps) {
	if (!isResultStep) {
		return (
			<div className="flex shrink-0 flex-col gap-3 medium:flex-row medium:flex-wrap medium:items-center">
				{step > 0 ? (
					<Button
						type="button"
						variant="ghost"
						className="order-2 h-11 min-h-11 w-full px-5 text-base text-muted-foreground hover:text-foreground medium:order-1 medium:mr-auto medium:w-auto medium:min-w-32"
						onClick={onBack}
						disabled={pending}
					>
						<ChevronDownIcon
							className="mr-1.5 size-4 rotate-90"
							aria-hidden
							strokeWidth={2}
						/>
						Back
					</Button>
				) : null}
				{isSubmitStep ? (
					<div className="order-1 w-full medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52">
						<SubmitButton
							label="Save configuration"
							pendingLabel="Working…"
							busy={pending}
							className={cn(
								"h-11 min-h-11 px-6 text-base",
								practiceSolidCtaClassName,
							)}
						/>
					</div>
				) : step === 2 && showPromptPreview ? (
					<Button
						type="button"
						className={cn(
							"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
							practiceSolidCtaClassName,
						)}
						variant="default"
						disabled={pending}
						onClick={onContinue}
					>
						{pending ? "Working…" : "Build prompt preview"}
					</Button>
				) : (
					<Button
						type="button"
						className={cn(
							"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
							practiceSolidCtaClassName,
						)}
						variant="default"
						onClick={onContinue}
						disabled={(step === 0 && !subjectId) || (step === 1 && !canPickEnoughTopics)}
					>
						Continue
					</Button>
				)}
			</div>
		);
	}

	if (!hasGeneratedPreview) {
		return (
			<div className="flex shrink-0 flex-col gap-3 medium:flex-row medium:flex-wrap medium:items-center">
				<Button
					type="button"
					variant="ghost"
					className="order-3 h-11 min-h-11 w-full px-5 text-base text-muted-foreground hover:text-foreground medium:order-1 medium:mr-auto medium:w-auto medium:min-w-32"
					onClick={onBack}
					disabled={pending || generating}
				>
					<ChevronDownIcon className="mr-1.5 size-4 rotate-90" aria-hidden strokeWidth={2} />
					Back
				</Button>
				<Button
					type="button"
					className={cn(
						"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
						practiceSolidCtaClassName,
					)}
					onClick={onGenerate}
					disabled={pending || generating}
				>
					{generating ? "Generating…" : "Generate practice test"}
				</Button>
			</div>
		);
	}

	return null;
}
