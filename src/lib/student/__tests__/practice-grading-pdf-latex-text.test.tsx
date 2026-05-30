import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { PdfLatexText } from "../practice-grading-pdf-latex-text";

async function renderLatexParagraph(text: string): Promise<Buffer> {
	const buf = await renderToBuffer(
		<Document>
			<Page size="A4" style={{ padding: 40 }}>
				<PdfLatexText style={{ fontSize: 10 }}>{text}</PdfLatexText>
			</Page>
		</Document>,
	);
	return buf instanceof Buffer ? buf : Buffer.from(buf);
}

describe("PdfLatexText — render smoke", () => {
	it("renders a valid PDF with inline KaTeX", async () => {
		const buf = await renderLatexParagraph(
			"Therefore, work done = $force \\times displacement = 5\\ \\mathrm{N} \\times 0\\ \\mathrm{m} = 0\\ \\mathrm{J}$.",
		);
		expect(buf.length).toBeGreaterThan(500);
		expect(buf.slice(0, 4).toString()).toBe("%PDF");
	});

	it("renders normalized malformed delimiters from answer keys", async () => {
		const buf = await renderLatexParagraph(
			"Therefore, work done = forc$e \\times displacement = 5$ $N \\times 0$ m = 0 J.",
		);
		expect(buf.length).toBeGreaterThan(500);
		expect(buf.slice(0, 4).toString()).toBe("%PDF");
	});
});
