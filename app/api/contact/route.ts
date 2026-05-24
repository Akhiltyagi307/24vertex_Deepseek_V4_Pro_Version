import { z } from "zod";

import {
	getContactNotificationEmail,
	getPublicSupportEmail,
	getResendApiKey,
	getResendFrom,
} from "@/lib/env";
import { consumeContactSubmitRateLimit } from "@/lib/marketing/contact/rate-limit";
import { parseIndianPhone } from "@/lib/marketing/contact/phone";
import { Resend } from "resend";

const INQUIRY_LABELS = {
	parent: "Parent",
	school: "School",
	press: "Press",
} as const;

/** Per-field error codes the client surfaces inline. Keep stable. */
export type ContactFieldErrorCode =
	| "name_required"
	| "name_too_short"
	| "name_too_long"
	| "email_required"
	| "email_invalid"
	| "phone_invalid"
	| "message_required"
	| "message_too_short"
	| "message_too_long"
	| "inquiry_invalid";

type ContactErrorResponse = {
	ok: false;
	message: string;
	field?: "name" | "email" | "phone" | "message" | "inquiryType";
	code?: ContactFieldErrorCode;
};

type ContactOkResponse = { ok: true };

function jsonError(
	body: ContactErrorResponse,
	status: number,
): Response {
	return Response.json(body, { status });
}

// We only allow a sane shape that covers >99% of real addresses without
// blocking unusual but valid ones. Full RFC 5322 is intentionally not used.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const bodySchema = z
	.object({
		inquiryType: z.enum(["parent", "school", "press"]),
		name: z
			.string()
			.trim()
			.min(2, { message: "name_too_short" })
			.max(120, { message: "name_too_long" })
			.refine((v) => /\p{L}/u.test(v), { message: "name_too_short" }),
		email: z
			.string()
			.trim()
			.min(1, { message: "email_required" })
			.max(254, { message: "email_invalid" })
			.refine((v) => EMAIL_RE.test(v), { message: "email_invalid" }),
		// Phone: optional from the client's POV (empty string or absent), but
		// when present must be a valid Indian mobile number. We accept empty
		// string here so the client can always send the field.
		phone: z.string().trim().max(30).optional().nullable(),
		message: z
			.string()
			.trim()
			.min(20, { message: "message_too_short" })
			.max(4000, { message: "message_too_long" }),
		// Honeypot: bots fill it, humans never see it. Empty == ok.
		website: z.string().max(0).optional(),
	})
	.strict();

function clientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0]?.trim() || "unknown";
	}
	return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request): Promise<Response> {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return jsonError({ ok: false, message: "Invalid JSON." }, 400);
	}

	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		const fieldPath = first?.path?.[0];
		const code = (first?.message ?? "") as ContactFieldErrorCode;
		const message = humanMessageForCode(code) ?? "Please check the form fields.";
		return jsonError(
			{
				ok: false,
				message,
				field:
					fieldPath === "name" ||
					fieldPath === "email" ||
					fieldPath === "phone" ||
					fieldPath === "message" ||
					fieldPath === "inquiryType"
						? fieldPath
						: undefined,
				code: code || undefined,
			},
			400,
		);
	}

	// Honeypot: silently accept, do nothing. Bots think they succeeded.
	if (parsed.data.website) {
		return Response.json({ ok: true } satisfies ContactOkResponse);
	}

	// Indian phone validation (only when the user actually provided a phone).
	const rawPhone = parsed.data.phone?.trim();
	let normalisedPhone: { canonical: string; pretty: string } | null = null;
	if (rawPhone) {
		const parsedPhone = parseIndianPhone(rawPhone);
		if (!parsedPhone) {
			return jsonError(
				{
					ok: false,
					field: "phone",
					code: "phone_invalid",
					message: "Enter a valid Indian mobile number (10 digits starting with 6, 7, 8, or 9).",
				},
				400,
			);
		}
		normalisedPhone = parsedPhone;
	}

	const ip = clientIp(request);
	const rate = await consumeContactSubmitRateLimit(ip);
	if (!rate.ok) {
		return jsonError(
			{ ok: false, message: "Too many messages. Try again later." },
			429,
		);
	}

	const notifyEmail = getContactNotificationEmail();
	if (!notifyEmail) {
		return jsonError(
			{ ok: false, message: "Contact is not configured yet. Please try again later." },
			503,
		);
	}

	const { inquiryType, name, email, message } = parsed.data;
	const label = INQUIRY_LABELS[inquiryType];
	const subject = `[24Vertex ${label}] ${name}`;
	const publicEmail = getPublicSupportEmail();
	const html = `
<p><strong>Inquiry:</strong> ${label}</p>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
${
	normalisedPhone
		? `<p><strong>Phone:</strong> <a href="tel:${escapeHtml(normalisedPhone.canonical)}">${escapeHtml(normalisedPhone.pretty)}</a></p>`
		: ""
}
<p><strong>Message:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
<p style="color:#64748b;font-size:12px;">
	Sent from the public contact form. IP: ${escapeHtml(ip)}.${
		publicEmail && publicEmail !== notifyEmail
			? ` Public reply-to address: ${escapeHtml(publicEmail)}.`
			: ""
	}
</p>
`.trim();

	try {
		const resend = new Resend(getResendApiKey());
		const { error } = await resend.emails.send({
			from: getResendFrom(),
			to: notifyEmail,
			replyTo: email,
			subject,
			html,
		});
		if (error) {
			return jsonError(
				{ ok: false, message: "Could not send your message." },
				500,
			);
		}
		return Response.json({ ok: true } satisfies ContactOkResponse);
	} catch {
		return jsonError(
			{ ok: false, message: "Could not send your message." },
			500,
		);
	}
}

function humanMessageForCode(code: ContactFieldErrorCode | string): string | null {
	switch (code) {
		case "name_too_short":
			return "Add your name so we know who to reply to.";
		case "name_too_long":
			return "That name is too long.";
		case "email_required":
		case "email_invalid":
			return "Enter a valid email so we can reply.";
		case "phone_invalid":
			return "Enter a valid Indian mobile number (10 digits starting with 6, 7, 8, or 9).";
		case "message_too_short":
			return "A few more lines, please. At least 20 characters so we can help.";
		case "message_too_long":
			return "That message is too long.";
		default:
			return null;
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
