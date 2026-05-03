"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function isTypingTarget(el: EventTarget | null): boolean {
	if (!el || !(el instanceof HTMLElement)) return false;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if (el.isContentEditable) return true;
	return Boolean(el.closest("[contenteditable='true']"));
}

const SHORTCUT_ROWS: { keys: string; description: string }[] = [
	{ keys: "⌘K / Ctrl+K", description: "Open command palette" },
	{ keys: "?", description: "Open this shortcuts list (when not typing in a field)" },
	{ keys: "Esc", description: "Close dialogs / command palette" },
	{ keys: "j / k", description: "Move row focus in data tables (when table has keyboard focus)" },
	{ keys: "x", description: "Toggle row selection (data tables)" },
	{ keys: "Enter", description: "Activate focused row (data tables)" },
	{ keys: "/", description: "Focus table search where supported" },
];

export function AdminKeyboardShortcuts() {
	const [open, setOpen] = useState(false);

	const onKey = useCallback((e: KeyboardEvent) => {
		if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
		if (isTypingTarget(e.target)) return;
		e.preventDefault();
		setOpen(true);
	}, []);

	useEffect(() => {
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onKey]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-w-md" showCloseButton>
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription>Operator ergonomics for the admin console.</DialogDescription>
				</DialogHeader>
				<ul className="space-y-2 text-sm">
					{SHORTCUT_ROWS.map((row) => (
						<li key={row.keys} className="flex gap-3">
							<kbd className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">{row.keys}</kbd>
							<span className="text-muted-foreground">{row.description}</span>
						</li>
					))}
				</ul>
				<div className="flex justify-end pt-2">
					<Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
