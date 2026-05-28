import { afterEach, describe, expect, it } from "vitest";

import {
	getPracticeVisualEnrichmentBatchSize,
	getPracticeVisualStemGroundingMode,
	isPracticeVisualEnrichmentEnabled,
	isPracticeVisualTemplateEngineEnabled,
} from "../env";

const ORIGINAL_VISUALS = process.env.PRACTICE_VISUALS;
const ORIGINAL_ENRICHMENT = process.env.PRACTICE_VISUAL_ENRICHMENT;
const ORIGINAL_BATCH = process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE;
const ORIGINAL_GROUNDING = process.env.PRACTICE_VISUAL_STEM_GROUNDING;
const ORIGINAL_TEMPLATE_ENGINE = process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE;

afterEach(() => {
	if (ORIGINAL_VISUALS === undefined) delete process.env.PRACTICE_VISUALS;
	else process.env.PRACTICE_VISUALS = ORIGINAL_VISUALS;

	if (ORIGINAL_ENRICHMENT === undefined) delete process.env.PRACTICE_VISUAL_ENRICHMENT;
	else process.env.PRACTICE_VISUAL_ENRICHMENT = ORIGINAL_ENRICHMENT;

	if (ORIGINAL_BATCH === undefined) delete process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE;
	else process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE = ORIGINAL_BATCH;

	if (ORIGINAL_GROUNDING === undefined) delete process.env.PRACTICE_VISUAL_STEM_GROUNDING;
	else process.env.PRACTICE_VISUAL_STEM_GROUNDING = ORIGINAL_GROUNDING;

	if (ORIGINAL_TEMPLATE_ENGINE === undefined) delete process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE;
	else process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE = ORIGINAL_TEMPLATE_ENGINE;
});

describe("isPracticeVisualEnrichmentEnabled", () => {
	it("inherits PRACTICE_VISUALS when explicit enrichment flag is unset", () => {
		delete process.env.PRACTICE_VISUAL_ENRICHMENT;
		process.env.PRACTICE_VISUALS = "true";
		expect(isPracticeVisualEnrichmentEnabled()).toBe(true);

		process.env.PRACTICE_VISUALS = "false";
		expect(isPracticeVisualEnrichmentEnabled()).toBe(false);
	});

	it("respects explicit PRACTICE_VISUAL_ENRICHMENT override", () => {
		process.env.PRACTICE_VISUALS = "true";
		process.env.PRACTICE_VISUAL_ENRICHMENT = "false";
		expect(isPracticeVisualEnrichmentEnabled()).toBe(false);

		process.env.PRACTICE_VISUALS = "false";
		process.env.PRACTICE_VISUAL_ENRICHMENT = "true";
		expect(isPracticeVisualEnrichmentEnabled()).toBe(true);
	});
});

describe("getPracticeVisualEnrichmentBatchSize", () => {
	it("defaults to 2 when unset", () => {
		delete process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE;
		expect(getPracticeVisualEnrichmentBatchSize()).toBe(2);
	});

	it("clamps and parses configured values", () => {
		process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE = "4";
		expect(getPracticeVisualEnrichmentBatchSize()).toBe(4);

		process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE = "0";
		expect(getPracticeVisualEnrichmentBatchSize()).toBe(1);

		process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE = "99";
		// Upper clamp was raised from 6 → 30 in commit 076707b (per-question
		// visual enrichment). Test was not updated at the time.
		expect(getPracticeVisualEnrichmentBatchSize()).toBe(30);
	});
});

describe("getPracticeVisualStemGroundingMode", () => {
	it("defaults to off", () => {
		delete process.env.PRACTICE_VISUAL_STEM_GROUNDING;
		expect(getPracticeVisualStemGroundingMode()).toBe("off");
	});

	it("supports shadow and enforce aliases", () => {
		process.env.PRACTICE_VISUAL_STEM_GROUNDING = "shadow";
		expect(getPracticeVisualStemGroundingMode()).toBe("shadow");

		process.env.PRACTICE_VISUAL_STEM_GROUNDING = "enforce";
		expect(getPracticeVisualStemGroundingMode()).toBe("enforce");

		process.env.PRACTICE_VISUAL_STEM_GROUNDING = "true";
		expect(getPracticeVisualStemGroundingMode()).toBe("enforce");
	});
});

describe("isPracticeVisualTemplateEngineEnabled", () => {
	it("is controlled by PRACTICE_VISUAL_TEMPLATE_ENGINE", () => {
		delete process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE;
		expect(isPracticeVisualTemplateEngineEnabled()).toBe(false);

		process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE = "true";
		expect(isPracticeVisualTemplateEngineEnabled()).toBe(true);

		process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE = "false";
		expect(isPracticeVisualTemplateEngineEnabled()).toBe(false);
	});
});
