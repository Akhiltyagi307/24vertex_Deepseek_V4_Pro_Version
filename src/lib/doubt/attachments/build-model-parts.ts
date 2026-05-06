import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";

import { extractPdfText } from "./extract-pdf";
import type { AttachmentRow } from "./types";

const BUCKET = "doubt-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min — covers the model call window.

/**
 * Resolve attachment rows into model-friendly inputs:
 *
 * - Image attachments → an additional `image` part on the user message so a
 *   vision-capable OpenAI model can see them.
 * - PDF attachments → a leading text block on the user message containing the
 *   extracted transcript (`pdf-parse` first, OCR fallback). On-demand
 *   extraction runs here for any row that doesn't yet have `ocr_text`.
 *
 * Caller passes the most-recent user `UIMessage`; we return a new copy with
 * the parts merged in. The original message is not mutated.
 */
export async function decorateUserMessageWithAttachments(
	supabase: SupabaseClient,
	userMessage: UIMessage,
	attachments: AttachmentRow[],
): Promise<UIMessage> {
	if (attachments.length === 0) return userMessage;

	const pdfRows: AttachmentRow[] = [];
	const imageRows: AttachmentRow[] = [];
	for (const a of attachments) {
		if (a.kind === "pdf") pdfRows.push(a);
		else if (a.kind === "image") imageRows.push(a);
	}

	// Run PDF extraction in parallel — each call is bounded by its own 20s
	// timeout in `extractPdfText`, so the worst-case wall time is ~20s
	// regardless of how many PDFs we extract (capped at 2 by the request schema).
	const pdfsToExtract = pdfRows.slice(0, 2).filter((p) => !p.ocrText || p.ocrText.length === 0);
	if (pdfsToExtract.length > 0) {
		const results = await Promise.allSettled(
			pdfsToExtract.map((pdf) =>
				extractPdfText(supabase, { id: pdf.id, storagePath: pdf.storagePath }),
			),
		);
		for (let i = 0; i < pdfsToExtract.length; i++) {
			const r = results[i]!;
			if (r.status === "fulfilled") {
				pdfsToExtract[i]!.ocrText = r.value.ocrText;
			} else {
				pdfsToExtract[i]!.ocrText = "";
			}
		}
	}

	// Sign image URLs so the model can actually fetch them. Each URL is
	// short-lived; we don't expose the bucket publicly.
	const signedImages: { url: string; mime: string }[] = [];
	for (const img of imageRows.slice(0, 3)) {
		const { data, error } = await supabase.storage
			.from(BUCKET)
			.createSignedUrl(img.storagePath, SIGNED_URL_TTL_SECONDS);
		if (error || !data?.signedUrl) continue;
		signedImages.push({ url: data.signedUrl, mime: img.mime });
	}

	const transcripts = pdfRows
		.map((p) => (p.ocrText ?? "").trim())
		.filter((t) => t.length > 0)
		.map((t, i) => `[Attached PDF ${i + 1} transcript]\n${t}`)
		.join("\n\n");

	// Reconstruct parts. We only mutate the text part (prepend transcripts) and
	// append image parts.
	const newParts: UIMessage["parts"] = [];
	let textPrepended = false;
	for (const p of userMessage.parts ?? []) {
		if (!textPrepended && p.type === "text") {
			const merged = transcripts ? `${transcripts}\n\n${(p as { text: string }).text ?? ""}` : (p as { text: string }).text ?? "";
			newParts.push({ ...p, text: merged } as typeof p);
			textPrepended = true;
		} else {
			newParts.push(p);
		}
	}
	if (!textPrepended && transcripts) {
		newParts.unshift({ type: "text", text: transcripts } as unknown as UIMessage["parts"][number]);
	}
	for (const img of signedImages) {
		// AI SDK v6 file part shape (used for both images and other media):
		//   `{ type: "file", mediaType: <IANA mime>, url: <https-url-or-data-url> }`.
		// `convertToModelMessages` translates this to the provider's native vision
		// input on streamText (for OpenAI: an `image_url` content block).
		newParts.push({
			type: "file",
			mediaType: img.mime,
			url: img.url,
		} as unknown as UIMessage["parts"][number]);
	}

	return { ...userMessage, parts: newParts };
}

export async function loadAttachmentsForRequest(
	supabase: SupabaseClient,
	conversationId: string,
	attachmentIds: string[],
): Promise<AttachmentRow[]> {
	if (attachmentIds.length === 0) return [];
	const { data, error } = await supabase
		.from("doubt_message_attachments")
		.select("id, conversation_id, message_id, kind, storage_path, mime, size_bytes, ocr_text, created_at")
		.eq("conversation_id", conversationId)
		.in("id", attachmentIds);
	if (error || !data) return [];
	const found = data.map((r) => ({
		id: r.id as string,
		conversationId: r.conversation_id as string,
		messageId: (r.message_id ?? null) as string | null,
		kind: r.kind as "image" | "pdf",
		storagePath: r.storage_path as string,
		mime: r.mime as string,
		sizeBytes: r.size_bytes as number,
		ocrText: (r.ocr_text ?? null) as string | null,
		createdAt: r.created_at as string,
	}));
	// Preserve caller-specified ordering so the model sees attachments in the
	// order the student attached them.
	const byId = new Map(found.map((a) => [a.id, a]));
	return attachmentIds.map((id) => byId.get(id)).filter((a): a is AttachmentRow => Boolean(a));
}

export async function bindAttachmentsToMessage(
	supabase: SupabaseClient,
	attachmentIds: string[],
	messageId: string,
): Promise<void> {
	if (attachmentIds.length === 0) return;
	const { error } = await supabase
		.from("doubt_message_attachments")
		.update({ message_id: messageId })
		.in("id", attachmentIds);
	if (error) {
		// Non-fatal; the row stays orphaned but the message is intact. Log via
		// the caller so we don't import the logging module here.
		throw error;
	}
}
