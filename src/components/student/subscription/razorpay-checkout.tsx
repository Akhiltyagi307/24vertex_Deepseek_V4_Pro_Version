"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PlanCode } from "@/lib/billing/plans";

// `Window.Razorpay` is typed in src/types/razorpay.d.ts, which the tsconfig
// `**/*.ts` include picks up globally — no runtime import needed.

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const CHECKOUT_ORIGIN = "https://checkout.razorpay.com";

/**
 * Origins our backend's `shortUrl` from `subscriptions.create` is allowed to point at.
 * The hosted-checkout fallback `window.location.href = data.shortUrl` is redirect-from-API
 * — even though the API is trusted, we still origin-check before navigating to defend
 * against a future regression / supply-chain issue / mis-typed env. Razorpay returns links
 * on `rzp.io` (short) or the API host directly.
 */
const ALLOWED_RAZORPAY_REDIRECT_ORIGINS = new Set<string>([
	"https://api.razorpay.com",
	"https://rzp.io",
	CHECKOUT_ORIGIN,
]);

/** Throws if `rawUrl` is not a same-origin Razorpay URL. */
function safeRazorpayRedirect(rawUrl: string): string {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error("Razorpay returned a malformed redirect URL.");
	}
	if (!ALLOWED_RAZORPAY_REDIRECT_ORIGINS.has(url.origin)) {
		throw new Error(`Untrusted Razorpay redirect origin: ${url.origin}`);
	}
	return url.toString();
}

// Exported for unit testing; not part of the public component surface.
export const __test_safeRazorpayRedirect = safeRazorpayRedirect;

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

// W7.3: cap the script load wait so a hanging CDN doesn't strand the user
// with a "Opening…" button forever. 10s is generous — if checkout.js hasn't
// loaded by then, fall back to hosted checkout via shortUrl.
const SCRIPT_LOAD_TIMEOUT_MS = 10_000;

async function ensureRazorpayScript(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (window.Razorpay) return true;
	return new Promise<boolean>((resolve) => {
		let settled = false;
		const settle = (ok: boolean): void => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeoutId);
			resolve(ok);
		};
		const timeoutId = window.setTimeout(() => settle(false), SCRIPT_LOAD_TIMEOUT_MS);
		const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
		if (existing) {
			existing.addEventListener("load", () => settle(Boolean(window.Razorpay)));
			existing.addEventListener("error", () => settle(false));
			return;
		}
		const s = document.createElement("script");
		s.src = CHECKOUT_SRC;
		s.async = true;
		// crossOrigin="anonymous" enables (a) detailed error reporting from the
		// Razorpay script (otherwise the browser fires opaque "Script error."
		// events) and (b) better cache reuse with the preconnect link above,
		// which is also crossOrigin="anonymous". We deliberately do NOT set
		// `integrity` (SRI): Razorpay rolls checkout.js versions without
		// publishing stable hashes, so a fixed SRI would break checkout the
		// moment they push an update. The mitigation that actually works for
		// vendor-rolled scripts is the CSP `script-src 'strict-dynamic'`
		// allowlist + per-request nonce (see proxy.ts / src/lib/security/csp.ts)
		// plus the `frame-src https://api.razorpay.com` carve-out.
		s.crossOrigin = "anonymous";
		s.onload = () => settle(Boolean(window.Razorpay));
		s.onerror = () => settle(false);
		document.body.appendChild(s);
	});
}

/**
 * W7.4: fire-and-forget client telemetry. The endpoint is auth-gated and
 * narrow-allowlisted; we never block checkout on telemetry success.
 */
function trackCheckoutEvent(eventName: string, props: Record<string, unknown> = {}): void {
	try {
		void fetch("/api/student/billing/checkout-event", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ event_name: eventName, props }),
			keepalive: true,
		});
	} catch {
		/* telemetry never blocks UX */
	}
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
	/** Checkout % coupon (checkout_discount kind); passed to create-subscription. */
	checkoutCouponCode?: string;
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
	checkoutCouponCode,
}: CheckoutButtonProps) {
	const router = useRouter();
	const [pending, setPending] = React.useState(false);
	// W7.1: capture trigger button so we can restore focus when the modal
	// closes — the Razorpay modal injects an iframe and steals focus to it,
	// and on dismiss returning focus to the trigger is the WAI-ARIA dialog
	// pattern. Without this, keyboard users land at <body> after dismissal.
	const buttonRef = React.useRef<HTMLButtonElement>(null);

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
					...(checkoutCouponCode?.trim() ? { couponCode: checkoutCouponCode.trim().toUpperCase() } : {}),
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
				// Fall back to hosted checkout if the script cannot load. Origin-check
				// the URL before navigating — `data.shortUrl` is server-controlled, but
				// `safeRazorpayRedirect` throws if a future regression returns anything
				// outside the Razorpay allowlist.
				if (data.shortUrl) {
					try {
						window.location.href = safeRazorpayRedirect(data.shortUrl);
						return;
					} catch (err) {
						toast.error(err instanceof Error ? err.message : "Untrusted redirect.");
						return;
					}
				}
				toast.error("Razorpay checkout did not load. Please try again.");
				return;
			}

			const razorpayKey = data.razorpayKeyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
			if (!razorpayKey) {
				toast.error("Razorpay is not configured. Contact support if this persists.");
				return;
			}
			const rzp = new window.Razorpay({
				key: razorpayKey,
				subscription_id: data.subscriptionId,
				name: "24Vertex",
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
						trackCheckoutEvent("checkout_dismissed", { plan_code: planCode });
						// W7.1: restore focus to the trigger button on dismiss so
						// keyboard users don't land on <body>.
						buttonRef.current?.focus();
					},
				},
			});
			rzp.on("payment.failed", (response: { error?: { description?: string; code?: string } }) => {
				toast.error(response?.error?.description ?? "Payment failed. Please try again.");
				trackCheckoutEvent("checkout_payment_failed", {
					plan_code: planCode,
					error_code: response?.error?.code ?? null,
				});
			});
			try {
				rzp.open();
				trackCheckoutEvent("checkout_opened", { plan_code: planCode });
			} catch (openErr) {
				// W4.6: rzp.open() can throw on iOS Safari when the SDK loads
				// but the modal can't render (popup blockers, restricted iframe
				// contexts). Fall back to hosted checkout immediately.
				console.error("rzp.open() threw, falling back to hosted checkout:", openErr);
				trackCheckoutEvent("checkout_modal_render_failed", { plan_code: planCode, phase: "open_throw" });
				if (data.shortUrl) {
					try {
						window.location.href = safeRazorpayRedirect(data.shortUrl);
						return;
					} catch (redirectErr) {
						toast.error(redirectErr instanceof Error ? redirectErr.message : "Untrusted redirect.");
						return;
					}
				}
				toast.error("Could not open checkout. Please try again or contact support.");
				return;
			}

			// W4.6: 5s observer — if the Razorpay iframe never mounts (silent
			// failure on some iOS versions where rzp.open() returns without
			// rendering), fall back to hosted checkout. The Razorpay SDK
			// injects an iframe whose name attribute starts with "razorpay-".
			window.setTimeout(() => {
				const mounted = document.querySelector('iframe[name^="razorpay-"], iframe[src*="razorpay.com"]');
				if (mounted) return;
				trackCheckoutEvent("checkout_modal_render_failed", { plan_code: planCode, phase: "no_iframe" });
				if (data.shortUrl) {
					try {
						window.location.href = safeRazorpayRedirect(data.shortUrl);
					} catch (e) {
						console.error("Razorpay modal didn't render and fallback failed:", e);
					}
				}
			}, 5_000);
		} catch (e) {
			console.error(e);
			toast.error("Something went wrong starting checkout.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Button
			ref={buttonRef}
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
