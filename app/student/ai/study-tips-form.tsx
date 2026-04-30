"use client";

import { useState, useTransition } from "react";

import { requestStudyTipsJson } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function StudyTipsForm() {
	const [topic, setTopic] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [headline, setHeadline] = useState<string | null>(null);
	const [tips, setTips] = useState<string[] | null>(null);
	const [isPending, startTransition] = useTransition();

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setFieldError(null);
		setHeadline(null);
		setTips(null);

		startTransition(async () => {
			const result = await requestStudyTipsJson({ topic: topic.trim() });
			if (!result.ok) {
				if (result.code === "validation_error" && result.fieldErrors?.topic?.[0]) {
					setFieldError(result.fieldErrors.topic[0]);
				} else {
					setError(result.message);
				}
				return;
			}
			setHeadline(result.headline);
			setTips(result.tips);
		});
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-6">
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<Field>
					<FieldLabel htmlFor="study-topic">Topic or goal</FieldLabel>
					<Input
						id="study-topic"
						name="topic"
						value={topic}
						onChange={(ev) => setTopic(ev.target.value)}
						placeholder="e.g. Quadratic equations for class 10"
						disabled={isPending}
						autoComplete="off"
					/>
					{fieldError ? (
						<p className="text-destructive text-sm font-medium">{fieldError}</p>
					) : null}
				</Field>
				<Button type="submit" disabled={isPending}>
					{isPending ? "Getting tips…" : "Get study tips"}
				</Button>
			</form>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Something went wrong</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{headline && tips ? (
				<Alert>
					<AlertTitle>{headline}</AlertTitle>
					<AlertDescription>
						<ul className="mt-2 list-inside list-disc space-y-1">
							{tips.map((t, i) => (
								<li key={`${i}-${t.slice(0, 32)}`}>{t}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			) : null}
		</div>
	);
}
