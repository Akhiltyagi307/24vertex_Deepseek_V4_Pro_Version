import { z } from "zod";

import { consumeContactSubmitRateLimit } from "@/lib/marketing/contact/rate-limit";
import { getPublicSupportEmail, getResendApiKey, getResendFrom } from "@/lib/env";
import { Resend } from "resend";

const INQUIRY_LABELS = {
	parent: "Parent",
	school: "School",
	press: "Press",
} as const;

const bodySchema = z
	.object({
		inquiryType: z.enum(["parent", "school", "press"]),
		name: z.string().min(2).max(120),
		email: z.string().email().max(254),
		phone: z.string().max(20).optional(),
		message: z.string().min(20).max(4000),
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

export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ ok: false, message: "Please check the form fields." }, { status: 400 });
	}

	if (parsed.data.website) {
		return Response.json({ ok: true });
	}

	const ip = clientIp(request);
	const rate = await consumeContactSubmitRateLimit(ip);
	if (!rate.ok) {
		return Response.json(
			{ ok: false, message: "Too many messages. Try again later." },
			{ status: 429 },
		);
	}

	const supportEmail = getPublicSupportEmail();
	if (!supportEmail) {
		return Response.json(
			{ ok: false, message: "Contact is not configured yet. Please try again later." },
			{ status: 503 },
		);
	}

	const { inquiryType, name, email, phone, message } = parsed.data;
	const label = INQUIRY_LABELS[inquiryType];
	const subject = `[24Vertex ${label}] ${name}`;
	const html = `
<p><strong>Inquiry:</strong> ${label}</p>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
<p><strong>Message:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
<p style="color:#64748b;font-size:12px;">Sent from the public contact form (IP: ${escapeHtml(ip)})</p>
`.trim();

	try {
		const resend = new Resend(getResendApiKey());
		const { error } = await resend.emails.send({
			from: getResendFrom(),
			to: supportEmail,
			replyTo: email,
			subject,
			html,
		});
		if (error) {
			return Response.json({ ok: false, message: "Could not send your message." }, { status: 500 });
		}
		return Response.json({ ok: true });
	} catch {
		return Response.json({ ok: false, message: "Could not send your message." }, { status: 500 });
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
