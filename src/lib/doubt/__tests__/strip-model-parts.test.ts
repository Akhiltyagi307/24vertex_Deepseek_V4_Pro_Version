import { describe, expect, it } from "vitest";

import {
	stripImagePartsFromMessages,
	stripReasoningPartsFromMessages,
} from "@/lib/doubt/strip-model-parts";

describe("stripReasoningPartsFromMessages", () => {
	it("removes reasoning parts from assistant messages", () => {
		const input = [
			{
				role: "assistant",
				content: [
					{ type: "reasoning", text: "internal CoT" },
					{ type: "text", text: "Final answer" },
				],
			},
		];
		const out = stripReasoningPartsFromMessages(input);
		expect(out[0]!.content).toEqual([{ type: "text", text: "Final answer" }]);
	});

	it("leaves user messages untouched", () => {
		const input = [{ role: "user", content: [{ type: "text", text: "hi" }] }];
		const out = stripReasoningPartsFromMessages(input);
		expect(out[0]).toBe(input[0]);
	});
});

describe("stripImagePartsFromMessages", () => {
	it("drops file parts with image/* mediaType from user messages", () => {
		const input = [
			{
				role: "user",
				content: [
					{ type: "text", text: "what is this?" },
					{ type: "file", mediaType: "image/png", url: "https://x" },
				],
			},
		];
		const out = stripImagePartsFromMessages(input);
		const content = out[0]!.content as Array<{ type: string; text?: string }>;
		expect(content.some((p) => p.type === "file")).toBe(false);
		// Original text preserved AND prepended with a breadcrumb
		const text = content.find((p) => p.type === "text")?.text ?? "";
		expect(text).toContain("Image attachment was here");
		expect(text).toContain("what is this?");
	});

	it("preserves PDF file parts (only image/* mediaType is dropped)", () => {
		const input = [
			{
				role: "user",
				content: [
					{ type: "text", text: "see attached" },
					{ type: "file", mediaType: "application/pdf", url: "https://x" },
				],
			},
		];
		const out = stripImagePartsFromMessages(input);
		const content = out[0]!.content as Array<{ type: string; mediaType?: string }>;
		expect(content.some((p) => p.type === "file" && p.mediaType === "application/pdf")).toBe(true);
		// No breadcrumb injected when no image was stripped
		const text = (content.find((p) => p.type === "text") as { text?: string }).text;
		expect(text).toBe("see attached");
	});

	it("handles user messages with only an image (no text part) by injecting a text breadcrumb", () => {
		const input = [
			{
				role: "user",
				content: [{ type: "file", mediaType: "image/jpeg", url: "https://x" }],
			},
		];
		const out = stripImagePartsFromMessages(input);
		const content = out[0]!.content as Array<{ type: string; text?: string }>;
		expect(content.length).toBe(1);
		expect(content[0]!.type).toBe("text");
		expect(content[0]!.text).toContain("Image attachment was here");
	});

	it("recognises 'image' typed parts as well as 'file' parts (older shapes)", () => {
		const input = [
			{
				role: "user",
				content: [
					{ type: "text", text: "what is this?" },
					{ type: "image", url: "https://x" },
				],
			},
		];
		const out = stripImagePartsFromMessages(input);
		const content = out[0]!.content as Array<{ type: string }>;
		expect(content.some((p) => p.type === "image")).toBe(false);
	});

	it("leaves assistant messages untouched", () => {
		const input = [{ role: "assistant", content: [{ type: "text", text: "answer" }] }];
		const out = stripImagePartsFromMessages(input);
		expect(out[0]).toBe(input[0]);
	});

	it("leaves user messages with no image parts byte-identical (no breadcrumb)", () => {
		const input = [{ role: "user", content: [{ type: "text", text: "regular question" }] }];
		const out = stripImagePartsFromMessages(input);
		expect(out[0]).toBe(input[0]);
	});
});
