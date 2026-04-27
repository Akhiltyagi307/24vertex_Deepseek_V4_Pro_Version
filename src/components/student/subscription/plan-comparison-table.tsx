import { CheckIcon, MinusIcon } from "lucide-react";

import { PLAN_CATALOG, type PlanCode } from "@/lib/billing/plans";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
	currentPlanCode: PlanCode;
	grade: number | null;
	/** When set (e.g. from server `getCachedPlanCatalog`), uses one cached catalog path. */
	planCatalog?: typeof PLAN_CATALOG;
};

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}\u00A0M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}\u00A0k`;
	return n.toLocaleString("en-IN");
}

function formatRupeesRounded(paise: number): string {
	const rupees = Math.round(paise / 100);
	return `\u20B9\u00A0${rupees.toLocaleString("en-IN")}`;
}

function Check() {
	return <CheckIcon className="size-4 text-primary" aria-label="Included" />;
}
function Dash() {
	return (
		<MinusIcon className="size-4 text-muted-foreground/50" aria-label="Not included" />
	);
}

type Row = {
	label: string;
	values: [React.ReactNode, React.ReactNode, React.ReactNode];
	highlight?: boolean;
};

export function PlanComparisonTable({ currentPlanCode, grade, planCatalog = PLAN_CATALOG }: Props) {
	const free = planCatalog.free;
	const monthly = planCatalog.pro_monthly;
	const annual = planCatalog.pro_annual;
	const isSenior = grade != null && grade >= 11;

	const freeTokens = isSenior ? free.tokensGrade11to12 : free.tokensGrade6to10;
	const monthlyTokens = isSenior ? monthly.tokensGrade11to12 : monthly.tokensGrade6to10;
	const annualTokens = isSenior ? annual.tokensGrade11to12 : annual.tokensGrade6to10;

	const monthlyPerTestPaise = monthly.pricePaise / monthly.testsPerPeriod;
	const annualPerTestPaise = annual.pricePaise / annual.testsPerPeriod;

	const rows: Row[] = [
		{
			label: "Practice tests",
			values: [
				<span key="v" className="tabular-nums">{`${free.testsPerPeriod} total`}</span>,
				<span key="v" className="tabular-nums">{`${monthly.testsPerPeriod} / month`}</span>,
				<span key="v" className="tabular-nums">{`${annual.testsPerPeriod} / year`}</span>,
			],
		},
		{
			label: "AI output tokens (doubt chat)",
			values: [
				<span key="v" className="tabular-nums">{`${formatTokens(freeTokens)}`}</span>,
				<span key="v" className="tabular-nums">{`${formatTokens(monthlyTokens)} / month`}</span>,
				<span key="v" className="tabular-nums">{`${formatTokens(annualTokens)} / year`}</span>,
			],
		},
		{
			label: "Priority doubt-chat",
			values: [<Dash key="v" />, <Check key="v" />, <Check key="v" />],
		},
		{
			label: "Billing cadence",
			values: [
				<span key="v" className="text-muted-foreground">No card required</span>,
				<span key="v">Monthly mandate</span>,
				<span key="v">Once a year</span>,
			],
		},
		{
			label: "Effective price / test",
			highlight: true,
			values: [
				<span key="v" className="text-muted-foreground">{"\u2014"}</span>,
				<span key="v" className="tabular-nums">{formatRupeesRounded(monthlyPerTestPaise)}</span>,
				<span key="v" className="font-medium tabular-nums text-primary">
					{formatRupeesRounded(annualPerTestPaise)}
				</span>,
			],
		},
	];

	const headerCell = (label: string, code: PlanCode) => (
		<th
			scope="col"
			className={cn(
				"px-3 py-2.5 text-left text-xs font-medium text-muted-foreground",
				currentPlanCode === code ? "text-primary" : "",
			)}
		>
			<div className="flex items-center gap-1.5">
				<span>{label}</span>
				{currentPlanCode === code ? (
					<span
						aria-hidden
						className="inline-block size-1.5 rounded-full bg-primary"
					/>
				) : null}
			</div>
		</th>
	);

	return (
		<details className={cn(cardSurfaceFrameClassName, "group")} open>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground marker:hidden">
				<span>See how the plans compare</span>
				<span
					aria-hidden
					className="text-xs text-muted-foreground transition-transform group-open:rotate-180"
				>
					&#x25BE;
				</span>
			</summary>
			<div className="overflow-x-auto border-t">
				<table className="w-full min-w-[36rem] border-separate border-spacing-0 text-sm">
					<thead>
						<tr className="bg-muted/40">
							<th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
								Capability
							</th>
							{headerCell("Free trial", "free")}
							{headerCell("Pro Monthly", "pro_monthly")}
							{headerCell("Pro Annual", "pro_annual")}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, idx) => (
							<tr
								key={row.label}
								className={cn(
									idx > 0 ? "[&>td]:border-t" : "",
									row.highlight ? "bg-primary/[0.03]" : "",
								)}
							>
								<th
									scope="row"
									className="px-3 py-2.5 text-left align-middle text-sm font-medium text-foreground"
								>
									{row.label}
								</th>
								{row.values.map((v, i) => (
									<td key={i} className="px-3 py-2.5 align-middle text-sm text-foreground">
										{v}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}
