"use client";

import * as React from "react";

import { LatexText } from "../../latex-text";
import { cn } from "@/lib/utils";
import type { AccountancyTableSpec } from "@/lib/practice/visuals/types";

/**
 * `accountancy_table` renderer.
 *
 * Format conventions are half the marks for board-exam Accountancy. We
 * render seven sub-kinds:
 *   - journal_entry  — Date / Particulars / Debit / Credit columns
 *   - ledger         — two-column T-account
 *   - trial_balance  — Particulars / Debit / Credit
 *   - balance_sheet  — Assets vs Equity & Liabilities, side-by-side
 *   - p_and_l        — Particulars / Amount, supports indent + bold
 *   - cash_book      — same shape as journal entry
 *   - rectification  — same shape as journal entry
 *
 * Money is formatted with Indian numbering (₹1,00,000 for one lakh) so
 * the schema can keep numbers as plain integers without symbols. The
 * model is told in the prompt to emit unformatted amounts.
 */
export function AccountancyTable({
	spec,
}: {
	spec: AccountancyTableSpec;
}): React.ReactElement {
	switch (spec.subKind) {
		case "journal_entry":
		case "cash_book":
		case "rectification":
			return <JournalLikeTable spec={spec} />;
		case "ledger":
			return <LedgerTable spec={spec} />;
		case "trial_balance":
			return <TrialBalanceTable spec={spec} />;
		case "balance_sheet":
			return <BalanceSheetTable spec={spec} />;
		case "p_and_l":
			return <ProfitLossTable spec={spec} />;
	}
}

const tableBase =
	"w-full max-w-[640px] border-collapse text-sm tabular-nums [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1";

function JournalLikeTable({
	spec,
}: {
	spec: Extract<
		AccountancyTableSpec,
		{ subKind: "journal_entry" | "cash_book" | "rectification" }
	>;
}): React.ReactElement {
	return (
		<table className={tableBase}>
			<thead>
				<tr>
					<th className="w-[18%]">Date</th>
					<th>Particulars</th>
					<th className="w-[14%] text-right">Debit (₹)</th>
					<th className="w-[14%] text-right">Credit (₹)</th>
				</tr>
			</thead>
			<tbody>
				{spec.rows.map((row, i) => (
					<React.Fragment key={`r-${i}`}>
						<tr>
							<td>
								<LatexText text={row.date} />
							</td>
							<td className="whitespace-pre-wrap">
								<LatexText text={row.particulars} />
							</td>
							<td className="text-right">{formatRupee(row.debit)}</td>
							<td className="text-right">{formatRupee(row.credit)}</td>
						</tr>
						{row.narration ? (
							<tr>
								<td />
								<td colSpan={3} className="text-muted-foreground italic text-xs">
									<LatexText text={row.narration} />
								</td>
							</tr>
						) : null}
					</React.Fragment>
				))}
			</tbody>
		</table>
	);
}

function LedgerTable({
	spec,
}: {
	spec: Extract<AccountancyTableSpec, { subKind: "ledger" }>;
}): React.ReactElement {
	const { ledger } = spec;
	const rowsCount = Math.max(ledger.debitSide.length, ledger.creditSide.length);
	return (
		<div className="w-full max-w-[640px]">
			<div className="text-foreground mb-1 text-center text-sm font-semibold">
				<LatexText text={`${ledger.accountName} A/c`} />
			</div>
			<table className={tableBase}>
				<thead>
					<tr>
						<th className="w-[12%]">Dr</th>
						<th>Particulars</th>
						<th className="w-[12%] text-right">₹</th>
						<th className="w-[12%]">Cr</th>
						<th>Particulars</th>
						<th className="w-[12%] text-right">₹</th>
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rowsCount }, (_, i) => {
						const dr = ledger.debitSide[i];
						const cr = ledger.creditSide[i];
						return (
							<tr key={`l-${i}`}>
								<td>
									<LatexText text={dr?.date ?? ""} />
								</td>
								<td>
									<LatexText text={dr?.particulars ?? ""} />
								</td>
								<td className="text-right">{dr ? formatRupee(dr.amount) : ""}</td>
								<td>
									<LatexText text={cr?.date ?? ""} />
								</td>
								<td>
									<LatexText text={cr?.particulars ?? ""} />
								</td>
								<td className="text-right">{cr ? formatRupee(cr.amount) : ""}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function TrialBalanceTable({
	spec,
}: {
	spec: Extract<AccountancyTableSpec, { subKind: "trial_balance" }>;
}): React.ReactElement {
	const totalDebit = spec.rows.reduce((s, r) => s + (r.debit ?? 0), 0);
	const totalCredit = spec.rows.reduce((s, r) => s + (r.credit ?? 0), 0);
	return (
		<table className={tableBase}>
			<thead>
				<tr>
					<th>Particulars</th>
					<th className="w-[16%] text-right">Debit (₹)</th>
					<th className="w-[16%] text-right">Credit (₹)</th>
				</tr>
			</thead>
			<tbody>
				{spec.rows.map((row, i) => (
					<tr key={`tb-${i}`}>
						<td>
							<LatexText text={row.particulars} />
						</td>
						<td className="text-right">{formatRupee(row.debit)}</td>
						<td className="text-right">{formatRupee(row.credit)}</td>
					</tr>
				))}
				<tr>
					<td className="text-right font-semibold">Total</td>
					<td className="text-right font-semibold">{formatRupee(totalDebit)}</td>
					<td className="text-right font-semibold">{formatRupee(totalCredit)}</td>
				</tr>
			</tbody>
		</table>
	);
}

function BalanceSheetTable({
	spec,
}: {
	spec: Extract<AccountancyTableSpec, { subKind: "balance_sheet" }>;
}): React.ReactElement {
	const total = (rows: typeof spec.assetsSide) =>
		rows.filter((r) => !r.bold).reduce((s, r) => s + (r.amount ?? 0), 0);
	const totalAssets = total(spec.assetsSide);
	const totalEqLiab = total(spec.equityAndLiabilitiesSide);
	return (
		<div className="w-full max-w-[640px] space-y-3">
			<table className={tableBase}>
				<thead>
					<tr>
						<th>Equity and Liabilities</th>
						<th className="w-[20%] text-right">₹</th>
					</tr>
				</thead>
				<tbody>
					{spec.equityAndLiabilitiesSide.map((row, i) => (
						<BalanceSheetRow key={`el-${i}`} row={row} />
					))}
					<tr>
						<td className="text-right font-semibold">Total</td>
						<td className="text-right font-semibold">{formatRupee(totalEqLiab)}</td>
					</tr>
				</tbody>
			</table>
			<table className={tableBase}>
				<thead>
					<tr>
						<th>Assets</th>
						<th className="w-[20%] text-right">₹</th>
					</tr>
				</thead>
				<tbody>
					{spec.assetsSide.map((row, i) => (
						<BalanceSheetRow key={`a-${i}`} row={row} />
					))}
					<tr>
						<td className="text-right font-semibold">Total</td>
						<td className="text-right font-semibold">{formatRupee(totalAssets)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

function ProfitLossTable({
	spec,
}: {
	spec: Extract<AccountancyTableSpec, { subKind: "p_and_l" }>;
}): React.ReactElement {
	return (
		<table className={tableBase}>
			<thead>
				<tr>
					<th>Particulars</th>
					<th className="w-[20%] text-right">₹</th>
				</tr>
			</thead>
			<tbody>
				{spec.rows.map((row, i) => (
					<BalanceSheetRow key={`pl-${i}`} row={row} />
				))}
			</tbody>
		</table>
	);
}

function BalanceSheetRow({
	row,
}: {
	row: { particulars: string; amount: number | null; indent: number; bold: boolean };
}): React.ReactElement {
	const indentPx = Math.min(row.indent, 3) * 16;
	return (
		<tr>
			<td
				className={cn("whitespace-pre-wrap", row.bold && "font-semibold")}
				style={{ paddingLeft: 8 + indentPx }}
			>
				<LatexText text={row.particulars} />
			</td>
			<td className={cn("text-right", row.bold && "font-semibold")}>
				{formatRupee(row.amount)}
			</td>
		</tr>
	);
}

/**
 * Indian-numbering rupee formatter. Returns the empty string for null
 * inputs so blank table cells are clean. Negative amounts are bracketed
 * per Indian accounting convention.
 */
function formatRupee(value: number | null): string {
	if (value == null) return "";
	const abs = Math.abs(value);
	const formatted = formatIndianNumber(abs);
	return value < 0 ? `(₹${formatted})` : `₹${formatted}`;
}

function formatIndianNumber(n: number): string {
	const fixed = n.toFixed(n % 1 === 0 ? 0 : 2);
	const [intPart, fracPart] = fixed.split(".");
	const safeInt = intPart ?? "0";
	const last3 = safeInt.slice(-3);
	const rest = safeInt.slice(0, -3);
	const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
	return fracPart ? `${grouped}.${fracPart}` : grouped;
}

export const __test = { formatRupee, formatIndianNumber };
