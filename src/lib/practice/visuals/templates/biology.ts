import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const BIOLOGY_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "biology-pedigree-trait",
		title: "Pedigree trait diagram",
		description: "Pedigree-style biology diagram for inheritance questions.",
		subjects: ["Biology", "Science"],
		topicTags: ["pedigree", "inheritance", "trait", "genetics", "recessive", "dominant"],
		gradeBands: ["9-10", "11-12"],
		kind: "biology_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "labels", "title"],
			optionalSlots: ["notes"],
			constraints: ["Affected and unaffected labels must be visually distinguishable in text and shape."],
		},
		fallbackKind: "data_table",
	}),
	template({
		id: "biology-ecology-flow",
		title: "Biology ecology process",
		description: "Food chain, ecological pyramid, or biological process flow.",
		subjects: ["Biology", "Science"],
		topicTags: ["food chain", "ecology", "ecosystem", "pyramid", "nitrogen cycle", "process"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "biology_diagram",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["subKind", "labels"],
			optionalSlots: ["notes", "title"],
			constraints: ["Energy or material flow direction must be explicit when assessed."],
		},
		fallbackKind: "flowchart",
	}),
];
