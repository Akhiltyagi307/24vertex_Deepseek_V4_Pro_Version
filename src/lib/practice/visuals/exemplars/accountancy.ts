import type { VisualExemplar } from "../exemplars-type";

export const ACCOUNTANCY_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// ACCOUNTANCY
	// ───────────────────────────────────────────────────────────────────────
	// Practice routing (`preferredVisualKindsForSubject`): only `accountancy_table`.
	// SubKinds: journal_entry, ledger, trial_balance, balance_sheet, p_and_l,
	// cash_book, rectification. Stratification uses row/particulars fingerprints so
	// several journals or cash books can surface in one exemplar pick.
	{
		stem: "Which accounting concept requires a business to record its owner’s personal transactions separately from the business?",
		topicKeywords: ["business entity", "accounting concepts", "separate entity"],
		visual: null,
		subjects: ["accountancy"],
	},
	{
		stem: "Complete the journal entry for purchase of furniture for ₹15,000 cash on 1 April 2026 using the skeleton below.",
		topicKeywords: ["journal entry", "debit credit", "asset purchase"],
		visual: {
			caption: "Blank journal entry form for a furniture purchase.",
			altText:
				"Columns for date, particulars, debit, and credit; the accounts to be debited and credited are shown with blank amount cells.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-01",
						particulars: "Furniture A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Post the following transactions to the Cash Account shown and balance it: (i) Received ₹20,000 from Rohan; (ii) Paid ₹8,000 rent.",
		topicKeywords: ["cash account", "ledger posting", "t account", "balancing"],
		visual: {
			caption: "Cash Account (T-form) with opening balance of ₹5,000.",
			altText:
				"Ledger in T-format with debit side showing the opening balance; credit side is blank for the student to post transactions and balance the account.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Cash Account",
					debitSide: [
						{ date: "2026-04-01", particulars: "To Balance b/d", amount: 5000 },
					],
					creditSide: [],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "The trial balance below contains an error on one side. Identify the account whose balance is incorrectly placed.",
		topicKeywords: ["trial balance", "detecting errors", "debit credit"],
		visual: {
			caption: "Trial balance as on 31 March 2026.",
			altText:
				"Three-row trial balance with columns for particulars, debit, and credit; one entry appears on the wrong side.",
			spec: {
				kind: "accountancy_table",
				subKind: "trial_balance",
				rows: [
					{ particulars: "Capital A/c", debit: null, credit: 50000 },
					{ particulars: "Furniture A/c", debit: 20000, credit: null },
					{ particulars: "Bank A/c", debit: null, credit: 30000 },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Using the balance sheet shown, calculate the current ratio (Current Assets / Current Liabilities).",
		topicKeywords: ["balance sheet", "current ratio", "liquidity", "financial analysis"],
		visual: {
			caption: "Abbreviated balance sheet as on 31 March 2026.",
			altText:
				"Two-sided balance sheet; assets side lists furniture, debtors, and cash; equity and liabilities side lists capital and creditors with totals.",
			spec: {
				kind: "accountancy_table",
				subKind: "balance_sheet",
				assetsSide: [
					{ particulars: "Non-Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Furniture", amount: 20000, indent: 1, bold: false },
					{ particulars: "Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Debtors", amount: 10000, indent: 1, bold: false },
					{ particulars: "Cash and Bank", amount: 5000, indent: 1, bold: false },
					{ particulars: "Total Assets", amount: 35000, indent: 0, bold: true },
				],
				equityAndLiabilitiesSide: [
					{ particulars: "Equity", amount: null, indent: 0, bold: true },
					{ particulars: "Capital", amount: 30000, indent: 1, bold: false },
					{ particulars: "Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Creditors", amount: 5000, indent: 1, bold: false },
					{ particulars: "Total Equity & Liabilities", amount: 35000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "From the P&L account shown, calculate the net profit ratio (Net Profit / Net Sales x 100).",
		topicKeywords: ["profit and loss", "ratio analysis", "net profit ratio", "profitability"],
		visual: {
			caption: "Profit and Loss Account for the year ending 31 March 2026.",
			altText:
				"P&L statement with sales revenue at the top; expenses including cost of goods sold, rent, and salaries are deducted; net profit is shown at the bottom.",
			spec: {
				kind: "accountancy_table",
				subKind: "p_and_l",
				rows: [
					{ particulars: "Revenue from Operations (Sales)", amount: 100000, indent: 0, bold: true },
					{ particulars: "Less: Cost of Goods Sold", amount: 60000, indent: 1, bold: false },
					{ particulars: "Gross Profit", amount: 40000, indent: 0, bold: true },
					{ particulars: "Less: Rent", amount: 12000, indent: 1, bold: false },
					{ particulars: "Less: Salaries", amount: 15000, indent: 1, bold: false },
					{ particulars: "Net Profit", amount: 13000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Balance the cash book shown by inserting the missing closing balance on 31 March.",
		topicKeywords: ["cash book", "triple column intuition", "balancing", "bookkeeping"],
		visual: {
			caption: "Simple cash book for March 2026 with closing balance missing.",
			altText:
				"Cash book with two receipt entries and two payment entries; the closing balance entry has blank debit and credit cells.",
			spec: {
				kind: "accountancy_table",
				subKind: "cash_book",
				rows: [
					{ date: "2026-03-01", particulars: "To Balance b/d", debit: 10000, credit: null, narration: null },
					{ date: "2026-03-10", particulars: "To Sales", debit: 25000, credit: null, narration: null },
					{ date: "2026-03-05", particulars: "By Purchases", debit: null, credit: 15000, narration: null },
					{ date: "2026-03-20", particulars: "By Rent", debit: null, credit: 8000, narration: null },
					{ date: "2026-03-31", particulars: "By Balance c/d", debit: null, credit: null, narration: null },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Wages paid ₹3,000 were not posted to the Wages Account. Pass the rectification entry using the skeleton below.",
		topicKeywords: ["rectification", "journal entry", "error correction", "adjustment"],
		visual: {
			caption: "Rectification journal entry skeleton for a posting omission.",
			altText:
				"Journal entry form showing the accounts to be debited and credited; the debit and credit amount cells are blank for the student to fill in.",
			spec: {
				kind: "accountancy_table",
				subKind: "rectification",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Wages A/c           Dr.",
						debit: null,
						credit: null,
						narration: "(Being omission of wages posting corrected)",
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Record credit purchases of goods worth ₹48,000 from Apex Suppliers on 8 April 2026 using the journal skeleton.",
		topicKeywords: ["credit purchase", "journal entry", "trade payable"],
		visual: {
			caption: "Journal voucher skeleton — purchases on credit.",
			altText:
				"Journal columns with particulars naming Purchases as debit and Apex Suppliers as credit; amount cells empty.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-08",
						particulars: "Purchases A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Apex Suppliers A/c",
						debit: null,
						credit: null,
						narration: "(Being goods purchased on credit)",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Bad debts of ₹7,500 are written off against Mehta Stores on 25 March 2026. Complete the journal skeleton.",
		topicKeywords: ["bad debts", "write off", "debtors", "journal"],
		visual: {
			caption: "Journal voucher skeleton — bad debts written off.",
			altText:
				"Debit line names Bad Debts Account; credit line names debtor Mehta Stores; monetary amounts omitted.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-03-25",
						particulars: "Bad Debts A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Mehta Stores A/c",
						debit: null,
						credit: null,
						narration: "(Being bad debts written off)",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Enter cash drawings ₹12,000 by the proprietor on 14 June and balance the cash ledger excerpt shown.",
		topicKeywords: ["drawings", "capital", "cash ledger", "posting"],
		visual: {
			caption: "Cash Account ledger excerpt after routine receipts and payments.",
			altText:
				"T-format ledger named Cash Account with debit entries To Capital introduced and To Cash Sales; credit entries By Rent and By Electricity already posted.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Cash Account",
					debitSide: [
						{ date: "2026-06-01", particulars: "To Balance b/d", amount: 8000 },
						{ date: "2026-06-05", particulars: "To Capital A/c", amount: 40000 },
						{ date: "2026-06-12", particulars: "To Sales A/c", amount: 22000 },
					],
					creditSide: [
						{ date: "2026-06-07", particulars: "By Rent A/c", amount: 6000 },
						{ date: "2026-06-09", particulars: "By Electricity A/c", amount: 3500 },
					],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Prepare debtors control postings from the trial balance extract — verify debit equals credit totals.",
		topicKeywords: ["trial balance", "financial statements prelude", "arithmetic accuracy"],
		visual: {
			caption: "Trial balance extract before preparing financial statements.",
			altText:
				"Six ledger balances with debit column Machinery, Debtors, Cash and credit column Capital, Creditors, Sales.",
			spec: {
				kind: "accountancy_table",
				subKind: "trial_balance",
				rows: [
					{ particulars: "Machinery A/c", debit: 80000, credit: null },
					{ particulars: "Trade Debtors A/c", debit: 22000, credit: null },
					{ particulars: "Cash A/c", debit: 13000, credit: null },
					{ particulars: "Capital A/c", debit: null, credit: 90000 },
					{ particulars: "Trade Creditors A/c", debit: null, credit: 14000 },
					{ particulars: "Sales A/c", debit: null, credit: 11000 },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Compute debt-to-equity using only long-term borrowings and owners equity from the abbreviated balance sheet.",
		topicKeywords: ["capital structure", "debt equity ratio", "balance sheet ratios"],
		visual: {
			caption: "Abbreviated balance sheet including bank loan (non-current).",
			altText:
				"Assets split non-current machinery and current inventory debtors cash; liabilities split equity capital retained earnings bank loan and trade creditors.",
			spec: {
				kind: "accountancy_table",
				subKind: "balance_sheet",
				assetsSide: [
					{ particulars: "Non-Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Machinery", amount: 85000, indent: 1, bold: false },
					{ particulars: "Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Inventory", amount: 21000, indent: 1, bold: false },
					{ particulars: "Trade Debtors", amount: 14000, indent: 1, bold: false },
					{ particulars: "Cash and Bank", amount: 9000, indent: 1, bold: false },
					{ particulars: "Total Assets", amount: 129000, indent: 0, bold: true },
				],
				equityAndLiabilitiesSide: [
					{ particulars: "Equity", amount: null, indent: 0, bold: true },
					{ particulars: "Share Capital", amount: 60000, indent: 1, bold: false },
					{ particulars: "Retained Earnings", amount: 18000, indent: 1, bold: false },
					{ particulars: "Non-Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Bank Loan", amount: 27000, indent: 1, bold: false },
					{ particulars: "Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Creditors", amount: 24000, indent: 1, bold: false },
					{ particulars: "Total Equity & Liabilities", amount: 129000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "From the statement shown, determine operating profit before interest using only the labelled lines.",
		topicKeywords: ["profit and loss", "operating profit", "finance cost", "financial statement"],
		visual: {
			caption: "Profit and Loss Account — revenue through operating profit.",
			altText:
				"Income statement listing revenue, cost of goods sold, gross profit, operating expenses including depreciation, operating profit, interest expense, and profit before tax.",
			spec: {
				kind: "accountancy_table",
				subKind: "p_and_l",
				rows: [
					{ particulars: "Revenue from Operations", amount: 182000, indent: 0, bold: true },
					{ particulars: "Less: Cost of Goods Sold", amount: 92000, indent: 1, bold: false },
					{ particulars: "Gross Profit", amount: 90000, indent: 0, bold: true },
					{ particulars: "Less: Salaries & Wages", amount: 28000, indent: 1, bold: false },
					{ particulars: "Less: Rent & Rates", amount: 9000, indent: 1, bold: false },
					{ particulars: "Less: Depreciation", amount: 5200, indent: 1, bold: false },
					{ particulars: "Operating Profit", amount: 47800, indent: 0, bold: true },
					{ particulars: "Less: Interest on Loan", amount: 3800, indent: 1, bold: false },
					{ particulars: "Profit Before Tax", amount: 44000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Insert the balancing figures so debits equal credits for March’s cash book before ledger posting.",
		topicKeywords: ["cash book", "balancing totals", "arithmetic drill"],
		visual: {
			caption: "Cash book — receipts from debtor and capital injection.",
			altText:
				"Cash book rows include debit receipt from debtor Sunil Traders and capital introduced by proprietor; payments include salaries and bank deposit.",
			spec: {
				kind: "accountancy_table",
				subKind: "cash_book",
				rows: [
					{ date: "2026-03-01", particulars: "To Balance b/d", debit: 15000, credit: null, narration: null },
					{ date: "2026-03-04", particulars: "To Capital A/c", debit: 50000, credit: null, narration: null },
					{ date: "2026-03-08", particulars: "To Sunil Traders A/c", debit: 33000, credit: null, narration: null },
					{ date: "2026-03-12", particulars: "By Salaries A/c", debit: null, credit: 22000, narration: null },
					{ date: "2026-03-18", particulars: "By Bank A/c", debit: null, credit: 38000, narration: null },
					{ date: "2026-03-31", particulars: "By Balance c/d", debit: null, credit: null, narration: null },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Rent paid ₹9,000 was wrongly debited to Rates Expense. Pass one compound journal entry to correct using the skeleton.",
		topicKeywords: ["rectification", "compound entry", "nominal accounts"],
		visual: {
			caption: "Rectification skeleton — mis-post between nominal accounts.",
			altText:
				"Debit Rent Account credit Rates Expense Account lines with narration referencing correction of mis-posting.",
			spec: {
				kind: "accountancy_table",
				subKind: "rectification",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Rent A/c               Dr.",
						debit: null,
						credit: null,
						narration: "(Being rent wrongly charged to Rates — corrected)",
					},
					{
						date: "",
						particulars: "    To Rates Expense A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
];
