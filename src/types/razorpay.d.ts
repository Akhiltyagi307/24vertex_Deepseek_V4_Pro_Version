/**
 * Type surface for the Razorpay checkout SDK script (`checkout.razorpay.com/v1/checkout.js`).
 *
 * The script attaches a global `window.Razorpay` constructor. This file
 * captures only the fields we actually pass — Razorpay's full options
 * surface is large; types here intentionally cover what the codebase uses
 * so we get autocomplete + safety without copying the whole vendor API.
 *
 * If you start passing additional fields, add them here.
 */

export interface RazorpayPrefill {
	name?: string;
	email?: string;
	contact?: string;
}

export interface RazorpayCheckoutOptions {
	key: string;
	subscription_id: string;
	name?: string;
	description?: string;
	prefill?: RazorpayPrefill;
	theme?: { color?: string };
	handler?: (response: RazorpayPaymentResponse) => void;
	modal?: {
		ondismiss?: () => void;
		escape?: boolean;
		backdropclose?: boolean;
	};
	notes?: Record<string, string>;
}

export interface RazorpayPaymentResponse {
	razorpay_payment_id: string;
	razorpay_subscription_id?: string;
	razorpay_order_id?: string;
	razorpay_signature?: string;
}

export interface RazorpayInstance {
	open(): void;
	close(): void;
	on(event: "payment.failed", handler: (error: { error: { description?: string } }) => void): void;
}

export interface RazorpayConstructor {
	new (options: RazorpayCheckoutOptions): RazorpayInstance;
}

// Ambient: this file has no `export` so `declare` augments the global scope
// directly (a `declare global` block requires the file to be a module).
// The interfaces above are exported for type-only consumers; the Window
// extension is the side effect this file exists for.
declare global {
	interface Window {
		Razorpay?: RazorpayConstructor;
	}
}
