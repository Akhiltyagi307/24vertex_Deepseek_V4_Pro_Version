import type { UIMessage } from "ai";

/** Join text parts of a UIMessage (v6 parts-based shape). */
export function getTextFromUIMessage(message: UIMessage): string {
	return message.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p)
		.map((p) => p.text)
		.join("");
}
