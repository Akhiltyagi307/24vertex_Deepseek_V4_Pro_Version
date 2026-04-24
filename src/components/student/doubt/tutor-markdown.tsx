"use client";

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders tutor output as rich markdown. The content is model-generated (not
 * user-authored) but we still skip raw HTML via `skipHtml` to keep the surface
 * area narrow, and style every node to match the product tone.
 */
function TutorMarkdownImpl({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	const components: Components = useMemo(
		() => ({
			h1: ({ children: c, id }) => (
				<h3
					id={id}
					className="text-foreground mt-5 mb-2 text-[17px] font-semibold tracking-tight first:mt-0"
				>
					{c}
				</h3>
			),
			h2: ({ children: c, id }) => (
				<h4
					id={id}
					className="text-foreground mt-5 mb-2 text-[15px] font-semibold tracking-tight first:mt-0"
				>
					{c}
				</h4>
			),
			h3: ({ children: c, id }) => (
				<h5
					id={id}
					className="text-foreground mt-4 mb-1.5 text-[14px] font-semibold tracking-tight first:mt-0"
				>
					{c}
				</h5>
			),
			h4: ({ children: c, id }) => (
				<h6
					id={id}
					className="text-foreground mt-3 mb-1 text-[13px] font-semibold tracking-tight first:mt-0"
				>
					{c}
				</h6>
			),
			p: ({ children: c }) => (
				<p className="text-foreground/90 my-2 text-[15px] leading-[1.65] [text-wrap:pretty] first:mt-0 last:mb-0">
					{c}
				</p>
			),
			ul: ({ children: c }) => (
				<ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{c}</ul>
			),
			ol: ({ children: c, start }) => (
				<ol
					start={start}
					className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0"
				>
					{c}
				</ol>
			),
			li: ({ children: c }) => (
				<li className="text-foreground/90 text-[15px] leading-[1.6] marker:text-muted-foreground/70">
					{c}
				</li>
			),
			strong: ({ children: c }) => (
				<strong className="text-foreground font-semibold">{c}</strong>
			),
			em: ({ children: c }) => <em className="italic">{c}</em>,
			a: ({ children: c, href }) => (
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className="text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
				>
					{c}
				</a>
			),
			blockquote: ({ children: c }) => (
				<blockquote className="text-muted-foreground border-border/70 my-3 border-l-2 pl-3 italic">
					{c}
				</blockquote>
			),
			hr: () => <hr className="border-border/60 my-4" />,
			code: ({ children: c, className: cls }) => {
				const isBlock = /language-/.test(cls ?? "");
				if (isBlock) {
					return (
						<code className={cn("font-mono text-[13px] leading-[1.55]", cls)}>{c}</code>
					);
				}
				return (
					<code className="bg-muted/70 text-foreground rounded-[4px] px-1 py-[1px] font-mono text-[12.5px]">
						{c}
					</code>
				);
			},
			pre: ({ children: c }) => (
				<pre className="border-border/60 bg-muted/50 my-3 overflow-x-auto rounded-lg border p-3">
					{c}
				</pre>
			),
			table: ({ children: c }) => (
				<div className="my-3 overflow-x-auto">
					<table className="w-full border-collapse text-[13.5px]">{c}</table>
				</div>
			),
			thead: ({ children: c }) => (
				<thead className="border-border/70 border-b">{c}</thead>
			),
			th: ({ children: c }) => (
				<th className="text-muted-foreground px-2 py-1.5 text-left font-medium">{c}</th>
			),
			td: ({ children: c }) => (
				<td className="border-border/40 border-t px-2 py-1.5 align-top">{c}</td>
			),
		}),
		[],
	);

	return (
		<div
			className={cn(
				"min-w-0 tabular-nums [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
		>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
				{children}
			</ReactMarkdown>
		</div>
	);
}

export const TutorMarkdown = memo(TutorMarkdownImpl);
