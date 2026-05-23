import { cn } from "@/lib/utils";

export type MarketingComparisonRow = {
	label: string;
	vertex: string;
	other: string;
};

type MarketingComparisonTableProps = {
	otherBrand: string;
	rows: MarketingComparisonRow[];
	className?: string;
};

export function MarketingComparisonTable({
	otherBrand,
	rows,
	className,
}: MarketingComparisonTableProps) {
	return (
		<div
			className={cn(
				"border-border/60 overflow-x-auto rounded-xl border bg-card",
				className,
			)}
		>
			<table className="w-full min-w-[32rem] text-left text-sm">
				<thead>
					<tr className="border-border/60 border-b bg-muted/20">
						<th scope="col" className="px-4 py-3 font-semibold text-foreground medium:px-6">
							Topic
						</th>
						<th scope="col" className="px-4 py-3 font-semibold text-foreground medium:px-6">
							24Vertex
						</th>
						<th scope="col" className="px-4 py-3 font-semibold text-foreground medium:px-6">
							{otherBrand}
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.label} className="border-border/40 border-b last:border-0">
							<th
								scope="row"
								className="text-muted-foreground px-4 py-3 font-medium medium:px-6"
							>
								{row.label}
							</th>
							<td className="px-4 py-3 text-foreground medium:px-6">{row.vertex}</td>
							<td className="px-4 py-3 text-muted-foreground medium:px-6">{row.other}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
