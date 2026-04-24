import Link from "next/link";
import { FileTextIcon, ShieldCheckIcon, SmartphoneIcon, XCircleIcon } from "lucide-react";

type Item = {
	label: React.ReactNode;
	icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

export function BillingTrustRow() {
	const items: Item[] = [
		{ label: "Razorpay secure checkout", icon: ShieldCheckIcon },
		{ label: "UPI Autopay & cards", icon: SmartphoneIcon },
		{ label: "Cancel anytime", icon: XCircleIcon },
		{
			label: (
				<Link
					href="/legal/refund"
					className="underline-offset-4 hover:text-foreground hover:underline"
				>
					Refund policy
				</Link>
			),
			icon: FileTextIcon,
		},
	];

	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
			{items.map((item, i) => {
				const Icon = item.icon;
				return (
					<div key={i} className="flex items-center gap-1.5">
						<Icon className="size-3.5 text-primary/80" aria-hidden />
						<span>{item.label}</span>
					</div>
				);
			})}
		</div>
	);
}
