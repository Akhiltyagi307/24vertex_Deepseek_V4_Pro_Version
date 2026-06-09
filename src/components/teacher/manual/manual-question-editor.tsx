"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { ManualTopicPicker } from "@/components/teacher/manual/manual-topic-picker";
import { NativeSelect } from "@/components/ui/native-select";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import { cn } from "@/lib/utils";

export type ManualQuestionType =
	| "multiple_choice"
	| "fill_in_blank"
	| "numerical"
	| "short_answer"
	| "long_answer";

/** Loose client-side draft; the builder maps it to the server payload on submit. */
export type ManualQuestionDraft = {
	id: string;
	questionType: ManualQuestionType;
	topicId: string;
	questionText: string;
	difficultyLevel: "easy" | "medium" | "hard";
	options: string[];
	correctIndex: number;
	correctAnswer: string;
	acceptableVariants: string;
	tolerance: string;
	units: string;
	modelAnswer: string;
	markingPoints: string;
};

export function emptyManualQuestionDraft(id: string): ManualQuestionDraft {
	return {
		id,
		questionType: "multiple_choice",
		topicId: "",
		questionText: "",
		difficultyLevel: "medium",
		options: ["", ""],
		correctIndex: 0,
		correctAnswer: "",
		acceptableVariants: "",
		tolerance: "",
		units: "",
		modelAnswer: "",
		markingPoints: "",
	};
}

const TYPE_LABELS: Record<ManualQuestionType, string> = {
	multiple_choice: "Multiple choice",
	fill_in_blank: "Fill in the blank",
	numerical: "Numerical",
	short_answer: "Short answer",
	long_answer: "Long answer",
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const inputClass =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

export function ManualQuestionEditor({
	index,
	draft,
	topics,
	onChange,
	onRemove,
}: {
	index: number;
	draft: ManualQuestionDraft;
	topics: AssignmentTopicCatalogRow[];
	onChange: (next: ManualQuestionDraft) => void;
	onRemove: () => void;
}) {
	const set = <K extends keyof ManualQuestionDraft>(key: K, val: ManualQuestionDraft[K]) =>
		onChange({ ...draft, [key]: val });

	const isOpenEnded = draft.questionType === "short_answer" || draft.questionType === "long_answer";

	return (
		<div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<span className="font-medium text-foreground text-sm">Question {index + 1}</span>
				<button
					type="button"
					onClick={onRemove}
					className="inline-flex items-center gap-1 text-destructive text-xs hover:underline"
				>
					<Trash2 className="size-3.5" /> Remove
				</button>
			</div>

			<div className="grid gap-3 medium:grid-cols-2">
				<label className="block space-y-1">
					<span className="text-foreground text-xs">Type</span>
					<NativeSelect
						value={draft.questionType}
						onChange={(e) => set("questionType", e.target.value as ManualQuestionType)}
						className="rounded-lg border border-input"
					>
						{(Object.keys(TYPE_LABELS) as ManualQuestionType[]).map((t) => (
							<option key={t} value={t}>
								{TYPE_LABELS[t]}
							</option>
						))}
					</NativeSelect>
				</label>
				<label className="block space-y-1">
					<span className="text-foreground text-xs">Chapter &amp; topic</span>
					<ManualTopicPicker topics={topics} value={draft.topicId} onChange={(id) => set("topicId", id)} />
				</label>
			</div>

			<label className="block space-y-1">
				<span className="text-foreground text-xs">Question (use $…$ for math)</span>
				<textarea
					rows={2}
					value={draft.questionText}
					onChange={(e) => set("questionText", e.target.value)}
					className={cn(inputClass, "resize-y")}
					placeholder="Write the question stem"
				/>
			</label>

			{draft.questionType === "multiple_choice" ? (
				<div className="space-y-2">
					<span className="text-foreground text-xs">Options (select the correct one)</span>
					{draft.options.map((opt, i) => (
						<div key={i} className="flex items-center gap-2">
							<input
								type="radio"
								name={`correct-${draft.id}`}
								checked={draft.correctIndex === i}
								onChange={() => set("correctIndex", i)}
								className="size-4"
								aria-label={`Mark option ${LETTERS[i]} correct`}
							/>
							<span className="w-5 text-muted-foreground text-xs">{LETTERS[i]}</span>
							<input
								value={opt}
								onChange={(e) => {
									const next = [...draft.options];
									next[i] = e.target.value;
									set("options", next);
								}}
								className={inputClass}
								placeholder={`Option ${LETTERS[i]}`}
							/>
							{draft.options.length > 2 ? (
								<button
									type="button"
									onClick={() => {
										const next = draft.options.filter((_, j) => j !== i);
										onChange({
											...draft,
											options: next,
											correctIndex: Math.min(draft.correctIndex, next.length - 1),
										});
									}}
									className="text-muted-foreground text-xs hover:text-destructive"
									aria-label={`Remove option ${LETTERS[i]}`}
								>
									✕
								</button>
							) : null}
						</div>
					))}
					{draft.options.length < 6 ? (
						<button
							type="button"
							onClick={() => set("options", [...draft.options, ""])}
							className="text-link text-xs hover:underline"
						>
							+ Add option
						</button>
					) : null}
				</div>
			) : null}

			{draft.questionType === "fill_in_blank" || draft.questionType === "numerical" ? (
				<div className="grid gap-3 medium:grid-cols-2">
					<label className="block space-y-1">
						<span className="text-foreground text-xs">Correct answer</span>
						<input
							value={draft.correctAnswer}
							onChange={(e) => set("correctAnswer", e.target.value)}
							className={inputClass}
							placeholder={draft.questionType === "numerical" ? "e.g. 9.8" : "e.g. photosynthesis"}
						/>
					</label>
					{draft.questionType === "numerical" ? (
						<div className="grid grid-cols-2 gap-2">
							<label className="block space-y-1">
								<span className="text-foreground text-xs">± Tolerance</span>
								<input
									value={draft.tolerance}
									onChange={(e) => set("tolerance", e.target.value)}
									className={inputClass}
									placeholder="0.1"
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-foreground text-xs">Units</span>
								<input
									value={draft.units}
									onChange={(e) => set("units", e.target.value)}
									className={inputClass}
									placeholder="m/s²"
								/>
							</label>
						</div>
					) : (
						<label className="block space-y-1">
							<span className="text-foreground text-xs">Accepted variants (one per line)</span>
							<textarea
								rows={2}
								value={draft.acceptableVariants}
								onChange={(e) => set("acceptableVariants", e.target.value)}
								className={cn(inputClass, "resize-y")}
							/>
						</label>
					)}
				</div>
			) : null}

			{isOpenEnded ? (
				<div className="space-y-3">
					<label className="block space-y-1">
						<span className="text-foreground text-xs">Model answer (optional)</span>
						<textarea
							rows={2}
							value={draft.modelAnswer}
							onChange={(e) => set("modelAnswer", e.target.value)}
							className={cn(inputClass, "resize-y")}
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-foreground text-xs">
							Marking points (one per line — improves AI grading)
						</span>
						<textarea
							rows={3}
							value={draft.markingPoints}
							onChange={(e) => set("markingPoints", e.target.value)}
							className={cn(inputClass, "resize-y")}
							placeholder={"States the definition\nGives a correct example"}
						/>
					</label>
				</div>
			) : null}

			<label className="block space-y-1">
				<span className="text-foreground text-xs">Difficulty</span>
				<NativeSelect
					value={draft.difficultyLevel}
					onChange={(e) => set("difficultyLevel", e.target.value as ManualQuestionDraft["difficultyLevel"])}
					className="max-w-40 rounded-lg border border-input"
				>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</NativeSelect>
			</label>
		</div>
	);
}
