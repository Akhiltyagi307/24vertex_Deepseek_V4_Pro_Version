"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TopicChatComposer } from "@/components/ui/multimodal-ai-chat-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";

import type { UsageSummary } from "./types";

export type ChatComposerProps = {
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	input: string;
	onInputChange: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	onStop: () => void;
	busy: boolean;
	placeholder: string;
	tutorMode: DoubtTutorMode;
	onTutorModeChange: (mode: DoubtTutorMode) => void;
	usage: UsageSummary;
	error: Error | null;
};

export function ChatComposer({
	textareaRef,
	input,
	onInputChange,
	onSubmit,
	onStop,
	busy,
	placeholder,
	tutorMode,
	onTutorModeChange,
	usage,
	error,
}: ChatComposerProps) {
	return (
		<div className="shrink-0 px-4 pt-1 pb-4 medium:px-6">
			<div className="mx-auto w-full min-w-0 max-w-full">
				{error ? (
					<Alert variant="destructive" className="mb-3 w-full min-w-0 rounded-xl">
						<AlertTitle>Something went wrong</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}

				<TopicChatComposer
					id="doubt-chat-composer"
					textareaRef={textareaRef}
					value={input}
					onChange={onInputChange}
					onSubmit={onSubmit}
					busy={busy}
					onStop={onStop}
					placeholder={placeholder}
					toolbar={
						<div className="flex min-w-0 flex-nowrap items-center gap-2">
							<span className="text-muted-foreground shrink-0 text-[12px] font-medium">
								Mode
							</span>
							<Select
								value={tutorMode}
								onValueChange={(v) => onTutorModeChange(v as DoubtTutorMode)}
								disabled={busy}
							>
								<SelectTrigger
									id="doubt-tutor-mode"
									aria-label="Tutor mode"
									className="border-input bg-background h-9 min-w-0 max-w-[10.5rem] shrink medium:min-w-[9.5rem] medium:max-w-[14rem]"
								>
									<SelectValue placeholder="Explain">
										{(v) => (v === "solve_with_me" ? "Solve with me" : "Explain")}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="explain">Explain</SelectItem>
									<SelectItem value="solve_with_me">Solve with me</SelectItem>
								</SelectContent>
							</Select>
						</div>
					}
				/>

				<div className="text-muted-foreground/80 mt-2.5 flex w-full min-w-0 items-center justify-between gap-3 text-[11px] leading-snug">
					<span className="min-w-0 truncate">
						Tutor can be wrong; double-check important facts.
					</span>
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									className="hover:text-foreground flex shrink-0 cursor-help items-center gap-1 tabular-nums transition-colors focus-visible:outline-none"
								/>
							}
						>
							<span>
								{usage.lastPromptTokens != null ? usage.lastPromptTokens : "—"} in ·{" "}
								{usage.lastCompletionTokens != null ? usage.lastCompletionTokens : "—"} out
							</span>
						</TooltipTrigger>
						<TooltipContent>
							<span className="tabular-nums">
								Session: {usage.totalPromptTokens} in / {usage.totalCompletionTokens} out
							</span>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}
