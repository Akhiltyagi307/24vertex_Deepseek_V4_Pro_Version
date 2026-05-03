"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaywallReason =
	| "quota_tests"
	| "quota_tokens"
	| "trial_expired"
	| "expired"
	| "past_due"
	| "no_subscription";

export type PaywallPayload = {
	reason: PaywallReason;
	message?: string;
	/** Hint for where the paywall fired (practice/doubt). */
	surface?: "practice" | "doubt_chat";
};

type PaywallContextValue = {
	show: (payload: PaywallPayload) => void;
	close: () => void;
};

const PaywallContext = React.createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
	const ctx = React.useContext(PaywallContext);
	if (!ctx) {
		// No-op fallback so callers outside the provider don't crash.
		return {
			show: () => {},
			close: () => {},
		};
	}
	return ctx;
}

const HEADINGS: Record<PaywallReason, string> = {
	quota_tests: "You've used all your practice tests for this period",
	quota_tokens: "You've used all your AI output tokens for doubt chat this period",
	trial_expired: "Your free trial has ended",
	expired: "Your subscription is not active",
	past_due: "We couldn't collect your last payment",
	no_subscription: "Subscribe to continue",
};

const DEFAULT_MESSAGES: Record<PaywallReason, string> = {
	quota_tests: "Upgrade to Pro to unlock up to 30 tests per month (12× on the annual plan).",
	quota_tokens:
		"Upgrade to Pro for up to 400k AI output tokens per month for doubt chat (more for grades 11–12).",
	trial_expired: "Your 14-day trial is up. Choose a Pro plan to keep practising.",
	expired: "Pick a plan to re-activate EduAI and continue where you left off.",
	past_due: "Update your payment method on the subscription page to restore access.",
	no_subscription: "Pick a plan to start generating practice tests and chatting with the AI tutor.",
};

export function PaywallProvider({ children }: { children: React.ReactNode }) {
	const [payload, setPayload] = React.useState<PaywallPayload | null>(null);
	const value = React.useMemo<PaywallContextValue>(
		() => ({
			show: (p) => setPayload(p),
			close: () => setPayload(null),
		}),
		[],
	);
	const open = payload != null;
	const reason = payload?.reason ?? "no_subscription";
	const title = HEADINGS[reason];
	const description = payload?.message ?? DEFAULT_MESSAGES[reason];

	return (
		<PaywallContext.Provider value={value}>
			{children}
			<Dialog.Root open={open} onOpenChange={(o) => !o && setPayload(null)}>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[min(calc(100vw-2rem),30rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border bg-popover p-6 text-popover-foreground shadow-xl medium:gap-5 medium:p-7",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-3 right-3"
							onClick={() => setPayload(null)}
							aria-label="Close"
						>
							<XIcon />
						</Button>
						<div className="flex items-center gap-2 text-primary">
							<div className="grid size-9 place-items-center rounded-lg bg-primary/10">
								<SparklesIcon className="size-4" />
							</div>
							<span className="font-mono text-2xs uppercase tracking-wider">Upgrade needed</span>
						</div>
						<Dialog.Title className="font-heading text-xl font-semibold leading-snug text-foreground medium:text-2xl">
							{title}
						</Dialog.Title>
						<Dialog.Description className="text-sm text-muted-foreground">
							{description}
						</Dialog.Description>
						<div className="flex flex-col gap-2 medium:flex-row medium:justify-end">
							<Button variant="outline" onClick={() => setPayload(null)}>
								Maybe later
							</Button>
							<Button render={<Link href="/student/subscription" />}>
								See plans
								<ArrowRightIcon />
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</PaywallContext.Provider>
	);
}
