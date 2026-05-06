/**
 * Shared client/server-safe types for doubt-chat attachments. No `server-only`
 * import here so the client composer can use the validation helpers and the
 * `AttachmentRow` shape.
 */

export type AttachmentKind = "image" | "pdf";

export type AttachmentRow = {
	id: string;
	conversationId: string;
	messageId: string | null;
	kind: AttachmentKind;
	storagePath: string;
	mime: string;
	sizeBytes: number;
	ocrText: string | null;
	createdAt: string;
};

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
export const ATTACHMENT_MAX_PER_TURN = 3;

export const IMAGE_MIME_ALLOWLIST = new Set<string>([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
]);
export const PDF_MIME = "application/pdf";

export function classifyAttachment(mime: string): AttachmentKind | null {
	if (IMAGE_MIME_ALLOWLIST.has(mime)) return "image";
	if (mime === PDF_MIME) return "pdf";
	return null;
}

export type ValidationFailure = { ok: false; reason: string };
export type ValidationSuccess = { ok: true; kind: AttachmentKind };

export function validateAttachment(file: { type: string; size: number }):
	| ValidationFailure
	| ValidationSuccess {
	const kind = classifyAttachment(file.type);
	if (!kind) {
		return { ok: false, reason: "Only JPG, PNG, WebP, HEIC, or PDF files are supported." };
	}
	if (file.size <= 0) {
		return { ok: false, reason: "That file appears to be empty." };
	}
	if (file.size > ATTACHMENT_MAX_BYTES) {
		return { ok: false, reason: "Files must be 10 MiB or smaller." };
	}
	return { ok: true, kind };
}
