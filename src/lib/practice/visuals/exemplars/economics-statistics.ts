import type { VisualExemplar } from "../exemplars-type";

export const ECONOMICS_STATISTICS_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// ECONOMICS / STATISTICS
	// ───────────────────────────────────────────────────────────────────────
	// Allowed kinds when subject matches economics OR statistics:
	// `economics_curve`, `statistics_chart`, `data_table`, `math_function_plot`.
	// Pure statistics items primarily use `statistics_chart` (8 subKinds) plus
	// raw grouped data in `data_table`; reserve `economics_curve` for micro/macro
	// diagrams. Stratification keys keep distinct histograms/scatters/etc.
	{
		stem: "State the law of demand and explain the relationship between price and quantity demanded.",
		topicKeywords: ["law of demand", "microeconomics", "price determination"],
		visual: null,
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which class interval is the modal class in the histogram shown?",
		topicKeywords: ["histogram", "mode", "frequency distribution", "statistics"],
		visual: {
			caption: "Frequency distribution of marks.",
			altText:
				"Histogram with five adjacent class intervals on the horizontal axis and frequency on the vertical axis; bar heights vary across intervals.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Marks",
				yLabel: "Frequency",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 7 },
					{ label: "30-40", frequency: 12 },
					{ label: "40-50", frequency: 9 },
					{ label: "50-60", frequency: 3 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The bar chart shows student enrolment by stream. Which stream has the highest enrolment?",
		topicKeywords: ["bar chart", "enrolment", "data interpretation"],
		visual: {
			caption: "Student enrolment by stream in a senior secondary school.",
			altText:
				"Four vertical bars labelled Science, Commerce, Arts, and Vocational; bar heights differ across streams.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Stream",
				yLabel: "Number of Students",
				data: [
					{ label: "Science", value: 120 },
					{ label: "Commerce", value: 95 },
					{ label: "Arts", value: 80 },
					{ label: "Vocational", value: 45 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The line graph shows GDP growth rate (%) over five years. In which year did the growth rate peak?",
		topicKeywords: ["GDP", "growth rate", "macroeconomics", "time series"],
		visual: {
			caption: "Annual GDP growth rate (% per annum) over five years.",
			altText:
				"Line graph with years 2018 through 2022 on the horizontal axis and growth rate percentage on the vertical axis; the line rises and falls across the period.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Year",
				yLabel: "GDP Growth Rate (%)",
				series: [
					{
						name: "GDP Growth",
						points: [
							{ x: 2018, y: 6.5 },
							{ x: 2019, y: 5.0 },
							{ x: 2020, y: -6.6 },
							{ x: 2021, y: 8.7 },
							{ x: 2022, y: 7.2 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Based on the scatter diagram, state whether the correlation between study hours and test marks is positive, negative, or zero.",
		topicKeywords: ["scatter plot", "correlation", "bivariate data"],
		visual: {
			caption: "Scatter diagram of daily study hours versus test marks.",
			altText:
				"Ten data points on a grid; daily study hours from 2 to 9 on the horizontal axis; test marks from 40 to 92 on the vertical axis; points trend upward from left to right.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Study Hours (per day)",
				yLabel: "Test Marks",
				points: [
					{ x: 2, y: 40, label: null },
					{ x: 3, y: 52, label: null },
					{ x: 3, y: 48, label: null },
					{ x: 4, y: 58, label: null },
					{ x: 5, y: 65, label: null },
					{ x: 5, y: 70, label: null },
					{ x: 6, y: 72, label: null },
					{ x: 7, y: 80, label: null },
					{ x: 8, y: 88, label: null },
					{ x: 9, y: 92, label: null },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which sector contributes the largest share to GDP according to the pie chart?",
		topicKeywords: ["GDP composition", "pie chart", "sectoral distribution"],
		visual: {
			caption: "Sector-wise contribution to GDP.",
			altText:
				"Pie chart with four slices labelled Agriculture, Industry, Services, and Others; slice sizes differ.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Agriculture", value: 18 },
					{ label: "Industry", value: 26 },
					{ label: "Services", value: 50 },
					{ label: "Others", value: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the frequency polygon shown, identify the class interval with the highest frequency.",
		topicKeywords: ["frequency polygon", "wages distribution", "statistics"],
		visual: {
			caption: "Frequency polygon for weekly wages of factory workers.",
			altText:
				"Five class intervals on the horizontal axis and number of workers on the vertical axis; points connected by line segments form a polygon.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Weekly Wages (₹)",
				yLabel: "Number of Workers",
				bins: [
					{ label: "200-300", frequency: 5 },
					{ label: "300-400", frequency: 14 },
					{ label: "400-500", frequency: 20 },
					{ label: "500-600", frequency: 11 },
					{ label: "600-700", frequency: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the more-than ogive shown, estimate how many students scored at least 40 marks.",
		topicKeywords: ["ogive", "cumulative frequency", "more than", "marks distribution"],
		visual: {
			caption: "More-than ogive for marks of 60 students.",
			altText:
				"Downward-sloping cumulative curve; marks on the horizontal axis; more-than cumulative frequency on the vertical axis from 60 down toward zero.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Marks",
				yLabel: "More-than cf.",
				cumulative: "more_than",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 12 },
					{ label: "30-40", frequency: 20 },
					{ label: "40-50", frequency: 16 },
					{ label: "50-60", frequency: 8 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the less-than ogive shown, find the median of the distribution.",
		topicKeywords: ["median", "ogive", "less than cumulative", "statistics"],
		visual: {
			caption: "Less-than ogive for marks of 60 students.",
			altText:
				"S-shaped cumulative frequency curve; marks on the horizontal axis from 10 to 60; cumulative frequency on the vertical axis from 0 to 60.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Marks",
				yLabel: "Cumulative Frequency",
				cumulative: "less_than",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 12 },
					{ label: "30-40", frequency: 20 },
					{ label: "40-50", frequency: 16 },
					{ label: "50-60", frequency: 8 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the interquartile ranges of Group A and Group B using the box plots shown.",
		topicKeywords: ["box plot", "interquartile range", "quartiles", "compare distributions"],
		visual: {
			caption: "Box plots of test scores for Group A and Group B.",
			altText:
				"Two box plots; each shows minimum, Q1, median, Q3, and maximum; Group A and Group B have different spreads.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Group",
				yLabel: "Test Score",
				groups: [
					{ name: "Group A", min: 30, q1: 45, median: 58, q3: 70, max: 90 },
					{ name: "Group B", min: 40, q1: 55, median: 65, q3: 72, max: 85 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "State whether the histogram suggests slight skew left or skew right relative to the central peaks.",
		topicKeywords: ["skewness", "histogram", "shape of distribution"],
		visual: {
			caption: "Distribution of heights in a random sample of school athletes.",
			altText:
				"Histogram with height bins on the horizontal axis and frequency on the vertical; tallest bars lie slightly toward taller heights.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Height (cm)",
				yLabel: "Frequency",
				bins: [
					{ label: "150-154", frequency: 2 },
					{ label: "155-159", frequency: 5 },
					{ label: "160-164", frequency: 11 },
					{ label: "165-169", frequency: 14 },
					{ label: "170-174", frequency: 9 },
					{ label: "175-179", frequency: 4 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which city recorded the highest total rainfall in the month shown?",
		topicKeywords: ["rainfall", "comparative bar chart", "climatology"],
		visual: {
			caption: "Monthly rainfall totals across cities.",
			altText:
				"Vertical bar chart with cities on the horizontal axis and rainfall in millimetres on the vertical; bars differ in height.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "City",
				yLabel: "Rainfall (mm)",
				data: [
					{ label: "Mumbai", value: 312 },
					{ label: "Delhi", value: 89 },
					{ label: "Kolkata", value: 242 },
					{ label: "Chennai", value: 156 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the two index series on the chart and identify which stayed strictly higher across every plotted quarter.",
		topicKeywords: ["consumer price index", "inflation index", "line graph comparison"],
		visual: {
			caption: "Quarterly consumer prices indexed with base quarter = 100.",
			altText:
				"Two line traces labelled Rural CPI and Urban CPI sharing quarterly horizontal ticks from Q1 through Q8.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Quarter",
				yLabel: "Index (base = 100)",
				series: [
					{
						name: "Urban CPI",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101.4 },
							{ x: 3, y: 102.8 },
							{ x: 4, y: 104.6 },
							{ x: 5, y: 106.1 },
							{ x: 6, y: 107.9 },
							{ x: 7, y: 108.8 },
							{ x: 8, y: 110.5 },
						],
					},
					{
						name: "Rural CPI",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 100.9 },
							{ x: 3, y: 102.2 },
							{ x: 4, y: 103.8 },
							{ x: 5, y: 105.4 },
							{ x: 6, y: 107 },
							{ x: 7, y: 107.9 },
							{ x: 8, y: 109.7 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the three indexed wage series on the chart and identify which remained strictly lowest at quarter 8.",
		topicKeywords: ["wage indices", "index numbers", "comparative time series"],
		visual: {
			caption: "Quarterly wage indices — three sectors (base quarter = 100).",
			altText:
				"Three line traces labelled Manufacturing, Services, and Agriculture sharing quarterly ticks Q1–Q8 on the horizontal axis and index values on the vertical.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Quarter",
				yLabel: "Index (base = 100)",
				series: [
					{
						name: "Manufacturing",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101.2 },
							{ x: 3, y: 103.1 },
							{ x: 4, y: 104.8 },
							{ x: 5, y: 106.5 },
							{ x: 6, y: 108.7 },
							{ x: 7, y: 110.1 },
							{ x: 8, y: 112.4 },
						],
					},
					{
						name: "Services",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101 },
							{ x: 3, y: 102.4 },
							{ x: 4, y: 103.9 },
							{ x: 5, y: 105.8 },
							{ x: 6, y: 107.6 },
							{ x: 7, y: 109 },
							{ x: 8, y: 111 },
						],
					},
					{
						name: "Agriculture",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 100.6 },
							{ x: 3, y: 101.5 },
							{ x: 4, y: 102.8 },
							{ x: 5, y: 104 },
							{ x: 6, y: 105.5 },
							{ x: 7, y: 106.9 },
							{ x: 8, y: 108.2 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the scatter of outdoor temperature and heater sales, describe the direction of association.",
		topicKeywords: ["scatter plot", "negative association", "interpretation"],
		visual: {
			caption: "Daily mean temperature versus heater units sold.",
			altText:
				"Bivariate scatter trending downward; warmer days paired with fewer heaters sold.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Temperature (°C)",
				yLabel: "Heaters sold",
				points: [
					{ x: 8, y: 920, label: null },
					{ x: 10, y: 880, label: null },
					{ x: 12, y: 830, label: null },
					{ x: 14, y: 790, label: null },
					{ x: 16, y: 740, label: null },
					{ x: 18, y: 690, label: null },
					{ x: 20, y: 620, label: null },
					{ x: 22, y: 560, label: null },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "According to the commuter survey pie chart, what fraction of respondents chose public transport (approximate from the diagram)?",
		topicKeywords: ["pie chart", "proportion", "transport survey"],
		visual: {
			caption: "Primary mode of transport for daily commuting.",
			altText:
				"Pie chart with slices labelled Metro or Bus, Private car, Two-wheeler, Walk or Cycle; slice areas reflect approximate percentages.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Metro or Bus", value: 38 },
					{ label: "Private car", value: 24 },
					{ label: "Two-wheeler", value: 29 },
					{ label: "Walk or Cycle", value: 9 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Sketch mentally how the frequency polygon would close back to the axis after the highest vertex shown.",
		topicKeywords: ["frequency polygon", "mental geometry", "endpoints"],
		visual: {
			caption: "Frequency polygon for reaction times in a psychology experiment.",
			altText:
				"Five class intervals on the horizontal axis measured in milliseconds and counts on the vertical; vertices rise then fall.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Reaction time (ms)",
				yLabel: "No. of trials",
				bins: [
					{ label: "180-199", frequency: 4 },
					{ label: "200-219", frequency: 18 },
					{ label: "220-239", frequency: 31 },
					{ label: "240-259", frequency: 22 },
					{ label: "260-279", frequency: 9 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which factory batch shows the largest gap between median and third quartile per the box plots?",
		topicKeywords: ["box plot", "quartile interpretation", "manufacturing quality"],
		visual: {
			caption: "Unit defect counts per thousand items — three plants.",
			altText:
				"Three side-by-side box plots labelled Plant North, Plant Central, Plant South on the horizontal axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Plant",
				yLabel: "Defects per 1000 units",
				groups: [
					{ name: "Plant North", min: 1.2, q1: 2.4, median: 3.6, q3: 5.8, max: 9.2 },
					{ name: "Plant Central", min: 0.9, q1: 1.8, median: 2.7, q3: 4.1, max: 7.5 },
					{ name: "Plant South", min: 2.1, q1: 3.5, median: 4.9, q3: 7.2, max: 11 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Estimate the median pocket-money bracket using the less-than ogive (60 students).",
		topicKeywords: ["median", "ogive", "grouped data", "economics statistics"],
		visual: {
			caption: "Less-than ogive for weekly pocket money.",
			altText:
				"Cumulative frequency rising from zero toward 60 as pocket money increases along the horizontal axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Pocket money (₹)",
				yLabel: "Cumulative frequency",
				cumulative: "less_than",
				bins: [
					{ label: "100-200", frequency: 8 },
					{ label: "200-300", frequency: 14 },
					{ label: "300-400", frequency: 20 },
					{ label: "400-500", frequency: 12 },
					{ label: "500-600", frequency: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compute the arithmetic mean monthly saving from the grouped frequency table.",
		topicKeywords: ["mean", "grouped frequency", "statistics", "economics statistics"],
		visual: {
			caption: "Household saving intervals — mid-values implied by class centres.",
			altText:
				"Two columns for savings bracket in rupees and number of households surveyed.",
			spec: {
				kind: "data_table",
				caption: "Monthly household savings",
				headers: ["Bracket (₹)", "Households"],
				rows: [
					[
						{ value: "0 – 5,000", bold: false, align: "left" },
						{ value: "18", bold: false, align: "right" },
					],
					[
						{ value: "5,000 – 10,000", bold: false, align: "left" },
						{ value: "26", bold: false, align: "right" },
					],
					[
						{ value: "10,000 – 15,000", bold: false, align: "left" },
						{ value: "22", bold: false, align: "right" },
					],
					[
						{ value: "15,000 – 20,000", bold: false, align: "left" },
						{ value: "14", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the chart to read off an approximate probability $P(0 \\leq Z \\leq 1)$ as the shaded area under the standard normal curve.",
		topicKeywords: ["normal distribution", "standard normal", "probability density", "z score"],
		visual: {
			caption: "Bell-shaped density curve with horizontal axis standard deviations from the mean.",
			altText:
				"Symmetric curve peaked at zero from negative three to positive three on the horizontal axis; textbook-style normal reference sketch.",
			spec: {
				kind: "math_function_plot",
				xMin: -3.5,
				xMax: 3.5,
				yMin: 0,
				yMax: 0.45,
				xLabel: "z",
				yLabel: "φ(z)",
				items: [{ expr: "exp(-x^2/2)*0.39894228040143267", color: "primary", label: null }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the demand and supply curves shown to read the equilibrium price and quantity at their intersection.",
		topicKeywords: ["supply and demand", "market equilibrium", "microeconomics diagram"],
		visual: {
			caption: "Market diagram with downward demand and upward supply.",
			altText:
				"Quantity on the horizontal axis, price on the vertical; two curves meet at a point labelled Equilibrium in the first quadrant.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity",
				yLabel: "Price",
				xMin: 0,
				xMax: 200,
				yMin: 0,
				yMax: 100,
				curves: [
					{ expr: "80 - 0.4 * p", color: "primary", label: "Demand" },
					{ expr: "0.4 * p", color: "secondary", label: "Supply" },
				],
				marks: [{ x: 100, y: 40, label: "Equilibrium" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The PPF below shows production possibilities for wheat and cotton. Which labelled point represents an attainable but productively inefficient output combination?",
		topicKeywords: ["production possibility frontier", "opportunity cost", "inefficiency", "economics curve"],
		visual: {
			caption: "Production Possibility Frontier for wheat and cotton with three labelled points.",
			altText:
				"Straight downward PPF from wheat 0 cotton 200 to wheat 100 cotton 0; point A lies strictly inside the frontier (inefficient but attainable); point B on the frontier; point C above the line (unattainable).",
			spec: {
				kind: "economics_curve",
				xLabel: "Wheat (tonnes)",
				yLabel: "Cotton (tonnes)",
				xMin: 0,
				xMax: 120,
				yMin: 0,
				yMax: 240,
				curves: [
					{ expr: "200 - 2 * p", color: "primary", label: "PPF" },
				],
				marks: [
					{ x: 40, y: 70, label: "A" },
					{ x: 80, y: 40, label: "B" },
					{ x: 90, y: 120, label: "C" },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The AD-AS diagram shows the economy at equilibrium E₁. If AD shifts right to AD₂, what happens to the equilibrium price level?",
		topicKeywords: ["aggregate demand", "aggregate supply", "macroeconomics equilibrium", "AD AS model"],
		visual: {
			caption: "AD-AS diagram showing original equilibrium E₁ and a rightward shift of AD.",
			altText:
				"Two downward-sloping AD curves and one upward-sloping SRAS curve; AD₁ and SRAS intersect at E₁; AD₂ is shifted to the right of AD₁.",
			spec: {
				kind: "economics_curve",
				xLabel: "Real GDP (Y)",
				yLabel: "Price Level (P)",
				xMin: 0,
				xMax: 200,
				yMin: 0,
				yMax: 150,
				curves: [
					{ expr: "120 - 0.6 * p", color: "primary", label: "AD₁" },
					{ expr: "140 - 0.6 * p", color: "accent", label: "AD₂" },
					{ expr: "20 + 0.4 * p", color: "secondary", label: "SRAS" },
				],
				marks: [{ x: 100, y: 60, label: "E₁" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the monopoly diagram shown, state the profit-maximising quantity (horizontal-axis value) where MR intersects MC.",
		topicKeywords: ["monopoly", "marginal revenue", "marginal cost", "profit maximisation"],
		visual: {
			caption: "Monopoly diagram with demand (AR), MR, and MC curves.",
			altText:
				"Downward-sloping AR and steeper MR below it; horizontal MC; MR and MC cross at a point whose horizontal coordinate is the profit-maximising output.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity (Q)",
				yLabel: "Price / Revenue / Cost (₹)",
				xMin: 0,
				xMax: 60,
				yMin: 0,
				yMax: 110,
				curves: [
					{ expr: "100 - p", color: "primary", label: "AR (Demand)" },
					{ expr: "100 - 2 * p", color: "secondary", label: "MR" },
					{ expr: "20", color: "muted", label: "MC" },
				],
				marks: [{ x: 40, y: 20, label: "Q*", kind: "vertical_line" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the data table, find the mean number of plants per house.",
		topicKeywords: ["weighted mean", "frequency table", "mean from grouped data"],
		visual: {
			caption: "Plants per house — survey of 25 houses.",
			altText:
				"Two-column data table: number of plants 0 to 5 against frequency, frequencies summing to 25.",
			spec: {
				kind: "data_table",
				caption: "Plants per house",
				headers: ["Number of plants", "Frequency"],
				rows: [
					[
						{ value: "0", bold: false, align: "left" },
						{ value: "1", bold: false, align: "right" },
					],
					[
						{ value: "1", bold: false, align: "left" },
						{ value: "5", bold: false, align: "right" },
					],
					[
						{ value: "2", bold: false, align: "left" },
						{ value: "8", bold: false, align: "right" },
					],
					[
						{ value: "3", bold: false, align: "left" },
						{ value: "6", bold: false, align: "right" },
					],
					[
						{ value: "4", bold: false, align: "left" },
						{ value: "3", bold: false, align: "right" },
					],
					[
						{ value: "5", bold: false, align: "left" },
						{ value: "2", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["economics_statistics", "mathematics"],
	},
];
