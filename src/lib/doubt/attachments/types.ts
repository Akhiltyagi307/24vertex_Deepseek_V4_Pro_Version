/**
 * Shared client/server-safe types for doubt-chat attachments. No `server-only`
 * import here so the client composer can use the validation helpers and the
 * `AttachmentRow` shape.
 *
 * Hardening (D5):
 * - Declared MIME must be in {@link IMAGE_MIME_ALLOWLIST} or {@link PDF_MIME}.
 * - Size capped at {@link ATTACHMENT_MAX_BYTES}.
 * - Magic-byte sniff via {@link sniffMagicBytes} rejects files whose first
 *   bytes don't match the declared MIME — defense against a victim being
 *   tricked into uploading a renamed executable, and against trivial bypass
 *   attempts where the browser MIME is forged.
 *
 * The browser-side validators are defense-in-depth; the authoritative gate is
 * the storage bucket RLS policy that constrains writes to the authenticated
 * user's folder, and the server-side message-send route that links
 * attachments by id.
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

/**
 * MIME class detected purely from the file's first ~32 bytes — totally
 * independent of the browser-reported `file.type`. Returns `null` for any
 * input we don't recognize.
 */
export function sniffMagicBytes(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf" | null {
	if (bytes.length < 4) return null;

	// PDF: "%PDF-" — 25 50 44 46 2D
	if (
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46 &&
		bytes[4] === 0x2d
	) {
		return "application/pdf";
	}

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return "image/png";
	}

	// JPEG: FF D8 FF
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}

	// WebP: "RIFF....WEBP" — 52 49 46 46 .. .. .. .. 57 45 42 50
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return "image/webp";
	}

	// HEIC: ISO BMFF container with "ftyp" at offset 4 and one of the
	// HEIC/HEIF brand codes in the next 8 bytes (heic, heix, hevc, hevx,
	// mif1, msf1 — covers iOS Photos exports).
	if (
		bytes.length >= 12 &&
		bytes[4] === 0x66 &&
		bytes[5] === 0x74 &&
		bytes[6] === 0x79 &&
		bytes[7] === 0x70
	) {
		const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
		if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx" || brand === "mif1" || brand === "msf1") {
			return "image/heic";
		}
	}

	return null;
}

/**
 * Compares the file's actual first bytes against its declared MIME. Returns
 * `{ ok: true }` only when they agree. Reads at most 32 bytes from the file
 * so this stays cheap even for 10 MiB inputs.
 */
export async function validateAttachmentMagicBytes(
	file: Blob,
	declaredMime: string,
): Promise<ValidationFailure | { ok: true }> {
	let head: Uint8Array;
	try {
		const slice = file.slice(0, 32);
		const buf = await slice.arrayBuffer();
		head = new Uint8Array(buf);
	} catch {
		return { ok: false, reason: "Could not read the file. Try again." };
	}

	const detected = sniffMagicBytes(head);
	if (!detected) {
		return {
			ok: false,
			reason: "We couldn't recognize this file. Only JPG, PNG, WebP, HEIC, or PDF files are supported.",
		};
	}
	if (detected !== declaredMime) {
		return {
			ok: false,
			reason: "The file contents don't match the declared file type.",
		};
	}
	return { ok: true };
}
