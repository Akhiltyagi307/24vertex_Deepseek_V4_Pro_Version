"use client";

import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

const AVATAR_1 =
	"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80";
const AVATAR_2 =
	"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80";
const AVATAR_3 =
	"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80";
const AVATAR_4 =
	"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";

export type Customer = {
	id: number | string;
	date: string;
	status: "Paid" | "Cancelled" | "Ref";
	statusVariant: "success" | "danger" | "warning";
	name: string;
	avatar: string;
	revenue: string;
};

export type CustomersTableCardProps = {
	title?: string;
	subtitle?: string;
	className?: string;
	customers?: Customer[];
};

const DEFAULT_CUSTOMERS: Customer[] = [
	{
		id: 1,
		date: "10/31/2023",
		status: "Paid",
		statusVariant: "success",
		name: "Bernard Ng",
		avatar: AVATAR_2,
		revenue: "$43.99",
	},
	{
		id: 2,
		date: "10/21/2023",
		status: "Ref",
		statusVariant: "warning",
		name: "Méschac Irung",
		avatar: AVATAR_1,
		revenue: "$19.99",
	},
	{
		id: 3,
		date: "10/15/2023",
		status: "Paid",
		statusVariant: "success",
		name: "Glodie Ng",
		avatar: AVATAR_3,
		revenue: "$99.99",
	},
	{
		id: 4,
		date: "10/12/2023",
		status: "Cancelled",
		statusVariant: "danger",
		name: "Theo Ng",
		avatar: AVATAR_4,
		revenue: "$19.99",
	},
];

const Badge = ({
	children,
	variant,
}: {
	children: React.ReactNode;
	variant: "success" | "danger" | "warning";
}) => {
	const styles =
		variant === "success"
			? "bg-lime-500/15 text-lime-800 dark:text-lime-300"
			: variant === "danger"
				? "bg-red-500/15 text-red-800 dark:text-red-300"
				: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300";

	return (
		<span className={cn("rounded-full px-2 py-1 text-xs font-medium", styles)}>{children}</span>
	);
};

export default function CustomersTableCard({
	title = "Customers",
	subtitle = "New users by First user primary channel group (Default Channel Group)",
	customers = DEFAULT_CUSTOMERS,
	className,
}: CustomersTableCardProps) {
	return (
		<section
			className={cn(
				"relative w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/40 shadow-none ring-1 ring-foreground/5 dark:bg-muted/25",
				className,
			)}
			aria-label={title}
		>
			<div className="space-y-1 p-6 pb-5">
				<div className="flex items-center gap-1.5">
					<span className="bg-muted size-2 rounded-full border border-black/5" />
					<span className="bg-muted size-2 rounded-full border border-black/5" />
					<span className="bg-muted size-2 rounded-full border border-black/5" />
				</div>
				<h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
				<p className="text-muted-foreground text-sm">{subtitle}</p>
			</div>

			<div className="overflow-x-auto">
				<table className="min-w-[640px] w-full border-collapse text-sm">
					<thead className="bg-muted/50 supports-[backdrop-filter]:backdrop-blur-sm sticky top-0 z-10">
						<tr className="text-muted-foreground *:text-left *:px-3 *:py-3 *:font-medium">
							<th className="w-12">#</th>
							<th className="min-w-[120px]">Date</th>
							<th className="min-w-[120px]">Status</th>
							<th className="min-w-[220px]">Customer</th>
							<th className="min-w-[120px] pr-4 text-right">Revenue</th>
						</tr>
					</thead>
					<tbody>
						{customers.map((customer, idx) => (
							<tr
								key={customer.id}
								className="hover:bg-muted/30 transition-colors *:px-3 *:py-2"
							>
								<td className="text-muted-foreground">{idx + 1}</td>
								<td className="whitespace-nowrap">{customer.date}</td>
								<td>
									<Badge variant={customer.statusVariant}>{customer.status}</Badge>
								</td>
								<td>
									<div className="flex items-center gap-2">
										<div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60">
											<Image
												src={customer.avatar}
												alt={customer.name}
												width={28}
												height={28}
												className="object-cover"
												sizes="28px"
											/>
										</div>
										<span className="text-foreground truncate font-medium">{customer.name}</span>
									</div>
								</td>
								<td className="pr-4 text-right font-medium tabular-nums">{customer.revenue}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between p-4 pt-3 text-xs text-muted-foreground">
				<span>
					Showing <strong>{customers.length}</strong> {customers.length === 1 ? "row" : "rows"}
				</span>
				<span>Updated just now</span>
			</div>
		</section>
	);
}
