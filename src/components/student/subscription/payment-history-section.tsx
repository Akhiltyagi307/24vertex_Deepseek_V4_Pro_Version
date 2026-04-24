import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupees } from "@/lib/billing/plans";

export type PaymentHistoryRow = {
	id: string;
	amount_paise: number;
	currency: string;
	status: string;
	method: string | null;
	invoice_short_url: string | null;
	created_at: string;
};

function statusMeta(status: string): {
	label: string;
	variant: "default" | "secondary" | "destructive" | "outline";
} {
	const normalized = status.trim().toLowerCase();
	switch (normalized) {
		case "captured":
		case "paid":
		case "authorized":
			return { label: "Paid", variant: "default" };
		case "created":
		case "pending":
		case "processing":
			return { label: "Pending", variant: "secondary" };
		case "failed":
		case "cancelled":
			return { label: "Failed", variant: "destructive" };
		case "refunded":
		case "partial_refund":
			return { label: "Refunded", variant: "outline" };
		default:
			return {
				label: normalized.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
				variant: "outline",
			};
	}
}

function formatMethod(method: string | null): string {
	if (!method) return "\u2014";
	return method.replaceAll("_", " ").toUpperCase();
}

function SkeletonEmptyState() {
	const rows = 3;
	return (
		<Card className="gap-0">
			<CardHeader className="border-b">
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="text-base">Receipts will appear here</CardTitle>
					<span className="text-xs text-muted-foreground">After your first charge</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="overflow-x-auto" aria-hidden>
					<table className="w-full min-w-[38rem] text-sm">
						<thead className="bg-muted/40 text-left">
							<tr>
								{["Date", "Amount", "Status", "Method", "Receipt"].map((h) => (
									<th key={h} className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{Array.from({ length: rows }).map((_, i) => (
								<tr key={i} className="border-t border-dashed border-border/70">
									<td className="px-3 py-3">
										<div className="h-2 w-20 rounded bg-muted/70" />
									</td>
									<td className="px-3 py-3">
										<div className="h-2 w-16 rounded bg-muted/70 tabular-nums" />
									</td>
									<td className="px-3 py-3">
										<div className="h-4 w-14 rounded-full bg-muted/60" />
									</td>
									<td className="px-3 py-3">
										<div className="h-2 w-10 rounded bg-muted/70" />
									</td>
									<td className="px-3 py-3">
										<div className="h-2 w-16 rounded bg-muted/70" />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
					Paid plans bill via Razorpay. Invoices arrive by email and show here within a few minutes.
				</p>
			</CardContent>
		</Card>
	);
}

export function PaymentHistorySection({ payments }: { payments: PaymentHistoryRow[] }) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
				<h2 className="font-heading text-lg font-medium">Payment history</h2>
			</div>

			{payments.length === 0 ? (
				<SkeletonEmptyState />
			) : (
				<Card className="gap-0">
					<CardHeader className="border-b">
						<CardTitle className="text-base">Recent transactions</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[38rem] text-sm">
								<thead className="bg-muted/50 text-left">
									<tr>
										<th className="px-3 py-2.5 font-medium">Date</th>
										<th className="px-3 py-2.5 font-medium">Amount</th>
										<th className="px-3 py-2.5 font-medium">Status</th>
										<th className="px-3 py-2.5 font-medium">Method</th>
										<th className="px-3 py-2.5 font-medium">Receipt</th>
									</tr>
								</thead>
								<tbody>
									{payments.map((payment) => {
										const meta = statusMeta(payment.status);
										return (
											<tr key={payment.id} className="border-t border-border/80 hover:bg-muted/30">
												<td className="px-3 py-2.5">
													{new Date(payment.created_at).toLocaleDateString("en-IN", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
												</td>
												<td className="px-3 py-2.5 font-medium tabular-nums">
													{payment.currency === "INR"
														? formatRupees(payment.amount_paise)
														: `${payment.amount_paise / 100} ${payment.currency}`}
												</td>
												<td className="px-3 py-2.5">
													<Badge variant={meta.variant}>{meta.label}</Badge>
												</td>
												<td className="px-3 py-2.5 text-muted-foreground tabular-nums">
													{formatMethod(payment.method)}
												</td>
												<td className="px-3 py-2.5">
													{payment.invoice_short_url ? (
														<a
															href={payment.invoice_short_url}
															target="_blank"
															rel="noopener noreferrer"
															className="text-primary underline underline-offset-4"
														>
															View receipt
														</a>
													) : (
														<span className="text-muted-foreground">{"\u2014"}</span>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}
		</section>
	);
}
