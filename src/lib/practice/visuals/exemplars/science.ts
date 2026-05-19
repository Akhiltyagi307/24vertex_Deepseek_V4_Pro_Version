import type { VisualExemplar } from "../exemplars-type";

export const SCIENCE_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// SCIENCE (Grades 6-10)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Name the process by which green plants prepare their own food using sunlight.",
		topicKeywords: ["photosynthesis", "nutrition in plants", "plant nutrition"],
		visual: null,
		subjects: ["science"],
	},
	{
		stem: "The table compares three types of microorganisms. Which type is used to make bread rise?",
		topicKeywords: ["microorganisms yeast", "fermentation basics", "table reading"],
		visual: {
			caption: "Comparison of bacteria, fungi, and viruses.",
			altText:
				"Four-column table with rows for Bacteria, Fungi, and Virus; columns show cell type, approximate size, and one example for each.",
			spec: {
				kind: "data_table",
				caption: "Microorganism comparison",
				headers: ["Type", "Cell Type", "Size (approx.)", "Example"],
				rows: [
					[
						{ value: "Bacteria", bold: false, align: "left" },
						{ value: "Prokaryote", bold: false, align: "left" },
						{ value: "1-10 µm", bold: false, align: "right" },
						{ value: "Lactobacillus", bold: false, align: "left" },
					],
					[
						{ value: "Fungi", bold: false, align: "left" },
						{ value: "Eukaryote", bold: false, align: "left" },
						{ value: "2-200 µm", bold: false, align: "right" },
						{ value: "Yeast", bold: false, align: "left" },
					],
					[
						{ value: "Virus", bold: false, align: "left" },
						{ value: "Acellular", bold: false, align: "left" },
						{ value: "20-300 nm", bold: false, align: "right" },
						{ value: "Influenza", bold: false, align: "left" },
					],
				],
			},
		},
		subjects: ["science"],
	},
];
