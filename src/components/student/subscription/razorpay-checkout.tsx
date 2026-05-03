"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PlanCode } from "@/lib/billing/plans";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
	interface Window {
		Razorpay?: any;
	}
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const CHECKOUT_ORIGIN = "https://checkout.razorpay.com";

let preconnectInjected = false;

/**
 * Injects `<link rel="preconnect">` to checkout.razorpay.com on first user intent
 * (hover/focus on the upgrade button). Cuts the TLS handshake out of the click path
 * without making every subscription-page visitor pay it.
 */
function preconnectRazorpayOnce(): void {
	if (preconnectInjected || typeof document === "undefined") return;
	preconnectInjected = true;
	const preconnect = document.createElement("link");
	preconnect.rel = "preconnect";
	preconnect.href = CHECKOUT_ORIGIN;
	preconnect.crossOrigin = "anonymous";
	document.head.appendChild(preconnect);
	const dnsPrefetch = document.createElement("link");
	dnsPrefetch.rel = "dns-prefetch";
	dnsPrefetch.href = CHECKOUT_ORIGIN;
	document.head.appendChild(dnsPrefetch);
}

async function ensureRazorpayScript(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (window.Razorpay) return true;
	return new Promise<boolean>((resolve) => {
		const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
		if (existing) {
			existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
			existing.addEventListener("error", () => resolve(false));
			return;
		}
		const s = document.createElement("script");
		s.src = CHECKOUT_SRC;
		s.async = true;
		s.onload = () => resolve(Boolean(window.Razorpay));
		s.onerror = () => resolve(false);
		document.body.appendChild(s);
	});
}

export type CheckoutButtonProps = {
	planCode: PlanCode;
	label: string;
	startMode?: "immediate" | "after_trial";
	variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
	prefill?: { name?: string; email?: string; contact?: string };
	className?: string;
	disabled?: boolean;
	/** Parent portal: bill this student profile (server verifies link). */
	billingProfileId?: string;
};

export function RazorpayCheckoutButton({
	planCode,
	label,
	startMode = "immediate",
	variant = "default",
	prefill,
	className,
	disabled,
	billingProfileId,
}: CheckoutButtonProps) {
	const router = useRouter();
	const [pending, setPending] = React.useState(false);

	async function onClick() {
		setPending(true);
		try {
			const res = await fetch("/api/billing/create-subscription", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					planCode,
					startMode,
					...(billingProfileId ? { billingProfileId } : {}),
				}),
			});
			const data = (await res.json()) as {
				ok: boolean;
				subscriptionId?: string;
				shortUrl?: string | null;
				razorpayKeyId?: string | null;
				message?: string;
			};
			if (!res.ok || !data.ok || !data.subscriptionId) {
				toast.error(data.message ?? "Could not start checkout.");
				return;
			}

			const loaded = await ensureRazorpayScript();
			if (!loaded || !window.Razorpay) {
				// Fall back to hosted checkout if the script cannot load.
				if (data.shortUrl) {
					window.location.href = data.shortUrl;
					return;
				}
				toast.error("Razorpay checkout did not load. Please try again.");
				return;
			}

			const rzp = new window.Razorpay({
				key: data.razorpayKeyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
				subscription_id: data.subscriptionId,
				name: "EduAI",
				description: `Subscribe to ${label}`,
				prefill: prefill ?? {},
				theme: { color: "#059669" },
				handler: () => {
					toast.success(
						startMode === "after_trial"
							? "Payment method saved. You will be charged after your trial ends."
							: "Thanks! Activating your subscription…",
					);
					router.refresh();
					// Webhook may apply a moment later; second refresh picks up new entitlements for the sidebar.
					window.setTimeout(() => router.refresh(), 2500);
				},
				modal: {
					ondismiss: () => {
						setPending(false);
					},
				},
			});
			rzp.on("payment.failed", (response: { error?: { description?: string } }) => {
				toast.error(response?.error?.description ?? "Payment failed. Please try again.");
			});
			rzp.open();
		} catch (e) {
			console.error(e);
			toast.error("Something went wrong starting checkout.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Button
			onClick={onClick}
			onPointerEnter={preconnectRazorpayOnce}
			onFocus={preconnectRazorpayOnce}
			variant={variant}
			disabled={disabled || pending}
			className={className}
		>
			{pending ? "Opening…" : label}
		</Button>
	);
}
