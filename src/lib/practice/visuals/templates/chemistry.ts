import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const CHEMISTRY_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "chemistry-galvanic-cell",
		title: "Electrochemical cell",
		description: "Anode, cathode, electrolyte, salt bridge, and electron-flow direction.",
		subjects: ["Chemistry"],
		topicTags: ["galvanic", "electrochemical", "cell", "salt bridge", "electrode", "electron flow"],
		gradeBands: ["11-12"],
		kind: "chemistry_cell_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["anode", "cathode", "electronFlow"],
			optionalSlots: ["saltBridge", "labels"],
			constraints: ["Anode/cathode polarity must match the cell type.", "Do not reveal the answer in labels."],
		},
		fallbackKind: "chemistry_reaction",
	}),
	template({
		id: "chemistry-reaction-conditions",
		title: "Reaction equation with conditions",
		description: "Equation or conversion sequence with reagents and conditions.",
		subjects: ["Chemistry", "Science"],
		topicTags: ["reaction", "equation", "organic", "redox", "equilibrium", "conversion"],
		gradeBands: ["9-10", "11-12"],
		kind: "chemistry_reaction",
		priority: "essential",
		slotContract: {
			requiredSlots: ["equation"],
			optionalSlots: ["conditions", "stateSymbols", "labels"],
			constraints: ["Use mhchem syntax.", "Captions must not reveal a product if prediction is assessed."],
		},
	}),
];
