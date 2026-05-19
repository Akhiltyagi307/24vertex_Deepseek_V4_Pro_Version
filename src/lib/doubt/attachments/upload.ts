"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
	ATTACHMENT_MAX_BYTES,
	classifyAttachment,
	type AttachmentRow,
	validateAttachment,
	validateAttachmentMagicBytes,
} from "./types";

const BUCKET = "doubt-attachments";

function extensionFor(mime: string): string {
	switch (mime) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/heic":
			return "heic";
		case "application/pdf":
			return "pdf";
		default:
			return "bin";
	}
}

function randomSlug(): string {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	let s = "";
	for (const b of arr) s += b.toString(16).padStart(2, "0");
	return s;
}

export type UploadAttachmentResult =
	| { ok: true; attachment: AttachmentRow }
	| { ok: false; message: string };

/**
 * Validate, upload to the `doubt-attachments` bucket under the student's own
 * folder, and insert a `doubt_message_attachments` row pre-linked to the
 * conversation but not yet a message (the route handler binds it on send).
 *
 * RLS shape:
 *   - storage.objects: only `auth.uid()/...` writable.
 *   - doubt_message_attachments: only insertable when `conversation_id`
 *     belongs to the auth user.
 */
export async function uploadDoubtAttachment(
	supabase: SupabaseClient,
	conversationId: string,
	studentId: string,
	file: File,
): Promise<UploadAttachmentResult> {
	const validation = validateAttachment(file);
	if (!validation.ok) {
		return { ok: false, message: validation.reason };
	}

	const magic = await validateAttachmentMagicBytes(file, file.type);
	if (!magic.ok) {
		return { ok: false, message: magic.reason };
	}

	const kind = validation.kind ?? classifyAttachment(file.type);
	if (!kind) {
		return { ok: false, message: "Unsupported file type." };
	}

	const path = `${studentId}/${conversationId}/${randomSlug()}.${extensionFor(file.type)}`;

	const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
		cacheControl: "3600",
		contentType: file.type,
		upsert: false,
	});
	if (upErr) {
		return {
			ok: false,
			message: upErr.message.includes("exceeded")
				? "That file exceeds the 10 MiB limit."
				: `Upload failed: ${upErr.message}`,
		};
	}

	const { data: row, error: rowErr } = await supabase
		.from("doubt_message_attachments")
		.insert({
			conversation_id: conversationId,
			message_id: null,
			kind,
			storage_path: path,
			mime: file.type,
			size_bytes: file.size,
			ocr_text: null,
		})
		.select("id, conversation_id, message_id, kind, storage_path, mime, size_bytes, ocr_text, created_at")
		.single();

	if (rowErr || !row) {
		// Best-effort cleanup of the uploaded object — RLS allows the same user
		// who just inserted it to delete it.
		await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
		return {
			ok: false,
			message: rowErr?.message ?? "Could not save attachment metadata.",
		};
	}

	return {
		ok: true,
		attachment: {
			id: row.id as string,
			conversationId: row.conversation_id as string,
			messageId: (row.message_id ?? null) as string | null,
			kind: row.kind as "image" | "pdf",
			storagePath: row.storage_path as string,
			mime: row.mime as string,
			sizeBytes: row.size_bytes as number,
			ocrText: (row.ocr_text ?? null) as string | null,
			createdAt: row.created_at as string,
		},
	};
}

export { ATTACHMENT_MAX_BYTES };
