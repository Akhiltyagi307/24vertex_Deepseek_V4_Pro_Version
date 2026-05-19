import type { VisualExemplar } from "../exemplars-type";

export const BIOLOGY_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	// ───────────────────────────────────────────────────────────────────────
	// BIOLOGY (tables & charts only — no tissue / organ diagram renderer in v1)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain why enzymes are highly specific to their substrate molecules.",
		topicKeywords: ["enzyme", "substrate", "protein", "biochemistry"],
		visual: null,
		subjects: ["biology"],
	},
	{
		stem: "Using the enzyme assay results in the table, at which temperature was the highest initial reaction rate recorded?",
		topicKeywords: ["enzyme", "temperature", "rate", "assay", "experiment"],
		visual: {
			caption: "Trial enzyme activity — initial rate vs temperature.",
			altText:
				"Three-column table: trial label, temperature in degrees Celsius, initial rate in micromoles per minute.",
			spec: {
				kind: "data_table",
				caption: "Enzyme assay (three trials)",
				headers: ["Trial", "Temperature (°C)", "Initial rate (µmol·min⁻¹)"],
				rows: [
					[
						{ value: "A", bold: false, align: "left" },
						{ value: "25", bold: false, align: "right" },
						{ value: "12", bold: false, align: "right" },
					],
					[
						{ value: "B", bold: false, align: "left" },
						{ value: "37", bold: false, align: "right" },
						{ value: "28", bold: false, align: "right" },
					],
					[
						{ value: "C", bold: false, align: "left" },
						{ value: "45", bold: false, align: "right" },
						{ value: "9", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["biology"],
	},
	{
		stem: "According to the bar chart, which sampling zone had the greatest estimated plant species richness?",
		topicKeywords: ["ecology", "species", "biodiversity", "population", "sampling"],
		visual: {
			caption: "Estimated species richness by sampling zone.",
			altText:
				"Vertical bars for four labelled zones on the horizontal axis and species count on the vertical axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Zone",
				yLabel: "Species (count)",
				data: [
					{ label: "Forest edge", value: 18 },
					{ label: "Grassland", value: 26 },
					{ label: "Wetland", value: 31 },
					{ label: "Bare soil", value: 7 },
				],
			},
		},
		subjects: ["biology"],
	},
];
