import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "doubt-attachments";
const EXTRACTION_TIMEOUT_MS = 20_000;
const NATIVE_TEXT_THRESHOLD = 200; // chars; below this we try OCR.
const MAX_OCR_PAGES = 5;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		p.then(
			(v) => {
				clearTimeout(id);
				resolve(v);
			},
			(e) => {
				clearTimeout(id);
				reject(e);
			},
		);
	});
}

async function downloadBytes(supabase: SupabaseClient, path: string): Promise<Buffer> {
	const { data, error } = await supabase.storage.from(BUCKET).download(path);
	if (error || !data) {
		throw new Error(`download ${path}: ${error?.message ?? "no data"}`);
	}
	const arr = new Uint8Array(await data.arrayBuffer());
	return Buffer.from(arr);
}

async function nativeText(buf: Buffer): Promise<string> {
	// Lazy-import so the dep is only loaded on the route invocations that need it.
	const mod = (await import("pdf-parse")) as { default: (b: Buffer) => Promise<{ text: string }> };
	const result = await mod.default(buf);
	return (result.text ?? "").trim();
}

async function ocrText(buf: Buffer): Promise<string> {
	type PageInfo = { num: number; render: (opts: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> }; getViewport: (o: { scale: number }) => unknown };
	type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PageInfo> };
	type PdfModule = {
		getDocument: (data: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
	};
	const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfModule;
	const tesseractMod = await import("tesseract.js");
	type Tess = { recognize: (img: Buffer | Uint8Array, lang: string) => Promise<{ data: { text: string } }> };
	const tesseract = (tesseractMod as unknown as { default?: Tess } & Tess);
	const recognize = (tesseract.default ?? tesseract).recognize;

	const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
	const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
	const pieces: string[] = [];
	for (let i = 1; i <= pageCount; i++) {
		try {
			const page = await doc.getPage(i);
			// pdfjs `render` requires a CanvasContext. In a Node runtime the
			// `@napi-rs/canvas` shim isn't available, so we rasterize via the
			// PDF's own page object's `getOperatorList`-driven path is overkill
			// here. We instead use pdfjs's `node-canvas`-free fallback by
			// asking pdfjs to render to its bitmap getter when supported. If
			// rendering isn't available, we skip OCR for that page and fall
			// back to native text only.
			const viewport = page.getViewport({ scale: 2 });
			// The OffscreenCanvas API exists in Node 20+ via `node:canvas` if
			// available. We try it and otherwise skip to keep this dependency-
			// optional. Production deploys will need a canvas implementation.
			let nodeCanvas: { createCanvas: (w: number, h: number) => unknown } | null = null;
			try {
				const mod = (await import("@napi-rs/canvas").catch(() => null)) as
					| { createCanvas: (w: number, h: number) => unknown }
					| null;
				if (mod) nodeCanvas = mod;
			} catch {
				// optional dep absent
			}
			if (!nodeCanvas) {
				// Skip raster path; native-text fallback already attempted.
				continue;
			}
			const vp = viewport as { width: number; height: number };
			const canvas = nodeCanvas.createCanvas(Math.ceil(vp.width), Math.ceil(vp.height)) as {
				getContext: (kind: string) => unknown;
				toBuffer: (mime: string) => Buffer;
			};
			const ctx = canvas.getContext("2d");
			await page.render({ canvasContext: ctx, viewport }).promise;
			const png = canvas.toBuffer("image/png");
			const { data } = await recognize(png, "eng");
			if (data.text) pieces.push(data.text.trim());
		} catch (e) {
			Sentry.captureException(e, {
				tags: { component: "doubt.extract_pdf", phase: "ocr_page" },
				extra: { page: i },
			});
		}
	}
	return pieces.join("\n\n").trim();
}

/**
 * Extracts the textual content of a PDF attachment for tutor consumption.
 * Persists the result to `doubt_message_attachments.ocr_text`.
 *
 * Strategy:
 *   1. Try native text extraction via `pdf-parse`. Most CBSE NCERT-style PDFs
 *      have a real text layer; this path is fast and free.
 *   2. If the native layer is missing (scanned worksheet), fall back to
 *      `pdfjs-dist` rasterization + `tesseract.js`. Capped at 5 pages and
 *      gated by a 20-second total budget. If `@napi-rs/canvas` isn't present
 *      in the runtime, OCR is skipped and only the native text returns.
 *
 * Errors are swallowed and reported to Sentry — extraction is best-effort and
 * the chat should still go through with whatever text we have (or empty).
 */
export async function extractPdfText(
	supabase: SupabaseClient,
	attachment: { id: string; storagePath: string },
): Promise<{ ocrText: string }> {
	try {
		const work = (async () => {
			const buf = await downloadBytes(supabase, attachment.storagePath);
			let text = "";
			try {
				text = await nativeText(buf);
			} catch (e) {
				Sentry.captureException(e, {
					tags: { component: "doubt.extract_pdf", phase: "native_text" },
					extra: { attachmentId: attachment.id },
				});
			}
			if (text.length < NATIVE_TEXT_THRESHOLD) {
				try {
					const ocred = await ocrText(buf);
					if (ocred.length > text.length) {
						text = ocred;
					}
				} catch (e) {
					Sentry.captureException(e, {
						tags: { component: "doubt.extract_pdf", phase: "ocr" },
						extra: { attachmentId: attachment.id },
					});
				}
			}
			return text;
		})();

		const text = await withTimeout(work, EXTRACTION_TIMEOUT_MS, "extractPdfText");

		const { error } = await supabase
			.from("doubt_message_attachments")
			.update({ ocr_text: text })
			.eq("id", attachment.id);
		if (error) {
			Sentry.captureException(new Error(`persist ocr_text: ${error.message}`), {
				tags: { component: "doubt.extract_pdf", phase: "persist" },
				extra: { attachmentId: attachment.id },
			});
		}
		return { ocrText: text };
	} catch (e) {
		Sentry.captureException(e, {
			tags: { component: "doubt.extract_pdf", phase: "outer" },
			extra: { attachmentId: attachment.id },
		});
		// Best-effort: persist empty so we don't retry the timeout next turn.
		await supabase
			.from("doubt_message_attachments")
			.update({ ocr_text: "" })
			.eq("id", attachment.id);
		return { ocrText: "" };
	}
}
