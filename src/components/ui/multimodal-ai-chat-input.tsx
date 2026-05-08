"use client";

import { ArrowUp, Square } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	type CSSProperties,
	type FormEvent,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_HEIGHT_PX = 200;

export type TopicChatComposerProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	busy: boolean;
	onStop: () => void;
	placeholder: string;
	/** When false, textarea and send are non-interactive (e.g. paywall). */
	canSend?: boolean;
	id?: string;
	/** When provided, receives the textarea element for parent-driven focus (e.g. suggested prompts). */
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
	className?: string;
	maxHeightPx?: number;
	/** Optional controls to the left of send/stop, same row as the textarea (e.g. mode selector). */
	toolbar?: ReactNode;
};

export function TopicChatComposer({
	value,
	onChange,
	onSubmit,
	busy,
	onStop,
	placeholder,
	canSend = true,
	id: idProp,
	textareaRef: externalTextareaRef,
	className,
	maxHeightPx = DEFAULT_MAX_HEIGHT_PX,
	toolbar,
}: TopicChatComposerProps) {
	const autoId = useId();
	const textareaId = idProp ?? `topic-chat-composer-${autoId}`;
	const innerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	function setTextareaRef(el: HTMLTextAreaElement | null) {
		innerTextareaRef.current = el;
		if (externalTextareaRef) {
			externalTextareaRef.current = el;
		}
	}

	const adjustHeight = useCallback(() => {
		const el = innerTextareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
	}, [maxHeightPx]);

	useEffect(() => {
		adjustHeight();
	}, [value, adjustHeight]);

	const disabled = !canSend || busy;

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key !== "Enter" || e.shiftKey) return;
		if (e.nativeEvent.isComposing) return;
		e.preventDefault();
		const canSubmit = canSend && !busy && value.trim().length > 0;
		if (!canSubmit) return;
		e.currentTarget.form?.requestSubmit();
	}

	return (
		<form onSubmit={onSubmit} className={cn("w-full min-w-0", className)}>
			<div
				className={cn(
					"group/composer rounded-xl border transition-[border-color,box-shadow] duration-200",
					"border-emerald-600/35 bg-muted/30 shadow-[0_1px_0_rgba(0,0,0,0.04)]",
					"dark:border-emerald-400/28 dark:bg-zinc-950/65 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
					"focus-within:border-emerald-500/55 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]",
					"dark:focus-within:border-emerald-400/45 dark:focus-within:shadow-[0_0_0_3px_rgba(52,211,153,0.1)]",
				)}
			>
				<div className="flex min-w-0 flex-col gap-0 px-3 py-2 medium:flex-row medium:items-end medium:gap-2.5 medium:px-3.5 medium:py-2.5">
					<div className="relative min-w-0 w-full medium:flex-1">
						<label htmlFor={textareaId} className="sr-only">
							Message to tutor
						</label>
						<textarea
							id={textareaId}
							ref={setTextareaRef}
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder={placeholder}
							disabled={disabled}
							rows={1}
							data-gramm="false"
							data-gramm_editor="false"
							data-enable-grammarly="false"
							spellCheck
							className={cn(
								"block max-h-[var(--composer-max-h)] min-h-[52px] w-full resize-none bg-transparent py-2 pl-1 pr-1 text-[15px] leading-relaxed medium:py-2.5 medium:pl-1.5",
								"text-foreground placeholder:text-muted-foreground/75",
								"outline-none focus-visible:outline-none",
								"disabled:cursor-not-allowed disabled:opacity-60",
							)}
							style={
								{
									"--composer-max-h": `${maxHeightPx}px`,
								} as CSSProperties
							}
						/>
					</div>

					<div
						className={cn(
							"flex min-w-0 w-full items-center justify-between gap-2 pb-px",
							"medium:w-auto medium:shrink-0 medium:justify-end",
						)}
					>
						<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden medium:flex-initial medium:overflow-visible">
							{toolbar}
						</div>
						{busy ? (
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											type="button"
											size="icon"
											variant="default"
											onClick={() => void onStop()}
											nativeButton
											aria-label="Stop response"
											className={cn(
												"size-10 medium:size-9 shrink-0 rounded-full border transition-[background-color,transform] duration-150",
												"border-emerald-700/35 bg-emerald-600 hover:bg-emerald-600/90 active:scale-[0.97]",
												"dark:border-emerald-500/35 dark:bg-emerald-700 dark:hover:bg-emerald-700/90",
											)}
										>
											<Square className="size-3.5 fill-current" aria-hidden />
										</Button>
									}
								/>
								<TooltipContent>Stop</TooltipContent>
							</Tooltip>
						) : (
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											type="submit"
											size="icon"
											variant="default"
											nativeButton
											aria-label="Send message"
											disabled={!value.trim()}
											className={cn(
												"size-10 medium:size-9 shrink-0 rounded-full font-medium transition-[background-color,transform] duration-150",
												"hover:bg-emerald-600/90 active:scale-[0.97]",
												"disabled:pointer-events-none disabled:opacity-40",
												"focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:outline-none",
											)}
										>
											<ArrowUp className="size-4 text-white/95" strokeWidth={2.5} aria-hidden />
										</Button>
									}
								/>
								<TooltipContent>
									<span>
										<kbd
											data-slot="kbd"
											className="bg-background/15 mr-1 rounded px-1 py-px text-[10px] font-medium"
										>
											Enter
										</kbd>
										Send
									</span>
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				</div>
			</div>
		</form>
	);
}
