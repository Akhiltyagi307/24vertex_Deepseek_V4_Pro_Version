import { describe, expect, it } from "vitest";

import {
	sanitizeRichAnswerHtmlServer,
	sanitizeStudentAnswerForStorage,
} from "@/lib/practice/rich-answer-sanitize-server";

describe("sanitizeRichAnswerHtmlServer", () => {
	it("strips <script> together with its content", () => {
		expect(sanitizeRichAnswerHtmlServer("<p>hi</p><script>alert(1)</script>")).toBe("<p>hi</p>");
	});

	it("removes event-handler attributes from allowed tags", () => {
		expect(sanitizeRichAnswerHtmlServer('<p onclick="x()">hi</p>')).toBe("<p>hi</p>");
	});

	it("neutralizes javascript: hrefs but keeps safe links and rel", () => {
		expect(sanitizeRichAnswerHtmlServer('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(
			sanitizeRichAnswerHtmlServer('<a href="https://example.com" rel="noopener">x</a>'),
		).toBe('<a href="https://example.com" rel="noopener">x</a>');
	});

	it("drops disallowed tags (e.g. <img onerror>) but keeps their text", () => {
		expect(sanitizeRichAnswerHtmlServer('<div><img src=x onerror=alert(1)>text</div>')).toBe("text");
	});

	it("preserves allowlisted formatting and lists", () => {
		const html = "<p><strong>a</strong> <em>b</em></p><ul><li>x</li></ul>";
		expect(sanitizeRichAnswerHtmlServer(html)).toBe(html);
	});

	it("keeps allowed table attributes and drops others", () => {
		expect(sanitizeRichAnswerHtmlServer('<td colspan="2" style="color:red">c</td>')).toBe(
			'<td colspan="2">c</td>',
		);
	});
});

describe("sanitizeStudentAnswerForStorage", () => {
	it("sanitizes the value of a rich text answer", () => {
		expect(
			sanitizeStudentAnswerForStorage({ kind: "text", value: "<p>ok</p><script>1</script>" }),
		).toEqual({ kind: "text", value: "<p>ok</p>" });
	});

	it("passes mcq / numerical answers through untouched", () => {
		expect(sanitizeStudentAnswerForStorage({ kind: "mcq", value: "B" })).toEqual({ kind: "mcq", value: "B" });
		expect(sanitizeStudentAnswerForStorage({ kind: "numerical", value: "3.14" })).toEqual({
			kind: "numerical",
			value: "3.14",
		});
	});
});
