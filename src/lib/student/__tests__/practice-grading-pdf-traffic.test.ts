import { describe, expect, it } from "vitest";

import {
	PDF_BRAND,
	PDF_TRAFFIC,
	pdfTrafficFromScorePercent,
	pdfTrafficFromVerdict,
} from "@/lib/student/practice-grading-pdf-traffic";

describe("practice-grading-pdf-traffic", () => {
	it("maps verdicts to green, amber, and orange signal bands", () => {
		expect(pdfTrafficFromVerdict("correct").signalIndex).toBe(0);
		expect(pdfTrafficFromVerdict("partially_correct").signalIndex).toBe(1);
		expect(pdfTrafficFromVerdict("incorrect").signalIndex).toBe(2);
	});

	it("never uses red border colors on incorrect band", () => {
		const incorrect = pdfTrafficFromVerdict("incorrect");
		expect(incorrect.pillBorder.toLowerCase()).not.toContain("#ef");
		expect(incorrect.pillBorder.toLowerCase()).not.toContain("#e5");
		expect(incorrect.scoreBorder).toBe(incorrect.pillBorder);
	});

	it("uses solid brand green hex for summary chip borders (no rgba)", () => {
		expect(PDF_TRAFFIC.chipBorder).toBe("#2ea070");
		expect(PDF_TRAFFIC.chipBorder).toBe(PDF_BRAND.greenBorder);
		expect(PDF_TRAFFIC.chipInk).toBe(PDF_BRAND.greenDeep);
		expect(PDF_BRAND.greenBorder.startsWith("#")).toBe(true);
		expect(PDF_BRAND.greenBorder.toLowerCase()).not.toContain("rgba");
		expect(PDF_BRAND.greenBorder.toLowerCase()).not.toContain("e8b4");
		expect(PDF_BRAND.greenBorder.toLowerCase()).not.toContain("f59e");
	});

	it("maps topic average scores with 75 / 50 thresholds", () => {
		expect(pdfTrafficFromScorePercent(80)?.signalIndex).toBe(0);
		expect(pdfTrafficFromScorePercent(60)?.signalIndex).toBe(1);
		expect(pdfTrafficFromScorePercent(20)?.signalIndex).toBe(2);
	});
});
