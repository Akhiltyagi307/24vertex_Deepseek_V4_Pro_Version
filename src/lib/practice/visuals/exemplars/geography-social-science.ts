import type { VisualExemplar } from "../exemplars-type";

export const GEOGRAPHY_SOCIAL_SCIENCE_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// GEOGRAPHY / SOCIAL SCIENCE — charts, tables, function plots, India map (`india_map`)
	// ───────────────────────────────────────────────────────────────────────
	// Preferred kinds: india_map, statistics_chart, data_table, math_function_plot.
	// Tag both geography and social_science so picks work for elective Geography
	// and integrated Social Science.
	{
		stem: "Explain why mid-latitude west coast stations often show a smaller annual temperature range than inland stations at similar latitude.",
		topicKeywords: ["continentality", "maritime climate", "temperature range", "geography climates"],
		visual: null,
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The graph shows mean monthly temperature (°C) at a coastal station. Which month marks the lowest mean temperature?",
		topicKeywords: ["climate", "temperature", "weather", "season"],
		visual: {
			caption: "Mean monthly temperature at one coastal station.",
			altText:
				"Line graph with months 1 through 12 on the horizontal axis and temperature in degrees Celsius on the vertical; the trace rises through mid-year then falls toward December.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Month",
				yLabel: "Temperature (°C)",
				series: [
					{
						name: "Mean temperature",
						points: [
							{ x: 1, y: 22 },
							{ x: 2, y: 23 },
							{ x: 3, y: 25 },
							{ x: 4, y: 27 },
							{ x: 5, y: 29 },
							{ x: 6, y: 30 },
							{ x: 7, y: 29 },
							{ x: 8, y: 28 },
							{ x: 9, y: 27 },
							{ x: 10, y: 26 },
							{ x: 11, y: 24 },
							{ x: 12, y: 22 },
						],
					},
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The bar chart shows average monthly rainfall (mm) during one calendar year at a monsoon-affected station. Which month received the highest rainfall?",
		topicKeywords: ["rainfall", "monsoon", "precipitation", "climate", "hydrology"],
		visual: {
			caption: "Monthly rainfall totals at one station.",
			altText:
				"Twelve vertical bars for months 1 to 12 with rainfall in millimetres on the vertical axis; one mid-year bar is tallest.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Month",
				yLabel: "Rainfall (mm)",
				data: [
					{ label: "1", value: 12 },
					{ label: "2", value: 9 },
					{ label: "3", value: 18 },
					{ label: "4", value: 42 },
					{ label: "5", value: 88 },
					{ label: "6", value: 165 },
					{ label: "7", value: 210 },
					{ label: "8", value: 145 },
					{ label: "9", value: 96 },
					{ label: "10", value: 38 },
					{ label: "11", value: 14 },
					{ label: "12", value: 8 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "According to the bar chart, which state recorded the largest estimated population (millions) in the survey year?",
		topicKeywords: ["population", "demography", "census", "human geography"],
		visual: {
			caption: "Estimated population by selected states.",
			altText:
				"Horizontal axis lists four Indian states; vertical axis is population in millions; bar heights differ.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "State",
				yLabel: "Population (millions)",
				data: [
					{ label: "Kerala", value: 36 },
					{ label: "Rajasthan", value: 81 },
					{ label: "Bihar", value: 126 },
					{ label: "Tamil Nadu", value: 74 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The pie chart summarises land use within one district. Which land-use category occupies the largest share of area?",
		topicKeywords: ["land use", "resource", "agriculture", "land"],
		visual: {
			caption: "Land-use shares within one district.",
			altText:
				"Pie chart with slices for cropland, forest, built-up, and other land; slice areas reflect approximate percentages.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Cropland", value: 46 },
					{ label: "Forest", value: 28 },
					{ label: "Built-up", value: 14 },
					{ label: "Other", value: 12 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Using the table, which station has the highest annual rainfall total?",
		topicKeywords: ["rainfall", "climate", "station", "temperature"],
		visual: {
			caption: "Climate normals at three weather stations.",
			altText:
				"Three rows list station name, elevation in metres, mean annual rainfall in millimetres, and January mean temperature in Celsius.",
			spec: {
				kind: "data_table",
				caption: "Station climate summary",
				headers: ["Station", "Elevation (m)", "Annual rainfall (mm)", "Jan mean T (°C)"],
				rows: [
					[
						{ value: "Shillong", bold: false, align: "left" },
						{ value: "1495", bold: false, align: "right" },
						{ value: "2180", bold: false, align: "right" },
						{ value: "9", bold: false, align: "right" },
					],
					[
						{ value: "Nagpur", bold: false, align: "left" },
						{ value: "310", bold: false, align: "right" },
						{ value: "1095", bold: false, align: "right" },
						{ value: "21", bold: false, align: "right" },
					],
					[
						{ value: "Thiruvananthapuram", bold: false, align: "left" },
						{ value: "15", bold: false, align: "right" },
						{ value: "1680", bold: false, align: "right" },
						{ value: "27", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The scatter diagram plots latitude (°N) against January mean temperature (°C) for several coastal stations. Describe the direction of association.",
		topicKeywords: ["climate zones", "latitude temperature", "scatter plot", "geography correlation"],
		visual: {
			caption: "Latitude versus January mean temperature (coastal stations).",
			altText:
				"Bivariate scatter with latitude on the horizontal axis and January temperature on the vertical; points trend downward left to right.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Latitude (°N)",
				yLabel: "January mean T (°C)",
				points: [
					{ x: 8, y: 27, label: "Kochi" },
					{ x: 12, y: 26, label: null },
					{ x: 16, y: 24, label: "Panaji" },
					{ x: 20, y: 22, label: null },
					{ x: 24, y: 18, label: "Mumbai" },
					{ x: 28, y: 14, label: null },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Which size class of operational land holdings is the modal class in the histogram?",
		topicKeywords: ["histogram", "agricultural geography", "land holdings"],
		visual: {
			caption: "Operational holdings by area — one survey district.",
			altText:
				"Histogram with hectare class intervals on the horizontal axis and number of holdings on the vertical; one central interval has the tallest bar.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Holding size (ha)",
				yLabel: "No. of holdings",
				bins: [
					{ label: "0-1", frequency: 820 },
					{ label: "1-2", frequency: 540 },
					{ label: "2-4", frequency: 310 },
					{ label: "4-10", frequency: 140 },
					{ label: ">10", frequency: 45 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Using the frequency polygon for villages by elevation band, which band contains the greatest number of settlements?",
		topicKeywords: ["frequency polygon", "elevation belts", "rural settlements"],
		visual: {
			caption: "Village counts by median elevation band (m above sea level).",
			altText:
				"Class intervals for elevation on the horizontal axis and village count on the vertical; vertices connect mid-interval frequencies.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Elevation band (m)",
				yLabel: "Villages",
				bins: [
					{ label: "0-200", frequency: 18 },
					{ label: "200-500", frequency: 42 },
					{ label: "500-1000", frequency: 56 },
					{ label: "1000-1500", frequency: 31 },
					{ label: "1500-2500", frequency: 12 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "From the less-than ogive for journey lengths, estimate how many commuter trips were shorter than 25 km.",
		topicKeywords: ["less than ogive", "cumulation journey length", "transport geography"],
		visual: {
			caption: "Less-than cumulative frequency — journey length (sample survey).",
			altText:
				"Cumulative trip count rising along the vertical axis as journey length increases on the horizontal; smooth S-shaped curve.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Journey length (km)",
				yLabel: "Cumulative trips",
				cumulative: "less_than",
				bins: [
					{ label: "0-10", frequency: 42 },
					{ label: "10-20", frequency: 68 },
					{ label: "20-30", frequency: 55 },
					{ label: "30-40", frequency: 28 },
					{ label: "40-60", frequency: 17 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Compare the interquartile spread of January mean temperature between the hill station and the plain station using the box plots.",
		topicKeywords: ["climate comparison", "box plot", "hill vs plain temperatures"],
		visual: {
			caption: "January mean temperature — hill vs plain climate stations.",
			altText:
				"Two box plots labelled Hill station and Plain station on the horizontal axis; temperatures in degrees Celsius on the vertical.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Station type",
				yLabel: "January mean T (°C)",
				groups: [
					{ name: "Hill station", min: 4, q1: 6, median: 8, q3: 10, max: 13 },
					{ name: "Plain station", min: 14, q1: 16, median: 18, q3: 20, max: 23 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The political map highlights three states along the Arabian Sea coast. Which option correctly lists those shaded units?",
		topicKeywords: ["india political map", "arabian sea", "western coast states"],
		visual: {
			caption: "India — selected coastal states (west).",
			altText:
				"Administrative map of India with Kerala, Karnataka, and Goa filled distinctly along the Arabian Sea littoral; neighbours shown in lighter fills.",
			spec: {
				kind: "india_map",
				mapStyle: "political",
				highlightedStates: ["kl", "ka", "ga"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "On the outline-style map, the shaded states lie mainly in the Indo-Gangetic drainage belt. Which labelled choice matches the set shown?",
		topicKeywords: ["outline map india", "indus gangetic plain", "north india states"],
		visual: {
			caption: "India — outline map; plains belt emphasis.",
			altText:
				"Minimal-fill outline map of India with Punjab, Haryana, Uttar Pradesh, and Bihar shaded in amber on interior northern plains.",
			spec: {
				kind: "india_map",
				mapStyle: "outline",
				highlightedStates: ["pb", "hr", "up", "br"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The physical-palette map emphasises states astride the main Himalayan arc. Which option lists only shaded Himalayan-region units?",
		topicKeywords: ["himalayas", "india relief map", "mountain states india"],
		visual: {
			caption: "India — muted physical palette; Himalayan arc.",
			altText:
				"Muted earth-tone fills across India with Jammu and Kashmir, Himachal Pradesh, and Uttarakhand highlighted in contrasting yellow-green tones.",
			spec: {
				kind: "india_map",
				mapStyle: "physical_palette",
				highlightedStates: ["jk", "hp", "ut"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Refer to the political-style map of India below (no region pre-highlighted). Which option best describes the general orientation of the peninsula south of the Narmada–Tapti belt?",
		topicKeywords: ["physical geography india", "indian peninsula", "map orientation"],
		visual: {
			caption: "India — political-style administrative map (full extent).",
			altText:
				"Map of India with states and union territories in contrasting pastel fills and dark internal borders; Arabian Sea to the west and Bay of Bengal to the east; no single state emphasised.",
			spec: {
				kind: "india_map",
				mapStyle: "political",
				highlightedStates: null,
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "On the map below rendered with the default administrative palette (no named style override), which ocean lies immediately west of the Indian peninsula?",
		topicKeywords: ["india map arabian sea", "cardinal directions", "indian ocean geography"],
		visual: {
			caption: "India — administrative boundaries (default map treatment).",
			altText:
				"India map with standard state and UT fills and internal borders; Arabian Sea to the west and Bay of Bengal to the east; no particular state emphasised.",
			spec: {
				kind: "india_map",
				mapStyle: null,
				highlightedStates: null,
			},
		},
		subjects: ["geography", "social_science"],
	},
];
