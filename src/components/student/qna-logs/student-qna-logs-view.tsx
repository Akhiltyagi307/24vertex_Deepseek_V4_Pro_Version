"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { QnaLogDetailDialog } from "./qna-log-detail-dialog";
import { QnaLogsTable } from "./qna-logs-table";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterDatePickerField } from "@/components/ui/filter-date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { InitialQnaLogPayload } from "@/lib/student/qna-logs/load-initial-qna-log-payload";
import type { ParsedQnaLogQueryParams } from "@/lib/student/qna-logs/qna-log-query-params";
import type {
	QnaLogDetail,
	QnaLogListResult,
	QnaLogSortKey,
} from "@/lib/student/qna-logs/types";
import { cn } from "@/lib/utils";

type Props = {
	apiBasePath: "/api/student/qna-logs" | "/api/parent/qna-logs";
	parentViewer?: boolean;
	/** First page rendered on the server so the table appears without a client round-trip. */
	initialListPayload?: InitialQnaLogPayload | null;
};

type ListApiResponse = {
	data: QnaLogListResult;
	query: ParsedQnaLogQueryParams;
};

const filterLabelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const allQuestionTypesValue = "__all_question_types__";
const QNA_LOG_PREFETCH_COUNT = 5;
const allowedKeys = new Set([
	"page",
	"page_size",
	"q",
	"subject",
	"source",
	"performance",
	"type",
	"sort",
	"dir",
	"from",
	"to",
	"a",
]);

function sanitizeQuery(searchParams: URLSearchParams): URLSearchParams {
	const out = new URLSearchParams();
	for (const [key, value] of searchParams.entries()) {
		if (allowedKeys.has(key)) out.set(key, value);
	}
	return out;
}

function parseActiveAnswerId(raw: string | null): string | null {
	if (!raw) return null;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
}

export function StudentQnaLogsView({
	apiBasePath,
	parentViewer = false,
	initialListPayload = null,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const skipInitialClientFetchRef = useRef(Boolean(initialListPayload));

	const [listData, setListData] = useState<QnaLogListResult | null>(initialListPayload?.data ?? null);
	const [queryState, setQueryState] = useState<ParsedQnaLogQueryParams | null>(
		initialListPayload?.query ?? null,
	);
	const [listLoading, setListLoading] = useState(!initialListPayload);
	const [listRefreshing, setListRefreshing] = useState(false);
	const [listError, setListError] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");

	const [detailCache, setDetailCache] = useState<Record<string, QnaLogDetail>>({});
	const detailCacheRef = useRef(detailCache);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [navPending, setNavPending] = useState(false);
	const [activeAbsoluteIndex, setActiveAbsoluteIndex] = useState<number | null>(null);
	const listDataRef = useRef<QnaLogListResult | null>(initialListPayload?.data ?? null);

	useEffect(() => {
		detailCacheRef.current = detailCache;
	}, [detailCache]);

	const sanitizedParams = useMemo(() => sanitizeQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
	const activeAnswerId = useMemo(() => parseActiveAnswerId(sanitizedParams.get("a")), [sanitizedParams]);

	const listQueryParams = useMemo(() => {
		const p = new URLSearchParams(sanitizedParams.toString());
		p.delete("a");
		return p;
	}, [sanitizedParams]);

	const rows = useMemo(() => listData?.rows ?? [], [listData]);
	const total = listData?.total ?? 0;
	const page = queryState?.page ?? 1;
	const pageSize = queryState?.pageSize ?? 50;
	const totalPages = Math.max(1, Math.ceil((total || 1) / pageSize));
	const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

	const activeDetail = activeAnswerId ? detailCache[activeAnswerId] ?? null : null;

	const updateUrlParams = useCallback(
		(mutator: (params: URLSearchParams) => void) => {
			const next = sanitizeQuery(new URLSearchParams(searchParams.toString()));
			mutator(next);
			if (next.get("page") === "1") next.delete("page");
			const qs = next.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		},
		[pathname, router, searchParams],
	);

	const updateListParams = useCallback(
		(mutator: (params: URLSearchParams) => void) => {
			updateUrlParams((next) => {
				next.delete("a");
				mutator(next);
			});
		},
		[updateUrlParams],
	);

	const setActiveAnswer = useCallback(
		(answerId: string | null) => {
			updateUrlParams((next) => {
				if (answerId) next.set("a", answerId);
				else next.delete("a");
			});
		},
		[updateUrlParams],
	);

	useEffect(() => {
		if (skipInitialClientFetchRef.current) {
			skipInitialClientFetchRef.current = false;
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		async function loadList() {
			const showFullSkeleton = listDataRef.current == null;
			if (showFullSkeleton) setListLoading(true);
			else setListRefreshing(true);
			setListError(null);
			try {
				const res = await fetch(`${apiBasePath}?${listQueryParams.toString()}`, {
					credentials: "same-origin",
					signal: controller.signal,
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? "Could not load QnA logs.");
				}
				const json = (await res.json()) as ListApiResponse;
				if (cancelled) return;
				listDataRef.current = json.data;
				setListData(json.data);
				setQueryState(json.query);
			} catch (error) {
				if (cancelled || controller.signal.aborted) return;
				setListError(error instanceof Error ? error.message : "Could not load QnA logs.");
			} finally {
				if (!cancelled) {
					setListLoading(false);
					setListRefreshing(false);
				}
			}
		}
		void loadList();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [apiBasePath, listQueryParams]);

	useEffect(() => {
		if (!queryState) return;
		setSearchInput(queryState.filters.query ?? "");
	}, [queryState]);

	useEffect(() => {
		if (!activeAnswerId || detailCache[activeAnswerId]) return;
		const answerId = activeAnswerId;
		let cancelled = false;
		const controller = new AbortController();
		async function loadDetail() {
			setDetailLoading(true);
			setDetailError(null);
			try {
				const res = await fetch(`${apiBasePath}/${answerId}`, {
					credentials: "same-origin",
					signal: controller.signal,
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? "Could not load question details.");
				}
				const json = (await res.json()) as { detail?: QnaLogDetail | null };
				if (!cancelled && json.detail) {
					setDetailCache((prev) => ({ ...prev, [answerId]: json.detail as QnaLogDetail }));
				}
			} catch (error) {
				if (cancelled || controller.signal.aborted) return;
				setDetailError(error instanceof Error ? error.message : "Could not load question details.");
			} finally {
				if (!cancelled) setDetailLoading(false);
			}
		}
		void loadDetail();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [activeAnswerId, apiBasePath, detailCache]);

	useEffect(() => {
		if (!activeAnswerId || !queryState) {
			setActiveAbsoluteIndex(null);
			return;
		}
		const rowIndex = rows.findIndex((row) => row.answerId === activeAnswerId);
		if (rowIndex >= 0) {
			setActiveAbsoluteIndex((queryState.page - 1) * queryState.pageSize + rowIndex + 1);
		}
	}, [activeAnswerId, queryState, rows]);

	useEffect(() => {
		if (!queryState) return;
		const handle = window.setTimeout(() => {
			const current = queryState.filters.query ?? "";
			if (searchInput.trim() === current) return;
			updateListParams((next) => {
				const normalized = searchInput.trim();
				if (normalized) next.set("q", normalized);
				else next.delete("q");
				next.set("page", "1");
			});
		}, 300);
		return () => window.clearTimeout(handle);
	}, [queryState, searchInput, updateListParams]);

	const onOpenRow = useCallback(
		(row: QnaLogListResult["rows"][number], rowIndex: number) => {
			setDetailError(null);
			setActiveAbsoluteIndex((page - 1) * pageSize + rowIndex + 1);
			setActiveAnswer(row.answerId);
		},
		[page, pageSize, setActiveAnswer],
	);

	const fetchDetailById = useCallback(
		async (answerId: string, signal?: AbortSignal) => {
			if (detailCacheRef.current[answerId]) return;
			const res = await fetch(`${apiBasePath}/${answerId}`, {
				credentials: "same-origin",
				signal,
			});
			if (!res.ok) return;
			const json = (await res.json()) as { detail?: QnaLogDetail | null };
			if (!json.detail) return;
			setDetailCache((prev) => ({ ...prev, [answerId]: json.detail as QnaLogDetail }));
		},
		[apiBasePath],
	);

	const onNavigate = useCallback(
		async (direction: "prev" | "next") => {
			if (!activeAnswerId || !queryState || navPending) return;

			const rowIndex = rows.findIndex((row) => row.answerId === activeAnswerId);
			if (rowIndex >= 0) {
				const targetIndex = direction === "next" ? rowIndex + 1 : rowIndex - 1;
				if (targetIndex >= 0 && targetIndex < rows.length) {
					const target = rows[targetIndex];
					setDetailError(null);
					setActiveAnswer(target.answerId);
					setActiveAbsoluteIndex((page - 1) * pageSize + targetIndex + 1);
					if (!detailCacheRef.current[target.answerId]) {
						void fetchDetailById(target.answerId);
					}
					return;
				}
			}

			setNavPending(true);
			setDetailError(null);
			try {
				const params = new URLSearchParams(listQueryParams.toString());
				params.set("a", activeAnswerId);
				params.set("move", direction);
				const res = await fetch(`${apiBasePath}/nav?${params.toString()}`, {
					credentials: "same-origin",
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? "Could not load adjacent question.");
				}
				const json = (await res.json()) as {
					answerId: string | null;
					detail: QnaLogDetail | null;
				};
				if (!json.answerId) return;
				if (json.detail) {
					setDetailCache((prev) => ({ ...prev, [json.answerId as string]: json.detail as QnaLogDetail }));
				}
				setActiveAnswer(json.answerId);
				setActiveAbsoluteIndex((prev) => {
					if (prev == null) return null;
					const delta = direction === "next" ? 1 : -1;
					const next = prev + delta;
					if (next < 1) return 1;
					if (total > 0 && next > total) return total;
					return next;
				});
			} catch (error) {
				setDetailError(error instanceof Error ? error.message : "Could not load adjacent question.");
			} finally {
				setNavPending(false);
			}
		},
		[
			activeAnswerId,
			apiBasePath,
			fetchDetailById,
			listQueryParams,
			navPending,
			page,
			pageSize,
			queryState,
			rows,
			setActiveAnswer,
			total,
		],
	);

	useEffect(() => {
		if (!activeAnswerId) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const tagName = target?.tagName?.toLowerCase();
			const isEditable =
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select" ||
				Boolean(target?.isContentEditable);
			if (isEditable) return;

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				void onNavigate("prev");
				return;
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				void onNavigate("next");
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [activeAnswerId, onNavigate]);

	useEffect(() => {
		if (!activeAnswerId || rows.length === 0) return;
		const idx = rows.findIndex((row) => row.answerId === activeAnswerId);
		if (idx < 0) return;
		const candidates = Array.from(
			new Set(
				rows
					.slice(idx + 1, idx + 1 + QNA_LOG_PREFETCH_COUNT)
					.map((row) => row.answerId)
					.filter(Boolean),
			),
		)
			.filter((answerId) => !detailCacheRef.current[answerId])
			.slice(0, QNA_LOG_PREFETCH_COUNT);
		if (candidates.length === 0) return;
		void Promise.all(candidates.map((answerId) => fetchDetailById(answerId)));
	}, [activeAnswerId, fetchDetailById, rows]);

	const canPrev = activeAbsoluteIndex == null ? true : activeAbsoluteIndex > 1;
	const canNext = activeAbsoluteIndex == null ? true : activeAbsoluteIndex < total;
	const positionLabel =
		total <= 0 ? "No questions"
		: activeAbsoluteIndex != null ? `Question ${activeAbsoluteIndex} of ${total}`
		:	"Loading position…";
	const dialogVoice: "self" | "child" = parentViewer ? "child" : "self";

	const subjectOptions = listData?.subjectOptions ?? [];

	return (
		<div className="flex w-full min-w-0 flex-col gap-4 py-6 pb-28 medium:gap-8 medium:py-8">
			<header className="flex shrink-0 flex-col gap-1.5">
				<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">
					QnA logs
				</h1>
				<PageHeaderSubtext>
					{parentViewer ?
						"Review every question your child saw in practice tests and assignments."
					:	"Review every question from your practice tests and assignments."}
				</PageHeaderSubtext>
			</header>

			{listError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load QnA logs</AlertTitle>
					<AlertDescription>{listError}</AlertDescription>
				</Alert>
			) : null}

			<Card className="overflow-hidden p-0 shadow-none">
				<div className="border-b border-border p-4 medium:p-5">
					<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-4">
						<div className="space-y-2">
							<Label htmlFor="qna-search" className={filterLabelClass}>
								Search
							</Label>
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
								<Input
									id="qna-search"
									value={searchInput}
									onChange={(event) => setSearchInput(event.target.value)}
									placeholder="Question, topic, chapter…"
									className="pl-8"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<p className={filterLabelClass}>Subject</p>
							<ReportsPillSelect
								menuTitle="Subject"
								ariaLabel="Filter by subject"
								icon={Search}
								fullWidth
								value={queryState?.filters.subjectId ?? ""}
								options={[
									{ value: "", label: "All subjects" },
									...subjectOptions.map((subject) => ({ value: subject.id, label: subject.name })),
								]}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (value) next.set("subject", value);
										else next.delete("subject");
										next.set("page", "1");
									})
								}
							/>
						</div>

						<div className="space-y-2">
							<p className={filterLabelClass}>Source</p>
							<ReportsPillSelect
								menuTitle="Source"
								ariaLabel="Filter by source"
								icon={Search}
								fullWidth
								value={queryState?.filters.source ?? ""}
								options={[
									{ value: "", label: "All sources" },
									{ value: "practice", label: "Practice" },
									{ value: "assignment", label: "Assignment" },
								]}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (value) next.set("source", value);
										else next.delete("source");
										next.set("page", "1");
									})
								}
							/>
						</div>

						<div className="space-y-2">
							<p className={filterLabelClass}>Performance</p>
							<ReportsPillSelect
								menuTitle="Performance"
								ariaLabel="Filter by performance"
								icon={Search}
								fullWidth
								value={queryState?.filters.performance ?? ""}
								options={[
									{ value: "", label: "All results" },
									{ value: "correct", label: "Correct" },
									{ value: "partial", label: "Partial" },
									{ value: "incorrect", label: "Incorrect" },
									{ value: "pending", label: "Pending" },
								]}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (value) next.set("performance", value);
										else next.delete("performance");
										next.set("page", "1");
									})
								}
							/>
						</div>
					</div>

					<div className="mt-4 grid gap-4 medium:grid-cols-2 xl:grid-cols-5">
						<div className="space-y-2">
							<Label className={filterLabelClass}>Question type</Label>
							<Select
								value={queryState?.filters.questionType ?? allQuestionTypesValue}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (!value || value === allQuestionTypesValue) next.delete("type");
										else next.set("type", value);
										next.set("page", "1");
									})
								}
							>
								<SelectTrigger className="h-9">
									<SelectValue placeholder="All types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={allQuestionTypesValue}>All types</SelectItem>
									<SelectItem value="multiple_choice">Multiple choice</SelectItem>
									<SelectItem value="fill_in_blank">Fill in the blank</SelectItem>
									<SelectItem value="short_answer">Short answer</SelectItem>
									<SelectItem value="long_answer">Long answer</SelectItem>
									<SelectItem value="numerical">Numerical</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label className={filterLabelClass}>Sort by</Label>
							<Select
								value={(queryState?.sort.key ?? "date") as QnaLogSortKey}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (!value) return;
										next.set("sort", value);
										next.set("page", "1");
									})
								}
							>
								<SelectTrigger className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="date">Date</SelectItem>
									<SelectItem value="subject">Subject</SelectItem>
									<SelectItem value="performance">Performance</SelectItem>
									<SelectItem value="type">Question type</SelectItem>
									<SelectItem value="topic">Topic</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label className={filterLabelClass}>Sort order</Label>
							<Select
								value={queryState?.sort.dir ?? "desc"}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (!value) return;
										next.set("dir", value);
										next.set("page", "1");
									})
								}
							>
								<SelectTrigger className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="desc">Descending</SelectItem>
									<SelectItem value="asc">Ascending</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="qna-from" className={filterLabelClass}>
								From date
							</Label>
							<FilterDatePickerField
								id="qna-from"
								placeholder="Any date"
								value={queryState?.filters.fromDateKey ?? null}
								maxDateKey={queryState?.filters.toDateKey ?? null}
								onValueChange={(dateKey) =>
									updateListParams((next) => {
										if (dateKey) next.set("from", dateKey);
										else next.delete("from");
										next.set("page", "1");
									})
								}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="qna-to" className={filterLabelClass}>
								To date
							</Label>
							<FilterDatePickerField
								id="qna-to"
								placeholder="Any date"
								value={queryState?.filters.toDateKey ?? null}
								minDateKey={queryState?.filters.fromDateKey ?? null}
								onValueChange={(dateKey) =>
									updateListParams((next) => {
										if (dateKey) next.set("to", dateKey);
										else next.delete("to");
										next.set("page", "1");
									})
								}
							/>
						</div>
					</div>
				</div>

				{listLoading && !listData ? (
					<div className="space-y-2 p-4 medium:p-5">
						{Array.from({ length: 8 }).map((_, index) => (
							<Skeleton key={index} className="h-12 w-full rounded-md" />
						))}
					</div>
				) : rows.length === 0 ? (
					<div className="px-4 py-10 text-center text-muted-foreground">
						{total === 0 ?
							"Complete a practice test or assignment to build your QnA log."
						:	"No questions match the current filters."}
					</div>
				) : (
					<div
						className={cn(
							"relative transition-opacity duration-200 ease-out",
							listRefreshing && "pointer-events-none opacity-60",
						)}
					>
						<QnaLogsTable rows={rows} highlightAnswerId={activeAnswerId} onOpenRow={onOpenRow} />
					</div>
				)}

				<div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm medium:flex-row medium:items-center medium:justify-between">
					<p className="text-muted-foreground">
						Showing{" "}
						<span className="font-medium text-foreground tabular-nums">
							{rangeStart}
						</span>
						–
						<span className="font-medium text-foreground tabular-nums">
							{rangeEnd}
						</span>{" "}
						of{" "}
						<span className="font-medium text-foreground tabular-nums">
							{total}
						</span>
					</p>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() =>
								updateListParams((next) => {
									next.set("page", String(Math.max(1, page - 1)));
								})
							}
						>
							Previous page
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onClick={() =>
								updateListParams((next) => {
									next.set("page", String(Math.min(totalPages, page + 1)));
								})
							}
						>
							Next page
						</Button>

						<div className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 w-[8rem] px-2")}>
							<Select
								value={String(pageSize)}
								onValueChange={(value) =>
									updateListParams((next) => {
										if (!value) return;
										next.set("page_size", value);
										next.set("page", "1");
									})
								}
							>
								<SelectTrigger className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="50">50 / page</SelectItem>
									<SelectItem value="100">100 / page</SelectItem>
									<SelectItem value="500">500 / page</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
			</Card>

			<QnaLogDetailDialog
				open={Boolean(activeAnswerId)}
				detail={activeDetail}
				loading={detailLoading && !activeDetail}
				navPending={navPending}
				canPrev={canPrev}
				canNext={canNext}
				positionLabel={positionLabel}
				errorMessage={detailError}
				voice={dialogVoice}
				onOpenChange={(open) => {
					if (!open) setActiveAnswer(null);
				}}
				onNavigate={onNavigate}
			/>
		</div>
	);
}
