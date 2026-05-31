import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./teacher-class-insight-cache", () => ({
	lookupCachedInsight: vi.fn(),
	upsertCachedInsight: vi.fn(),
	markClassInsightServed: vi.fn(),
}));
vi.mock("./teacher-class-insight", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./teacher-class-insight")>();
	return { ...actual, generateTeacherClassInsight: vi.fn() };
});

import {
	lookupCachedInsight,
	markClassInsightServed,
	upsertCachedInsight,
} from "./teacher-class-insight-cache";
import {
	computeInsightFingerprint,
	generateTeacherClassInsight,
	PROMPT_VERSION,
	type TeacherClassInsight,
} from "./teacher-class-insight";
import {
	getOrGenerateClassInsight,
	lookupClassInsightOnly,
} from "./teacher-class-insight-service";
import type { TeacherClassPerformanceSummary } from "./teacher-class-performance-summary-types";

const insight: TeacherClassInsight = {
	headline: "Headline",
	narrative: "Narrative",
	actions: [{ title: "Title", detail: "Detail" }],
};

const baseSummary: TeacherClassPerformanceSummary = {
	studentsInScope: 5,
	studentsWithRecentScores: 4,
	classAveragePercent: 68,
	recentGradedItemsUsed: 12,
	recentWindowSize: 5,
	performanceBands: [],
	upliftOpportunities: [],
};

const emptySummary: TeacherClassPerformanceSummary = {
	...baseSummary,
	studentsWithRecentScores: 0,
	classAveragePercent: null,
	recentGradedItemsUsed: 0,
};

const scope = { grade: null, section: null, subjectId: null };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getOrGenerateClassInsight", () => {
	it("returns insufficient_data without hitting the cache or the model", async () => {
		const out = await getOrGenerateClassInsight({
			teacherUserId: "t",
			organizationId: null,
			scope,
			scopeLabel: "x",
			summary: emptySummary,
		});
		expect(out).toEqual({ status: "insufficient_data" });
		expect(lookupCachedInsight).not.toHaveBeenCalled();
		expect(generateTeacherClassInsight).not.toHaveBeenCalled();
	});

	it("serves from cache when the fingerprint matches (no generation, no upsert)", async () => {
		const fingerprint = computeInsightFingerprint(baseSummary, PROMPT_VERSION);
		vi.mocked(lookupCachedInsight).mockResolvedValue({ id: "row-1", dataFingerprint: fingerprint, insight });

		const out = await getOrGenerateClassInsight({
			teacherUserId: "t",
			organizationId: null,
			scope,
			scopeLabel: "x",
			summary: baseSummary,
		});

		expect(out).toEqual({ status: "ok", insight, source: "cache" });
		expect(generateTeacherClassInsight).not.toHaveBeenCalled();
		expect(upsertCachedInsight).not.toHaveBeenCalled();
		expect(markClassInsightServed).toHaveBeenCalledWith("row-1");
	});

	it("regenerates and upserts on a cache miss", async () => {
		vi.mocked(lookupCachedInsight).mockResolvedValue(null);
		vi.mocked(generateTeacherClassInsight).mockResolvedValue({ status: "ok", insight });

		const out = await getOrGenerateClassInsight({
			teacherUserId: "t",
			organizationId: "org",
			scope,
			scopeLabel: "x",
			summary: baseSummary,
		});

		expect(out).toEqual({ status: "ok", insight, source: "fresh" });
		expect(generateTeacherClassInsight).toHaveBeenCalledOnce();
		expect(upsertCachedInsight).toHaveBeenCalledOnce();
		expect(markClassInsightServed).not.toHaveBeenCalled();
	});

	it("regenerates when the stored fingerprint is stale", async () => {
		vi.mocked(lookupCachedInsight).mockResolvedValue({ id: "row-1", dataFingerprint: "stale", insight });
		vi.mocked(generateTeacherClassInsight).mockResolvedValue({ status: "ok", insight });

		const out = await getOrGenerateClassInsight({
			teacherUserId: "t",
			organizationId: null,
			scope,
			scopeLabel: "x",
			summary: baseSummary,
		});

		expect(out).toEqual({ status: "ok", insight, source: "fresh" });
		expect(generateTeacherClassInsight).toHaveBeenCalledOnce();
	});

	it("skips the cache entirely when forceFresh is set (explicit Regenerate)", async () => {
		const fingerprint = computeInsightFingerprint(baseSummary, PROMPT_VERSION);
		vi.mocked(lookupCachedInsight).mockResolvedValue({ id: "row-1", dataFingerprint: fingerprint, insight });
		vi.mocked(generateTeacherClassInsight).mockResolvedValue({ status: "ok", insight });

		const out = await getOrGenerateClassInsight({
			teacherUserId: "t",
			organizationId: null,
			scope,
			scopeLabel: "x",
			summary: baseSummary,
			forceFresh: true,
		});

		expect(out).toEqual({ status: "ok", insight, source: "fresh" });
		expect(lookupCachedInsight).not.toHaveBeenCalled();
		expect(generateTeacherClassInsight).toHaveBeenCalledOnce();
	});
});

describe("lookupClassInsightOnly", () => {
	it("returns miss when nothing usable is cached, without generating", async () => {
		vi.mocked(lookupCachedInsight).mockResolvedValue(null);
		const out = await lookupClassInsightOnly({ teacherUserId: "t", scope, summary: baseSummary });
		expect(out).toEqual({ status: "miss" });
		expect(generateTeacherClassInsight).not.toHaveBeenCalled();
	});

	it("returns the cached insight when the fingerprint matches", async () => {
		const fingerprint = computeInsightFingerprint(baseSummary, PROMPT_VERSION);
		vi.mocked(lookupCachedInsight).mockResolvedValue({ id: "row-1", dataFingerprint: fingerprint, insight });
		const out = await lookupClassInsightOnly({ teacherUserId: "t", scope, summary: baseSummary });
		expect(out).toEqual({ status: "ok", insight, source: "cache" });
		expect(markClassInsightServed).toHaveBeenCalledWith("row-1");
	});

	it("treats an empty scope as insufficient_data", async () => {
		const out = await lookupClassInsightOnly({ teacherUserId: "t", scope, summary: emptySummary });
		expect(out).toEqual({ status: "insufficient_data" });
		expect(lookupCachedInsight).not.toHaveBeenCalled();
	});
});
