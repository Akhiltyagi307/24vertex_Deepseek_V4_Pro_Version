import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const PHYSICS_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "physics-circuit-measurement",
		title: "Circuit measurement",
		description: "Board-style circuit with battery, resistor/bulb, switch, ammeter, and voltmeter.",
		subjects: ["Physics", "Science"],
		topicTags: ["circuit", "current", "voltage", "resistance", "ohm", "electricity"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["components", "connections", "battery"],
			optionalSlots: ["currentArrow", "polarityMarks", "componentValues"],
			constraints: ["Ammeter must be in series.", "Voltmeter must be parallel to the measured component."],
		},
	}),
	template({
		id: "physics-electric-field-lines",
		title: "Electric or magnetic field lines",
		description: "Field-source diagram for charges, poles, or current-carrying conductors.",
		subjects: ["Physics", "Science"],
		topicTags: ["electric field", "field lines", "charge", "magnetic field", "potential", "dipole"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_field_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["fieldType", "sources", "fieldLineCount"],
			optionalSlots: ["labels", "title"],
			constraints: ["Electric field arrows must point away from positive and toward negative charges."],
		},
		fallbackKind: "physics_diagram",
	}),
	template({
		id: "physics-wave-markers",
		title: "Wave marker diagram",
		description: "Waveform with amplitude, wavelength, node, antinode, or phase markers.",
		subjects: ["Physics", "Science"],
		topicTags: ["wave", "wavelength", "amplitude", "standing wave", "interference", "sound"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_wave_diagram",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["waveType", "xRange", "amplitude"],
			optionalSlots: ["wavelength", "markers"],
			constraints: ["The labelled marker positions must match the wave quantity asked in the stem."],
		},
	}),
];
