"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelAtPeriodEnd } from "../../../../app/student/subscription/actions";

export function CancelSubscriptionButton({
	disabled,
	billingProfileId,
}: {
	disabled?: boolean;
	/** When set, POST /api/billing/cancel as parent for this student profile. */
	billingProfileId?: string;
}) {
	const [pending, startTransition] = React.useTransition();
	const [confirmOpen, setConfirmOpen] = React.useState(false);
	const titleId = React.useId();
	const descriptionId = React.useId();
	const router = useRouter();

	function onConfirmCancel() {
		startTransition(async () => {
			if (billingProfileId) {
				const res = await fetch("/api/billing/cancel", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ billingProfileId }),
				});
				const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
				if (res.ok && data.ok) {
					setConfirmOpen(false);
					toast.success(
						"The subscription will end at the current period. Your child keeps access until then.",
					);
					router.refresh();
				} else {
					toast.error(data.message ?? "Could not cancel.");
				}
				return;
			}
			const res = await cancelAtPeriodEnd();
			if (res.ok) {
				setConfirmOpen(false);
				toast.success("Your subscription will end at the current period. Access is preserved until then.");
				router.refresh();
			} else {
				toast.error(res.message);
			}
		});
	}

	return (
		<>
			<Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={disabled || pending}>
				{pending ? "Cancelling…" : "Cancel subscription"}
			</Button>

			<Dialog.Root
				open={confirmOpen}
				onOpenChange={(open) => {
					if (pending) return;
					setConfirmOpen(open);
				}}
			>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border bg-popover p-6 text-popover-foreground shadow-xl",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-3 right-3"
							onClick={() => setConfirmOpen(false)}
							disabled={pending}
							aria-label="Close"
						>
							<XIcon />
						</Button>
						<div className="flex flex-col gap-2 pe-8">
							<Dialog.Title id={titleId} className="font-heading text-xl font-semibold tracking-tight">
								Cancel subscription?
							</Dialog.Title>
							<Dialog.Description id={descriptionId} className="text-sm text-muted-foreground">
								{billingProfileId
									? "The student keeps full access until the period already paid for ends. You can turn renewal back on in Razorpay before that date if needed."
									: "Your plan will remain active until the current billing period ends. You can still renew again before that date."}
							</Dialog.Description>
						</div>
						<div className="flex flex-col-reverse gap-2 medium:flex-row medium:justify-end">
							<Button
								type="button"
								variant="outline"
								onClick={() => setConfirmOpen(false)}
								disabled={pending}
							>
								Keep subscription
							</Button>
							<Button
								type="button"
								variant="destructive"
								onClick={onConfirmCancel}
								disabled={pending}
							>
								{pending ? "Cancelling…" : "Cancel at period end"}
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
}
