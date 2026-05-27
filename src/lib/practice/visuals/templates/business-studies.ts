import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const BUSINESS_STUDIES_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "business-process-flow",
		title: "Business process flow",
		description: "Management, planning, organizing, staffing, or communication flowchart.",
		subjects: ["Business Studies"],
		topicTags: ["management", "planning", "organising", "staffing", "directing", "controlling", "process"],
		gradeBands: ["11-12"],
		kind: "flowchart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["nodes", "edges"],
			optionalSlots: ["decisionLabels", "outcomes"],
			constraints: ["Node labels must not name the principle if the question assesses identification."],
		},
	}),
];
