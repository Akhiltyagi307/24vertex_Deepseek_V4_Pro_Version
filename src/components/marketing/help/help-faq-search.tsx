"use client";

import * as React from "react";

import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { Input } from "@/components/ui/input";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";

export function HelpFaqSearch() {
	const [query, setQuery] = React.useState("");

	const filtered = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return HELP_FAQ_CATEGORIES;
		return HELP_FAQ_CATEGORIES.map((category) => ({
			...category,
			items: category.items.filter(
				(item) =>
					item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
			),
		})).filter((category) => category.items.length > 0);
	}, [query]);

	return (
		<div className="space-y-10">
			<div className="mx-auto max-w-xl">
				<label htmlFor="help-search" className="sr-only">
					Search questions
				</label>
				<Input
					id="help-search"
					type="search"
					placeholder="Search questions (billing, boards, privacy…)"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="h-11"
				/>
			</div>

			{filtered.length === 0 ? (
				<p className="text-muted-foreground text-center text-sm">No questions match that search.</p>
			) : (
				filtered.map((category) => (
					<section key={category.id} id={category.id} className="space-y-4">
						<h2 className="text-xl font-semibold tracking-tight text-foreground">{category.title}</h2>
						<MarketingFaqAccordion items={category.items} idPrefix={category.id} />
					</section>
				))
			)}
		</div>
	);
}
