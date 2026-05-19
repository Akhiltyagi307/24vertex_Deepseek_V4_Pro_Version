import type { VisualExemplar } from "../exemplars-type";

export const BUSINESS_STUDIES_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// BUSINESS STUDIES — charts, tables, curves (same renderer surface as Economics / Stats)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain in one sentence why management is considered a multidimensional activity.",
		topicKeywords: ["management fundamentals", "nature of management", "management functions"],
		visual: null,
		subjects: ["business_studies"],
	},
	{
		stem: "According to the bar chart, which quarter recorded the highest revenue for Division North?",
		topicKeywords: ["bar chart", "revenue reporting", "quarterly comparison"],
		visual: {
			caption: "Quarterly revenue — Division North (₹ lakh).",
			altText:
				"Four vertical bars labelled Q1–Q4 with revenue in lakh rupees on the vertical axis; one quarter bar is tallest.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Quarter",
				yLabel: "Revenue (₹ lakh)",
				data: [
					{ label: "Q1", value: 42 },
					{ label: "Q2", value: 55 },
					{ label: "Q3", value: 48 },
					{ label: "Q4", value: 61 },
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "Using the table, compute the percentage share of Product B in total units sold across all three products.",
		topicKeywords: ["percentage", "distribution", "marketing data table"],
		visual: {
			caption: "Annual units sold by product line.",
			altText:
				"Two-column table listing Product A, B, and C with integer unit sales; totals can be summed from the rows.",
			spec: {
				kind: "data_table",
				caption: "Units sold (year ended March)",
				headers: ["Product", "Units sold"],
				rows: [
					[
						{ value: "A", bold: false, align: "left" },
						{ value: "12,400", bold: false, align: "right" },
					],
					[
						{ value: "B", bold: false, align: "left" },
						{ value: "8,600", bold: false, align: "right" },
					],
					[
						{ value: "C", bold: false, align: "left" },
						{ value: "5,200", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "Using the break-even diagram, read off the approximate output level (units) where total revenue equals total cost.",
		topicKeywords: ["break-even", "cost-volume-profit", "TR TC intersection"],
		visual: {
			caption: "Break-even chart — total revenue and total cost vs units sold.",
			altText:
				"Quantity on the horizontal axis and rupees on the vertical; a straight total revenue line rising from the origin crosses an upward-sloping total cost line that starts above zero at fixed cost.",
			spec: {
				kind: "economics_curve",
				xLabel: "Units (Q)",
				yLabel: "Amount (₹)",
				xMin: 0,
				xMax: 70,
				yMin: 0,
				yMax: 1400,
				curves: [
					{ expr: "25 * p", color: "primary", label: "TR" },
					{ expr: "500 + 10 * p", color: "secondary", label: "TC" },
				],
				marks: [{ x: 33.3, y: 833, label: "Break-even" }],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "According to the pie chart, which cost component absorbed the largest share of factory overheads in the survey month?",
		topicKeywords: ["pie chart", "cost structure", "overheads"],
		visual: {
			caption: "Factory overhead composition — one plant.",
			altText:
				"Pie chart with slices for wages, power and fuel, raw materials, depreciation, and other factory overheads; proportions sum to the whole.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Wages", value: 38 },
					{ label: "Power & fuel", value: 18 },
					{ label: "Raw materials", value: 22 },
					{ label: "Depreciation", value: 12 },
					{ label: "Other overheads", value: 10 },
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "In the histogram of absent days per employee, which class interval contains the mode?",
		topicKeywords: ["histogram", "absenteeism", "mode", "HR analytics"],
		visual: {
			caption: "Absent days per employee — one reporting month.",
			altText:
				"Five adjacent class intervals on the horizontal axis and employee count on the vertical; bar heights show how many staff fell in each absent-day bracket.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Absent days",
				yLabel: "Employees",
				bins: [
					{ label: "0", frequency: 42 },
					{ label: "1", frequency: 28 },
					{ label: "2", frequency: 15 },
					{ label: "3", frequency: 9 },
					{ label: "4-5", frequency: 6 },
				],
			},
		},
		subjects: ["business_studies"],
	},
];
