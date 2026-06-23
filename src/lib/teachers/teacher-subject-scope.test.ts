import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// `db.select(...)` returns a chainable builder whose awaited value is `nextRows`.
let nextRows: Array<{ id: string; grade: number | null }> = [];
const selectSpy = vi.fn();

function chain() {
	const c: Record<string, unknown> = {
		from: () => c,
		where: () => c,
		orderBy: () => c,
		then: (resolve: (v: unknown) => unknown) => resolve(nextRows),
	};
	return c;
}

vi.mock("@/db", () => ({
	db: {
		select: (...args: unknown[]) => {
			selectSpy(...args);
			return chain();
		},
	},
}));

const listActiveSubjectsCatalog = vi.fn();
vi.mock("@/lib/teachers/subjects-catalog", () => ({ listActiveSubjectsCatalog }));

const ORG = "org-1";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const S3 = "33333333-3333-4333-8333-333333333333";

async function importModule() {
	return import("@/lib/teachers/teacher-subject-scope");
}

beforeEach(() => {
	vi.resetAllMocks();
	nextRows = [];
});

describe("getTeacherSubjectScope", () => {
	it("is unscoped (no DB query) when there is no active organization", async () => {
		const { getTeacherSubjectScope } = await importModule();
		const scope = await getTeacherSubjectScope({ activeOrganizationId: null, subjectsTaught: [S1] });
		expect(scope).toEqual({ isScoped: false, subjectIds: [], grades: [] });
		expect(selectSpy).not.toHaveBeenCalled();
	});

	it("is unscoped (no DB query) when subjects_taught is empty or null", async () => {
		const { getTeacherSubjectScope } = await importModule();
		expect(await getTeacherSubjectScope({ activeOrganizationId: ORG, subjectsTaught: [] })).toEqual({
			isScoped: false,
			subjectIds: [],
			grades: [],
		});
		expect(await getTeacherSubjectScope({ activeOrganizationId: ORG, subjectsTaught: null })).toEqual({
			isScoped: false,
			subjectIds: [],
			grades: [],
		});
		expect(selectSpy).not.toHaveBeenCalled();
	});

	it("returns distinct, sorted grades and the taught ids when scoped", async () => {
		nextRows = [
			{ id: S1, grade: 9 },
			{ id: S2, grade: 9 },
			{ id: S3, grade: 11 },
		];
		const { getTeacherSubjectScope } = await importModule();
		const scope = await getTeacherSubjectScope({ activeOrganizationId: ORG, subjectsTaught: [S1, S2, S3] });
		expect(scope).toEqual({ isScoped: true, subjectIds: [S1, S2, S3], grades: [9, 11] });
		expect(selectSpy).toHaveBeenCalledTimes(1);
	});

	it("stays scoped-but-empty (fail-closed) when every taught subject is inactive", async () => {
		nextRows = [];
		const { getTeacherSubjectScope } = await importModule();
		const scope = await getTeacherSubjectScope({ activeOrganizationId: ORG, subjectsTaught: [S1] });
		expect(scope).toEqual({ isScoped: true, subjectIds: [], grades: [] });
	});
});

describe("listTeacherScopedSubjectsCatalog", () => {
	const catalog = [
		{ id: S1, name: "Physics", grade: 11, stream: "science" },
		{ id: S2, name: "Maths", grade: 9, stream: null },
		{ id: S3, name: "History", grade: 9, stream: null },
	];

	it("returns the full active catalog when unscoped", async () => {
		listActiveSubjectsCatalog.mockResolvedValue(catalog);
		const { listTeacherScopedSubjectsCatalog } = await importModule();
		const result = await listTeacherScopedSubjectsCatalog({ activeOrganizationId: null, subjectsTaught: [] });
		expect(result).toEqual(catalog);
	});

	it("intersects the catalog with the taught subjects when scoped", async () => {
		listActiveSubjectsCatalog.mockResolvedValue(catalog);
		nextRows = [{ id: S1, grade: 11 }];
		const { listTeacherScopedSubjectsCatalog } = await importModule();
		const result = await listTeacherScopedSubjectsCatalog({ activeOrganizationId: ORG, subjectsTaught: [S1] });
		expect(result).toEqual([catalog[0]]);
	});
});

describe("coerceFiltersToScope", () => {
	const scope = { isScoped: true, subjectIds: [S1], grades: [11] };

	it("is a no-op when unscoped", async () => {
		const { coerceFiltersToScope } = await importModule();
		expect(
			coerceFiltersToScope({ isScoped: false, subjectIds: [], grades: [] }, { grade: 6, subjectId: S2 }),
		).toEqual({ grade: 6, subjectId: S2 });
	});

	it("keeps in-scope grade and subject", async () => {
		const { coerceFiltersToScope } = await importModule();
		expect(coerceFiltersToScope(scope, { grade: 11, subjectId: S1 })).toEqual({ grade: 11, subjectId: S1 });
	});

	it("clamps an out-of-scope grade to all", async () => {
		const { coerceFiltersToScope } = await importModule();
		expect(coerceFiltersToScope(scope, { grade: 9, subjectId: S1 })).toEqual({ grade: "all", subjectId: S1 });
	});

	it("clamps an out-of-scope subject to all", async () => {
		const { coerceFiltersToScope } = await importModule();
		expect(coerceFiltersToScope(scope, { grade: 11, subjectId: S2 })).toEqual({ grade: 11, subjectId: "all" });
	});

	it("always lets all pass through", async () => {
		const { coerceFiltersToScope } = await importModule();
		expect(coerceFiltersToScope(scope, { grade: "all", subjectId: "all" })).toEqual({
			grade: "all",
			subjectId: "all",
		});
	});
});

describe("isSubjectOutOfScope", () => {
	it("is always false when unscoped", async () => {
		const { isSubjectOutOfScope } = await importModule();
		expect(isSubjectOutOfScope({ isScoped: false, subjectIds: [], grades: [] }, S2)).toBe(false);
	});

	it("is true only for a subject the scoped teacher does not teach", async () => {
		const { isSubjectOutOfScope } = await importModule();
		const scope = { isScoped: true, subjectIds: [S1], grades: [11] };
		expect(isSubjectOutOfScope(scope, S1)).toBe(false);
		expect(isSubjectOutOfScope(scope, S2)).toBe(true);
	});
});
