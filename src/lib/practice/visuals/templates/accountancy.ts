import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const ACCOUNTANCY_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "accountancy-ledger-statement",
		title: "Accountancy statement or ledger",
		description: "Journal, ledger, trial balance, balance sheet, P&L, cash book, or rectification table.",
		subjects: ["Accountancy"],
		topicTags: ["journal", "ledger", "trial balance", "balance sheet", "profit and loss", "rectification", "cash book"],
		gradeBands: ["11-12"],
		kind: "accountancy_table",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "rows"],
			optionalSlots: ["totals", "blankCells", "workingNotes"],
			constraints: ["Balanced tables must reconcile.", "Leave blank only the assessed cells."],
		},
	}),
];
