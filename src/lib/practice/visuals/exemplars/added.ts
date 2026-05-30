import type { VisualExemplar } from "../exemplars-type";

export const ADDED_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	{
		stem: "In the figure, PA and PB are tangents to a circle with centre O. Which radius is perpendicular to tangent PA at A?",
		topicKeywords: ["circle theorem", "tangent radius", "perpendicular"],
		visual: {
			caption: "Tangents from external point P touch the circle at A and B.",
			altText:
				"Circle with centre O, external point P, and two tangents touching at A and B. Radii OA and OB join the centre to points of contact, with a right-angle marker at A between OA and PA.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -7, xMax: 7, yMin: -6, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 0, y: 0 }, radius: 3.5, label: null },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: -2.2, y: 2.7 }, label: "A" },
					{ type: "point", at: { x: 2.2, y: 2.7 }, label: "B" },
					{ type: "point", at: { x: 0, y: 6.2 }, label: "P" },
					{ type: "segment", from: { x: 0, y: 6.2 }, to: { x: -2.2, y: 2.7 }, label: "PA", dashed: false },
					{ type: "segment", from: { x: 0, y: 6.2 }, to: { x: 2.2, y: 2.7 }, label: "PB", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: -2.2, y: 2.7 }, label: "OA", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 2.2, y: 2.7 }, label: "OB", dashed: false },
					{
						type: "angle_marker",
						vertex: { x: -2.2, y: 2.7 },
						fromRayPoint: { x: -1.2, y: 1.5 },
						toRayPoint: { x: -1.1, y: 4.1 },
						label: "90°",
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "A 20 m pole casts a 15 m shadow as shown. Find the angle of elevation of the Sun.",
		topicKeywords: ["height and distance", "trigonometry", "angle of elevation"],
		visual: {
			caption: "Right triangle model for height and shadow.",
			altText:
				"Vertical pole of 20 m at one end of a 15 m horizontal shadow forms a right triangle. The angle of elevation is marked at the shadow tip.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 18, yMin: -1, yMax: 23, showGrid: true, showAxes: false },
				primitives: [
					{ type: "point", at: { x: 0, y: 0 }, label: "B" },
					{ type: "point", at: { x: 0, y: 20 }, label: "A" },
					{ type: "point", at: { x: 15, y: 0 }, label: "C" },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 0, y: 20 }, label: "20 m", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 15, y: 0 }, label: "15 m", dashed: false },
					{ type: "segment", from: { x: 15, y: 0 }, to: { x: 0, y: 20 }, label: null, dashed: false },
					{
						type: "angle_marker",
						vertex: { x: 15, y: 0 },
						fromRayPoint: { x: 0, y: 0 },
						toRayPoint: { x: 0, y: 20 },
						label: "θ",
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "From the feasible region shown, identify the corner point where objective Z = 3x + 2y is maximised.",
		topicKeywords: ["linear programming", "feasible region", "corner point"],
		visual: {
			caption: "Feasible region for a two-variable LPP.",
			altText:
				"Coordinate plane with three boundary lines and a shaded polygonal feasible region in first quadrant. Corner points are labelled for objective evaluation.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 10, showGrid: true, showAxes: true },
				primitives: [
					{ type: "segment", from: { x: 0, y: 8 }, to: { x: 8, y: 0 }, label: "x + y = 8", dashed: false },
					{ type: "segment", from: { x: 0, y: 6 }, to: { x: 9, y: 0 }, label: "2x + 3y = 18", dashed: false },
					{ type: "segment", from: { x: 2, y: 0 }, to: { x: 2, y: 8 }, label: "x = 2", dashed: true },
					{
						type: "polygon",
						vertices: [
							{ x: 2, y: 0 },
							{ x: 8, y: 0 },
							{ x: 5.4, y: 2.6 },
							{ x: 2, y: 4.6 },
						],
						label: "Feasible region",
						filled: true,
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In the inclined pulley setup, compare the magnitudes of tension T and component mg sinθ along the slope.",
		topicKeywords: ["inclined plane", "tension", "free body diagram"],
		visual: {
			caption: "Block on incline with tension and weight components.",
			altText:
				"Free-body diagram of a block on a rough incline showing tension up the plane, normal reaction perpendicular to plane, and weight downward with component decomposition.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "m",
				inclineDeg: 30,
				forces: [
					{ name: "T", magnitude: 12, angleDeg: 30 },
					{ name: "N", magnitude: 17, angleDeg: 120 },
					{ name: "mg", magnitude: 20, angleDeg: -90 },
				],
			},
		},
		subjects: ["physics"],
	},
	{
		stem: "Use the RC discharge graph to estimate the time constant τ from the decay pattern.",
		topicKeywords: ["rc circuit", "discharge", "time constant", "exponential decay"],
		visual: {
			caption: "Capacitor voltage during RC discharge.",
			altText:
				"Voltage-time plot with exponential decay from initial V0 toward zero; horizontal axis in seconds and vertical axis in volts.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 10,
				yMin: 0,
				yMax: 12,
				xLabel: "Time (s)",
				yLabel: "Voltage (V)",
				items: [{ expr: "10 * exp(-x / 2)", color: "primary", label: "V(t)" }],
			},
		},
		subjects: ["physics"],
	},
	{
		stem: "In the reversible reaction shown, predict the direction of shift when pressure is increased.",
		topicKeywords: ["chemical equilibrium", "le chatelier", "reaction conditions"],
		visual: {
			caption: "Equilibrium reaction with catalyst and pressure condition.",
			altText:
				"Chemical equation with reversible arrow, catalyst note, and pressure/temperature condition written above the arrow.",
			spec: {
				kind: "chemistry_reaction",
				ce: "N2(g) + 3H2(g) <=>[\\text{Fe catalyst}][450^\\circ\\text{C},\\ 200\\ \\text{atm}] 2NH3(g)",
				label: "Haber process equilibrium",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Identify oxidizing and reducing agents in the reaction shown.",
		topicKeywords: ["redox reaction", "oxidation state", "agent identification"],
		visual: {
			caption: "Redox equation with ionic states.",
			altText:
				"Balanced ionic equation with aqueous and solid states shown to support oxidation-number analysis.",
			spec: {
				kind: "chemistry_reaction",
				ce: "Zn(s) + CuSO4(aq) -> ZnSO4(aq) + Cu(s)",
				label: "Single-displacement redox",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The molecule shown has one stereogenic center. Determine whether the shown form is one enantiomer of lactic acid.",
		topicKeywords: ["stereochemistry", "wedge dash", "enantiomer"],
		visual: {
			caption: "2D wedge-dash representation of lactic acid.",
			altText:
				"Lactic-acid skeleton with one chiral carbon represented using stereochemical wedge notation in the SMILES mapping.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "C[C@H](O)C(=O)O",
				display: "2d",
				label: "Lactic acid stereocentre",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Record the journal entry for share forfeiture where allotment and first call remain unpaid.",
		topicKeywords: ["share forfeiture", "journal entry", "company accounts"],
		visual: {
			caption: "Journal entry format for share forfeiture.",
			altText:
				"Journal table with debit and credit lines for Share Capital, Share Forfeiture, and Calls in Arrears in a forfeiture case.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Share Capital A/c Dr.\n  To Share Forfeiture A/c\n  To Share Allotment A/c\n  To Share First Call A/c",
						debit: 100000,
						credit: 100000,
						narration: "Being shares forfeited on non-payment of allotment and first call.",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Which side of the revaluation account records the increase in value of machinery?",
		topicKeywords: ["revaluation account", "partnership accounts", "ledger treatment"],
		visual: {
			caption: "Revaluation account ledger format.",
			altText:
				"T-account style ledger with debit and credit columns for revaluation adjustments during partner admission.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Revaluation A/c",
					debitSide: [
						{
							date: "2026-03-31",
							particulars: "To Machinery A/c",
							amount: 40000,
						},
					],
					creditSide: [
						{
							date: "2026-03-31",
							particulars: "By General Reserve A/c",
							amount: 25000,
						},
					],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Pass the journal entry for goods worth ₹20,000 purchased on credit from Sharma & Co. on 10 Jun 2026, including 5% trade discount.",
		topicKeywords: ["journal entry", "credit purchase", "trade discount"],
		visual: {
			caption: "Journal entry for credit purchase with trade discount.",
			altText:
				"Two-row journal entry recording a credit purchase from Sharma & Co. with the trade discount applied before posting.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-06-10",
						particulars: "Purchases A/c Dr.\n  To Sharma & Co. A/c",
						debit: 19000,
						credit: 19000,
						narration: "Being goods purchased on credit (less 5% trade discount on ₹20,000).",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "From the following balances of M/s Patel Traders as on 31 Mar 2026, prepare the trial balance.",
		topicKeywords: ["trial balance", "ledger balances", "preparation"],
		visual: {
			caption: "Trial balance of M/s Patel Traders as on 31 Mar 2026.",
			altText:
				"Trial balance listing capital, drawings, purchases, sales, debtors, creditors, cash, and rent with debit and credit totals tallied.",
			spec: {
				kind: "accountancy_table",
				subKind: "trial_balance",
				rows: [
					{ particulars: "Capital A/c", debit: null, credit: 200000 },
					{ particulars: "Drawings A/c", debit: 30000, credit: null },
					{ particulars: "Purchases A/c", debit: 150000, credit: null },
					{ particulars: "Sales A/c", debit: null, credit: 240000 },
					{ particulars: "Sundry Debtors", debit: 60000, credit: null },
					{ particulars: "Sundry Creditors", debit: null, credit: 45000 },
					{ particulars: "Cash in Hand", debit: 15000, credit: null },
					{ particulars: "Rent Paid", debit: 12000, credit: null },
					{ particulars: "Wages", debit: 18000, credit: null },
					{ particulars: "Bank Loan", debit: null, credit: 50000 },
					{ particulars: "Furniture", debit: 250000, credit: null },
					{ particulars: "Total", debit: 535000, credit: 535000 },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Prepare the balance sheet of Kumar Enterprises as on 31 Mar 2026 from the trial balance and adjustments given.",
		topicKeywords: ["balance sheet", "final accounts", "schedule iii"],
		visual: {
			caption: "Balance sheet of Kumar Enterprises as on 31 Mar 2026.",
			altText:
				"Horizontal-format balance sheet showing equity & liabilities on the left and assets on the right, with totals on both sides matching at ₹4,80,000.",
			spec: {
				kind: "accountancy_table",
				subKind: "balance_sheet",
				assetsSide: [
					{ particulars: "Non-Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Furniture & Fixtures", amount: 120000, indent: 1, bold: false },
					{ particulars: "Plant & Machinery", amount: 200000, indent: 1, bold: false },
					{ particulars: "Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Inventory", amount: 70000, indent: 1, bold: false },
					{ particulars: "Sundry Debtors", amount: 55000, indent: 1, bold: false },
					{ particulars: "Cash & Bank", amount: 35000, indent: 1, bold: false },
					{ particulars: "Total Assets", amount: 480000, indent: 0, bold: true },
				],
				equityAndLiabilitiesSide: [
					{ particulars: "Capital & Reserves", amount: null, indent: 0, bold: true },
					{ particulars: "Capital A/c", amount: 300000, indent: 1, bold: false },
					{ particulars: "Net Profit (transferred)", amount: 45000, indent: 1, bold: false },
					{ particulars: "Non-Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Long-Term Bank Loan", amount: 90000, indent: 1, bold: false },
					{ particulars: "Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Sundry Creditors", amount: 35000, indent: 1, bold: false },
					{ particulars: "Outstanding Wages", amount: 10000, indent: 1, bold: false },
					{ particulars: "Total Equity & Liabilities", amount: 480000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Prepare the profit & loss statement of Meera Traders for the year ended 31 Mar 2026 from the following trial balance figures.",
		topicKeywords: ["profit and loss", "final accounts", "trading account"],
		visual: {
			caption: "Profit & Loss statement of Meera Traders for FY 2025-26.",
			altText:
				"Vertical P&L statement listing revenue, cost of goods sold, gross profit, operating expenses, and net profit.",
			spec: {
				kind: "accountancy_table",
				subKind: "p_and_l",
				rows: [
					{ particulars: "Revenue from Operations (Sales)", amount: 600000, indent: 0, bold: true },
					{ particulars: "Less: Cost of Goods Sold", amount: 360000, indent: 1, bold: false },
					{ particulars: "  Opening Stock", amount: 40000, indent: 2, bold: false },
					{ particulars: "  Add: Purchases", amount: 380000, indent: 2, bold: false },
					{ particulars: "  Less: Closing Stock", amount: 60000, indent: 2, bold: false },
					{ particulars: "Gross Profit", amount: 240000, indent: 0, bold: true },
					{ particulars: "Operating Expenses", amount: null, indent: 0, bold: true },
					{ particulars: "  Salaries", amount: 80000, indent: 2, bold: false },
					{ particulars: "  Rent", amount: 36000, indent: 2, bold: false },
					{ particulars: "  Depreciation on Furniture", amount: 12000, indent: 2, bold: false },
					{ particulars: "  Other Office Expenses", amount: 18000, indent: 2, bold: false },
					{ particulars: "Total Operating Expenses", amount: 146000, indent: 0, bold: false },
					{ particulars: "Net Profit", amount: 94000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Prepare the single column cash book of Rohan Stationers for the week starting 1 Apr 2026 from the given receipts and payments.",
		topicKeywords: ["cash book", "single column", "receipts payments"],
		visual: {
			caption: "Single column cash book of Rohan Stationers (1–7 Apr 2026).",
			altText:
				"Single column cash book with dated rows for opening balance, sales receipts, rent paid, drawings, purchases, and closing balance carry-down — debit and credit columns total equally.",
			spec: {
				kind: "accountancy_table",
				subKind: "cash_book",
				rows: [
					{
						date: "2026-04-01",
						particulars: "To Balance b/d (opening cash)",
						debit: 15000,
						credit: null,
						narration: null,
					},
					{
						date: "2026-04-02",
						particulars: "To Sales A/c",
						debit: 8000,
						credit: null,
						narration: null,
					},
					{
						date: "2026-04-03",
						particulars: "By Rent A/c",
						debit: null,
						credit: 4000,
						narration: null,
					},
					{
						date: "2026-04-05",
						particulars: "By Purchases A/c",
						debit: null,
						credit: 6500,
						narration: null,
					},
					{
						date: "2026-04-06",
						particulars: "To Sales A/c",
						debit: 5500,
						credit: null,
						narration: null,
					},
					{
						date: "2026-04-07",
						particulars: "By Drawings A/c",
						debit: null,
						credit: 2000,
						narration: null,
					},
					{
						date: "2026-04-07",
						particulars: "By Balance c/d (closing cash)",
						debit: null,
						credit: 16000,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Pass the rectification entry for a credit sale of ₹4,000 to Arjun wrongly debited to the purchases account.",
		topicKeywords: ["rectification", "errors", "two-sided"],
		visual: {
			caption: "Rectification entry for misclassified credit sale.",
			altText:
				"Two-row rectification journal entry reversing the wrong debit to Purchases and recording the correct debit to Arjun, with Sales credited.",
			spec: {
				kind: "accountancy_table",
				subKind: "rectification",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Arjun A/c Dr.\n  To Purchases A/c\n  To Sales A/c",
						debit: 4000,
						credit: 4000,
						narration: "Being rectification of credit sale wrongly debited to Purchases.",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "In the market diagram, identify the segment representing excess supply at the imposed price floor.",
		topicKeywords: ["price floor", "market intervention", "excess supply"],
		visual: {
			caption: "Demand-supply diagram with a binding price floor.",
			altText:
				"Demand and supply curves with a horizontal price-floor line above equilibrium, creating a gap between quantity supplied and quantity demanded.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity",
				yLabel: "Price (₹)",
				xMin: 0,
				xMax: 120,
				yMin: 0,
				yMax: 100,
				curves: [
					{ expr: "90 - 0.5 * p", color: "primary", label: "Demand" },
					{ expr: "0.6 * p + 5", color: "secondary", label: "Supply" },
					{ expr: "65", color: "muted", label: "Price floor" },
				],
				marks: [{ x: 58, y: 65, label: "Excess supply" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the budget line shown to identify one affordable consumption bundle.",
		topicKeywords: ["budget line", "consumer choice", "microeconomics"],
		visual: {
			caption: "Budget line between two goods with intercepts on both axes.",
			altText:
				"Straight downward budget line joining maximum quantities of two goods purchasable with fixed income; axis intercepts marked.",
			spec: {
				kind: "economics_curve",
				xLabel: "Good X (units)",
				yLabel: "Good Y (units)",
				xMin: 0,
				xMax: 60,
				yMin: 0,
				yMax: 80,
				curves: [{ expr: "72 - 1.2 * p", color: "primary", label: "Budget line" }],
				marks: [{ x: 20, y: 48, label: "Bundle A" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Read the factual passage and choose the statement best supported by the data in it.",
		topicKeywords: ["reading comprehension", "factual passage", "english prose"],
		visual: {
			caption: "Factual passage with two short paragraphs.",
			altText:
				"Informational prose passage describing urban water usage trends and conservation measures in concise academic style.",
			spec: {
				kind: "english_passage",
				title: "Urban Water Use Snapshot",
				source: null,
				lines: [
					{
						number: 1,
						text: "City records show domestic water demand rose by 8% over five years.",
					},
					{
						number: 2,
						text: "Leakage losses fell after pipeline audits in the same period.",
					},
					{
						number: 3,
						text: "Households using low-flow fixtures consumed less water per person.",
					},
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "From the dialogue excerpt, infer the speaker’s attitude in line 3.",
		topicKeywords: ["dialogue", "tone", "english language"],
		visual: {
			caption: "Short dialogue excerpt for tone inference.",
			altText:
				"Conversation between two speakers with stage-like line breaks, suitable for tone and intent analysis questions.",
			spec: {
				kind: "english_passage",
				title: "After the Announcement",
				source: null,
				lines: [
					{ number: 1, text: "Riya: You sounded certain this plan would fail." },
					{
						number: 2,
						text: "Kabir: I did, but the numbers changed after the trial run.",
					},
					{
						number: 3,
						text: "Riya: So now you're cautiously optimistic?",
					},
					{
						number: 4,
						text: "Kabir: Optimistic, yes—cautious, definitely.",
					},
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Classify each organism in the table into vertebrate or invertebrate.",
		topicKeywords: ["classification", "biology basics", "science table"],
		visual: {
			caption: "Classification table for selected organisms.",
			altText:
				"Three-column table listing organism name, key trait, and body organization to support vertebrate-invertebrate classification.",
			spec: {
				kind: "data_table",
				caption: "Organism classification",
				headers: ["Organism", "Key trait", "Group hint"],
				rows: [
					[
						{ value: "Earthworm", bold: false, align: "left" },
						{ value: "No backbone", bold: false, align: "left" },
						{ value: "Segmented body", bold: false, align: "left" },
					],
					[
						{ value: "Frog", bold: false, align: "left" },
						{ value: "Backbone present", bold: false, align: "left" },
						{ value: "Amphibian", bold: false, align: "left" },
					],
					[
						{ value: "Octopus", bold: false, align: "left" },
						{ value: "Soft body", bold: false, align: "left" },
						{ value: "Mollusc", bold: false, align: "left" },
					],
				],
			},
		},
		subjects: ["science", "biology"],
	},
];
