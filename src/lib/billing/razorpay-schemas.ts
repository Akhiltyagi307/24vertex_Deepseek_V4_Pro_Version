import "server-only";

import { z } from "zod";

/**
 * W5.1 — Zod schemas for Razorpay API responses.
 *
 * Why: razorpay.ts previously cast every SDK response with `as unknown as
 * Type`, which silently accepted whatever shape the SDK returned. If
 * Razorpay's response schema drifts (a field renamed, a status enum
 * extended), our code keeps compiling and only blows up at the call site,
 * far from the cause.
 *
 * Strategy: parse SDK responses through these schemas at the boundary.
 * Schemas are intentionally lenient — `passthrough()` keeps unknown fields,
 * and we only assert types on fields we actually read. Adding new fields to
 * Razorpay can't break us; field-removals or type changes throw cleanly.
 *
 * Usage at the call site:
 *   const raw = await rzp.subscriptions.create(body);
 *   return RazorpaySubscriptionSchema.parse(raw);
 */

export const RazorpayCustomerSchema = z
	.object({
		id: z.string(),
		name: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		contact: z.string().nullable().optional(),
		notes: z.record(z.unknown()).nullable().optional(),
	})
	.passthrough();

export const RazorpaySubscriptionSchema = z
	.object({
		id: z.string(),
		status: z.string(),
		plan_id: z.string(),
		customer_id: z.string().nullable().optional(),
		short_url: z.string().nullable().optional(),
		current_start: z.number().nullable().optional(),
		current_end: z.number().nullable().optional(),
		charge_at: z.number().nullable().optional(),
		end_at: z.number().nullable().optional(),
		start_at: z.number().nullable().optional(),
		notes: z.record(z.string()).nullable().optional(),
	})
	.passthrough();

export const RazorpayInvoiceSchema = z
	.object({
		id: z.string(),
		short_url: z.string().nullable().optional(),
		payment_id: z.string().nullable().optional(),
		subscription_id: z.string().nullable().optional(),
		amount: z.number().optional(),
		currency: z.string().optional(),
		status: z.string().optional(),
	})
	.passthrough();

export const RazorpayRefundSchema = z
	.object({
		id: z.string(),
		amount: z.number().optional(),
		status: z.string().optional(),
		payment_id: z.string().optional(),
		created_at: z.number().optional(),
		notes: z.record(z.unknown()).nullable().optional(),
	})
	.passthrough();

export const RazorpayRefundsListSchema = z
	.object({
		count: z.number().optional(),
		items: z.array(RazorpayRefundSchema).default([]),
	})
	.passthrough();

export const RazorpayPlanFetchedSchema = z
	.object({
		id: z.string(),
		period: z.string().optional(),
		interval: z.number().optional(),
		item: z
			.object({
				name: z.string().optional(),
				amount: z.number().optional(),
				currency: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export const RazorpayPlanCreatedSchema = z
	.object({
		id: z.string(),
	})
	.passthrough();
