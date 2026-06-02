"use client";

import type { Editor } from "@tiptap/core";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Underline } from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import {
	BoldIcon,
	Heading2Icon,
	ItalicIcon,
	Link2Icon,
	ListIcon,
	ListOrderedIcon,
	MinusIcon,
	QuoteIcon,
	Redo2Icon,
	SigmaIcon,
	StrikethroughIcon,
	SubscriptIcon,
	SuperscriptIcon,
	TableIcon,
	UnderlineIcon,
	Undo2Icon,
} from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RICH_ANSWER_PURIFY } from "@/lib/practice/rich-answer-purify-config";

function sanitizeRichHtml(html: string): string {
	return DOMPurify.sanitize(html, RICH_ANSWER_PURIFY) as string;
}

/** Plain text or legacy answers → HTML TipTap can load. */
function toInitialEditorHtml(raw: string): string {
	if (!raw.trim()) return "<p></p>";
	const t = raw.trim();
	if (t.startsWith("<")) return sanitizeRichHtml(t);
	const escape = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const paras = raw.split(/\n+/).map((line) => (line ? `<p>${escape(line)}</p>` : "<p></p>"));
	return paras.length ? paras.join("") : "<p></p>";
}

/** Hover-picker for insert table: 6 columns × 8 rows of cells (max 6×8 table). */
const TABLE_PICKER_COLS = 6;
const TABLE_PICKER_ROWS = 8;

function TableInsertGrid({ editor, onInserted }: { editor: Editor; onInserted: () => void }) {
	const [sel, setSel] = React.useState<{ rows: number; cols: number } | null>(null);

	return (
		<div
			className="bg-muted/35 border-border/90 w-full rounded-lg border px-2.5 pb-2.5 pt-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:bg-muted/25 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
			onPointerLeave={() => setSel(null)}
		>
			<div
				className="grid w-fit gap-1"
				style={{ gridTemplateColumns: `repeat(${TABLE_PICKER_COLS}, 1.375rem)` }}
				role="grid"
				aria-label={`Insert table, up to ${TABLE_PICKER_COLS} columns by ${TABLE_PICKER_ROWS} rows`}
			>
				{Array.from({ length: TABLE_PICKER_ROWS }, (_, ri) =>
					Array.from({ length: TABLE_PICKER_COLS }, (_, ci) => {
						const rows = ri + 1;
						const cols = ci + 1;
						const isHighlighted = sel != null && ri < sel.rows && ci < sel.cols;
						return (
							<button
								key={`${ri}-${ci}`}
								type="button"
								className={cn(
									"size-[1.375rem] shrink-0 rounded-[4px] border-2 transition-[background-color,border-color,box-shadow] duration-150",
									"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none",
									isHighlighted ?
										"border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-400 dark:bg-emerald-600"
									:	"border-foreground/28 bg-popover/90 hover:border-foreground/45 hover:bg-muted/80 dark:border-foreground/35 dark:bg-popover/50 dark:hover:border-foreground/55",
								)}
								aria-label={`Insert table with ${cols} columns and ${rows} rows, header row`}
								onPointerEnter={() => setSel({ rows, cols })}
								onFocus={() => setSel({ rows, cols })}
								onClick={() => {
									editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
									onInserted();
									setSel(null);
								}}
							/>
						);
					}),
				)}
			</div>
			<p
				className="text-muted-foreground mt-2.5 min-h-[1.25rem] text-left text-xs leading-snug tabular-nums"
				aria-live="polite"
			>
				{sel ?
					<span className="text-foreground/90 font-medium">
						{sel.cols} × {sel.rows} · header row
					</span>
				:	"Hover or focus cells, then click to insert."}
			</p>
		</div>
	);
}

const MATH_SYMBOLS: { label: string; ch: string }[] = [
	{ label: "Pi", ch: "π" },
	{ label: "Times", ch: "×" },
	{ label: "Divide", ch: "÷" },
	{ label: "Plus-minus", ch: "±" },
	{ label: "Approx", ch: "≈" },
	{ label: "Not equal", ch: "≠" },
	{ label: "leq", ch: "≤" },
	{ label: "geq", ch: "≥" },
	{ label: "Degree", ch: "°" },
	{ label: "Infinity", ch: "∞" },
	{ label: "Sqrt", ch: "√" },
	{ label: "Sum", ch: "∑" },
	{ label: "Integral", ch: "∫" },
	{ label: "Partial", ch: "∂" },
	{ label: "Delta", ch: "Δ" },
	{ label: "Theta", ch: "θ" },
	{ label: "Alpha", ch: "α" },
	{ label: "Beta", ch: "β" },
	{ label: "Lambda", ch: "λ" },
	{ label: "Squared", ch: "²" },
	{ label: "Cubed", ch: "³" },
	{ label: "One half", ch: "½" },
	{ label: "One quarter", ch: "¼" },
	{ label: "Three quarters", ch: "¾" },
	{ label: "Arrow", ch: "→" },
];

/** Stable component (must not be defined inside `Toolbar`) so React does not remount buttons every editor update. */
function RichAnswerToolbarIconButton({
	tooltip,
	label,
	active,
	onClick,
	disabled,
	children,
}: {
	tooltip: string;
	label: string;
	active?: boolean;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={cn(
							"size-7 shrink-0 rounded-md transition-none motion-reduce:transition-none active:translate-y-0",
							// Hover: subdued green (overrides ghost hover); active: brighter fill + ring
							active === true ?
								cn(
									"bg-emerald-500/32 text-emerald-950 ring-1 ring-emerald-600/40",
									"hover:bg-emerald-500/40 hover:ring-emerald-600/50",
									"dark:bg-emerald-400/30 dark:text-emerald-50 dark:ring-emerald-300/50",
									"dark:hover:bg-emerald-400/40 dark:hover:ring-emerald-200/55",
								)
							:	cn(
									"text-foreground hover:bg-emerald-950/[0.09] hover:text-emerald-900",
									"dark:hover:bg-emerald-500/[0.12] dark:hover:text-emerald-100",
								),
						)}
						aria-label={label}
						aria-pressed={active}
						onClick={onClick}
						disabled={disabled}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent side="bottom">{tooltip}</TooltipContent>
		</Tooltip>
	);
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
	const [tablePopoverOpen, setTablePopoverOpen] = React.useState(false);
	const { bold, italic, underline, strike, h2, bullet, ordered, quote, sub, sup, canUndo, canRedo } =
		useEditorState({
			editor,
			selector: ({ editor: e }) => ({
				bold: e.isActive("bold"),
				italic: e.isActive("italic"),
				underline: e.isActive("underline"),
				strike: e.isActive("strike"),
				h2: e.isActive("heading", { level: 2 }),
				bullet: e.isActive("bulletList"),
				ordered: e.isActive("orderedList"),
				quote: e.isActive("blockquote"),
				sub: e.isActive("subscript"),
				sup: e.isActive("superscript"),
				canUndo: e.can().undo(),
				canRedo: e.can().redo(),
			}),
		});

	const popoverTriggerClass = cn(
		buttonVariants({ variant: "ghost", size: "icon-sm" }),
		"size-7 shrink-0 rounded-md transition-none motion-reduce:transition-none active:translate-y-0",
		"text-foreground hover:bg-emerald-950/[0.09] hover:text-emerald-900 dark:hover:bg-emerald-500/[0.12] dark:hover:text-emerald-100",
	);

	return (
		<TooltipProvider delay={450} closeDelay={80}>
			<div
				role="toolbar"
				aria-label="Answer formatting"
				className="border-input bg-muted/30 mb-2 flex shrink-0 flex-wrap items-center gap-0.5 rounded-t-md border-2 border-b-0 px-1 py-1 dark:bg-muted/20"
			>
				<RichAnswerToolbarIconButton
					tooltip="Bold"
					label="Bold"
					active={bold}
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<BoldIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Italic"
					label="Italic"
					active={italic}
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<ItalicIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Underline"
					label="Underline"
					active={underline}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
				>
					<UnderlineIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Strikethrough"
					label="Strikethrough"
					active={strike}
					onClick={() => editor.chain().focus().toggleStrike().run()}
				>
					<StrikethroughIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<Separator orientation="vertical" className="mx-0.5 h-6" />
				<RichAnswerToolbarIconButton
					tooltip="Subscript"
					label="Subscript"
					active={sub}
					onClick={() => editor.chain().focus().toggleSubscript().run()}
				>
					<SubscriptIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Superscript"
					label="Superscript"
					active={sup}
					onClick={() => editor.chain().focus().toggleSuperscript().run()}
				>
					<SuperscriptIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<Separator orientation="vertical" className="mx-0.5 h-6" />
				<RichAnswerToolbarIconButton
					tooltip="Section heading"
					label="Heading"
					active={h2}
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				>
					<Heading2Icon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Bulleted list"
					label="Bullet list"
					active={bullet}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<ListIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Numbered list"
					label="Numbered list"
					active={ordered}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<ListOrderedIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Block quote"
					label="Quote"
					active={quote}
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
				>
					<QuoteIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<RichAnswerToolbarIconButton
					tooltip="Horizontal divider line"
					label="Horizontal rule"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
				>
					<MinusIcon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<Separator orientation="vertical" className="mx-0.5 h-6" />
				<RichAnswerToolbarIconButton tooltip="Insert or edit link" label="Insert link" onClick={onLink}>
					<Link2Icon className="size-3.5" />
				</RichAnswerToolbarIconButton>
				<Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
					<Tooltip>
						<TooltipTrigger
							render={
								<PopoverTrigger
									type="button"
									className={popoverTriggerClass}
									aria-label="Insert or edit table"
								/>
							}
						>
							<TableIcon className="size-3.5" />
						</TooltipTrigger>
						<TooltipContent side="bottom">Insert or edit table</TooltipContent>
					</Tooltip>
					<PopoverContent
						align="start"
						className="flex w-max min-w-[14rem] max-w-[calc(100vw-2rem)] flex-col gap-2 p-3"
					>
						<p className="text-muted-foreground -mb-0.5 px-0.5 text-xs font-medium">Table</p>
						<TableInsertGrid editor={editor} onInserted={() => setTablePopoverOpen(false)} />
						<Separator className="bg-border/80 my-1" />
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							disabled={!editor.can().addColumnAfter()}
							onClick={() => editor.chain().focus().addColumnAfter().run()}
						>
							Add column after
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							disabled={!editor.can().addRowAfter()}
							onClick={() => editor.chain().focus().addRowAfter().run()}
						>
							Add row below
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							disabled={!editor.can().deleteColumn()}
							onClick={() => editor.chain().focus().deleteColumn().run()}
						>
							Delete column
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							disabled={!editor.can().deleteRow()}
							onClick={() => editor.chain().focus().deleteRow().run()}
						>
							Delete row
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs text-destructive"
							disabled={!editor.can().deleteTable()}
							onClick={() => editor.chain().focus().deleteTable().run()}
						>
							Delete table
						</Button>
					</PopoverContent>
			</Popover>
			<Popover>
				<Tooltip>
					<TooltipTrigger
						render={
							<PopoverTrigger
								type="button"
								className={popoverTriggerClass}
								aria-label="Math and symbols"
							/>
						}
					>
						<SigmaIcon className="size-3.5" />
					</TooltipTrigger>
					<TooltipContent side="bottom">Insert math symbols</TooltipContent>
				</Tooltip>
				<PopoverContent align="start" className="w-[min(100vw-2rem,20rem)] p-2">
					<p className="text-muted-foreground mb-2 px-1 text-xs font-medium">Insert symbol</p>
					<div className="grid max-h-[14rem] grid-cols-4 gap-1 overflow-y-auto">
						{MATH_SYMBOLS.map((s) => (
							<Button
								key={s.ch + s.label}
								type="button"
								variant="outline"
								size="sm"
								className="h-9 font-mono text-base"
								title={s.label}
								onClick={() => editor.chain().focus().insertContent(s.ch).run()}
							>
								{s.ch}
							</Button>
						))}
					</div>
				</PopoverContent>
			</Popover>
			<Separator orientation="vertical" className="mx-0.5 h-6" />
			<RichAnswerToolbarIconButton
				tooltip="Undo last change"
				label="Undo"
				disabled={!canUndo}
				onClick={() => editor.chain().focus().undo().run()}
			>
				<Undo2Icon className="size-3.5" />
			</RichAnswerToolbarIconButton>
			<RichAnswerToolbarIconButton
				tooltip="Redo"
				label="Redo"
				disabled={!canRedo}
				onClick={() => editor.chain().focus().redo().run()}
			>
				<Redo2Icon className="size-3.5" />
			</RichAnswerToolbarIconButton>
			</div>
		</TooltipProvider>
	);
}

export type PracticeRichAnswerEditorProps = {
	value: string;
	onChange: (html: string) => void;
	placeholder: string;
	variant: "short" | "long";
	softCap: number;
	hardCap?: number;
};

export function PracticeRichAnswerEditor({
	value,
	onChange,
	placeholder,
	variant,
	softCap,
	hardCap = 16_000,
}: PracticeRichAnswerEditorProps) {
	const [plainLen, setPlainLen] = React.useState(0);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				link: false,
				code: false,
				codeBlock: false,
			}),
			LinkExtension.configure({
				openOnClick: false,
				autolink: true,
				defaultProtocol: "https",
				HTMLAttributes: {
					rel: "noopener noreferrer",
					target: "_blank",
				},
			}),
			Subscript,
			Superscript,
			Underline,
			Table.configure({
				resizable: false,
				HTMLAttributes: { class: "border-collapse border border-foreground/20 w-full my-2" },
			}),
			TableRow,
			TableHeader.configure({
				HTMLAttributes: { class: "border border-foreground/25 bg-muted/50 px-2 py-1.5 text-left font-semibold" },
			}),
			TableCell.configure({
				HTMLAttributes: { class: "border border-foreground/20 px-2 py-1.5 align-top" },
			}),
			Placeholder.configure({ placeholder }),
		],
		content: toInitialEditorHtml(value),
		editorProps: {
			attributes: {
				"data-practice-answer-field": "true",
				spellcheck: "true",
				"data-gramm": "false",
				"data-gramm_editor": "false",
				"data-enable-grammarly": "false",
				class: cn(
					"tiptap max-w-none h-full min-h-0 overflow-y-auto px-3 py-2 text-sm leading-relaxed focus:outline-none",
					variant === "long" ? "min-h-[8rem]" : "min-h-[4.5rem]",
					"[&_p]:my-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold",
					"[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
					"[&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic",
					"[&_a]:text-emerald-600 [&_a]:underline dark:[&_a]:text-emerald-400",
				),
			},
		},
		onCreate: ({ editor: e }) => {
			setPlainLen(e.getText().length);
		},
		onUpdate: ({ editor: e }) => {
			let html = sanitizeRichHtml(e.getHTML());
			if (e.isEmpty) {
				html = "";
			}
			if (html.length > hardCap) {
				while (html.length > hardCap && e.can().undo()) {
					e.chain().undo().run();
					html = e.isEmpty ? "" : sanitizeRichHtml(e.getHTML());
				}
				if (html.length > hardCap) {
					return;
				}
			}
			setPlainLen(e.getText().length);
			onChange(html);
		},
	});

	const onLink = React.useCallback(() => {
		if (!editor) return;
		const prev = editor.getAttributes("link").href as string | undefined;
		const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
		if (url === null) return;
		const u = url.trim();
		if (!u) {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href: u }).run();
	}, [editor]);

	const overSoft = plainLen > softCap;

	if (!editor) {
		return (
			<div
				className={cn(
					"border-input bg-background flex min-h-0 flex-1 animate-pulse rounded-md border-2",
					variant === "long" ? "min-h-[10rem]" : "min-h-[6rem]",
				)}
				aria-hidden
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex w-full shrink-0 flex-col",
				variant === "long" ? "min-h-[min(40dvh,18rem)]" : "min-h-[min(32dvh,12rem)]",
			)}
			data-rich-answer-editor
		>
			<Toolbar editor={editor} onLink={onLink} />
			<EditorContent
				editor={editor}
				className={cn(
					"border-input bg-background text-foreground ring-offset-background",
					"flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-md rounded-t-none border-2 border-t-0",
					"[&_.tiptap]:h-full [&_.tiptap]:min-h-0",
					"focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
				)}
			/>
			<p
				className={cn(
					"text-muted-foreground mt-1.5 shrink-0 text-xs tabular-nums",
					overSoft ? "text-amber-800 dark:text-amber-300" : null,
				)}
			>
				{plainLen}/{softCap}
				{overSoft ?
					` · formatted answers use more storage; max ${hardCap.toLocaleString()} characters when saved`
				:	null}
			</p>
		</div>
	);
}
