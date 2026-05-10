import type { UIMessage } from "ai";

/** Join text parts of a UIMessage (v6 parts-based shape), with legacy `content` fallback. */
export function getTextFromUIMessage(message: UIMessage): string {
	const parts = message.parts;
	if (Array.isArray(parts) && parts.length > 0) {
		return parts
			.filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p)
			.map((p) => p.text)
			.join("");
	}
	const asLegacy = message as UIMessage & { content?: unknown };
	return typeof asLegacy.content === "string" ? asLegacy.content : "";
}
