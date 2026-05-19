import { z } from "zod";

import { getQnaLogAdjacent } from "@/lib/student/qna-logs/get-qna-log-adjacent";
import { getQnaLogDetail } from "@/lib/student/qna-logs/get-qna-log-detail";
import { parseQnaLogQueryParams } from "@/lib/student/qna-logs/qna-log-query-params";
import {
	qnaError,
	qnaJson,
	qnaRateLimitCheck,
	resolveParentQnaViewer,
} from "@/lib/student/qna-logs/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAV_LIMIT_N = 120;
const NAV_WINDOW_SECONDS = 60;

const dirSchema = z.enum(["next", "prev"]);

export async function GET(request: Request) {
	const viewer = await resolveParentQnaViewer();
	if (!viewer.ok) return viewer.response;

	const url = new URL(request.url);
	const navDirectionRaw =
		url.searchParams.get("move") ??
		url.searchParams.get("nav_dir") ??
		url.searchParams.get("direction") ??
		url.searchParams.get("dir");
	const dir = dirSchema.safeParse(navDirectionRaw);
	if (!dir.success) return qnaError(400, "Invalid navigation direction.");

	const paramsWithoutNav = new URLSearchParams(url.searchParams);
	paramsWithoutNav.delete("move");
	paramsWithoutNav.delete("nav_dir");
	paramsWithoutNav.delete("direction");
	const dirParam = paramsWithoutNav.get("dir");
	if (dirParam === "next" || dirParam === "prev") {
		paramsWithoutNav.delete("dir");
	}
	const parsed = parseQnaLogQueryParams(paramsWithoutNav);
	if (!parsed.ok) return qnaError(400, parsed.error);
	if (!parsed.value.activeAnswerId) return qnaError(400, "Missing active answer id.");

	const limited = await qnaRateLimitCheck({
		userId: viewer.userId,
		bucket: "parent-qna-logs-nav",
		limitN: NAV_LIMIT_N,
		windowSeconds: NAV_WINDOW_SECONDS,
	});
	if (limited) return limited;

	const answerId = await getQnaLogAdjacent({
		studentId: viewer.studentId,
		currentAnswerId: parsed.value.activeAnswerId,
		direction: dir.data,
		filters: parsed.value.filters,
		sort: parsed.value.sort,
	});
	if (!answerId) return qnaJson({ answerId: null, detail: null });

	const detail = await getQnaLogDetail({ studentId: viewer.studentId, answerId });
	return qnaJson({ answerId, detail });
}
