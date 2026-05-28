import "server-only";

/**
 * History-stripping helpers applied to model messages before forwarding to
 * DeepSeek. Both are no-ops for OpenAI turns — the route handler only calls
 * them when `resolved.provider === "deepseek"`.
 *
 * Why these exist:
 *   - DeepSeek's thinking endpoint returns HTTP 400 when any input message
 *     contains `reasoning_content`. The Vercel AI SDK normally re-encodes
 *     assistant `reasoning` parts on subsequent turns; we drop them so the
 *     next turn forwards just the visible text. Reasoning is still emitted
 *     to the client on each new turn (DeepSeek decides freshly whether to
 *     think), so this only changes wire encoding, not behaviour.
 *   - DeepSeek doesn't accept image inputs. A student may have attached an
 *     image to an earlier turn (which was routed to OpenAI for vision). On
 *     follow-up text-only turns we route back to DeepSeek, but the
 *     attachment decorator re-attaches the historic image — DeepSeek would
 *     reject the unrecognised part. We drop image-bearing parts and leave a
 *     one-line text breadcrumb per stripped turn so the model still has
 *     coherent context for what was discussed earlier.
 *
 * PDF transcripts are NOT touched — the upstream attachment decorator
 * already merges the extracted text into the user's text part, so PDFs
 * ride through as plain text.
 */

export function stripReasoningPartsFromMessages<T extends { role: string; content?: unknown }>(
	messages: T[],
): T[] {
	return messages.map((msg) => {
		if (msg.role !== "assistant") return msg;
		const content = msg.content;
		if (!Array.isArray(content)) return msg;
		const filtered = content.filter((part) => {
			if (!part || typeof part !== "object") return true;
			const type = (part as { type?: unknown }).type;
			return type !== "reasoning";
		});
		if (filtered.length === content.length) return msg;
		return { ...msg, content: filtered };
	});
}

const STRIPPED_IMAGE_BREADCRUMB =
	"[Image attachment was here in this earlier turn. Refer to the assistant's response on that turn for what was in the image.]";

export function stripImagePartsFromMessages<T extends { role: string; content?: unknown }>(
	messages: T[],
): T[] {
	return messages.map((msg) => {
		if (msg.role !== "user") return msg;
		const content = msg.content;
		if (!Array.isArray(content)) return msg;
		let hadImage = false;
		const filtered = content.filter((part) => {
			if (!part || typeof part !== "object") return true;
			const obj = part as { type?: unknown; mediaType?: unknown; mimeType?: unknown };
			const isFileImagePart =
				obj.type === "image" ||
				(obj.type === "file" &&
					typeof obj.mediaType === "string" &&
					obj.mediaType.startsWith("image/")) ||
				(obj.type === "file" &&
					typeof obj.mimeType === "string" &&
					(obj.mimeType as string).startsWith("image/"));
			if (isFileImagePart) {
				hadImage = true;
				return false;
			}
			return true;
		});
		if (!hadImage) return msg;
		const withBreadcrumb = filtered.map((part) => {
			if (!part || typeof part !== "object") return part;
			const obj = part as { type?: unknown; text?: unknown };
			if (obj.type === "text" && typeof obj.text === "string") {
				return { ...obj, text: `${STRIPPED_IMAGE_BREADCRUMB}\n\n${obj.text}` };
			}
			return part;
		});
		const hasText = withBreadcrumb.some(
			(p) => p && typeof p === "object" && (p as { type?: unknown }).type === "text",
		);
		if (!hasText) {
			withBreadcrumb.unshift({
				type: "text",
				text: STRIPPED_IMAGE_BREADCRUMB,
			} as (typeof withBreadcrumb)[number]);
		}
		return { ...msg, content: withBreadcrumb };
	});
}
