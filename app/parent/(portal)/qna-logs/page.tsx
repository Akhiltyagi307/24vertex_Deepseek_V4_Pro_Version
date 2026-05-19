import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudentQnaLogsView } from "@/components/student/qna-logs/student-qna-logs-view";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import {
	loadInitialQnaLogPayload,
	searchParamsToQnaLogUrlParams,
} from "@/lib/student/qna-logs/load-initial-qna-log-payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "QnA logs · Parent",
	description: "Review every question your child has seen in practice and assignments.",
	robots: { index: false, follow: false },
};

type PageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ParentQnaLogsPage({ searchParams }: PageProps) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}

	const linked = await assertParentActiveLink(user.id, activeId);
	if (!linked) {
		redirect("/parent/select-student");
	}

	const initialListPayload = await loadInitialQnaLogPayload(
		activeId,
		searchParamsToQnaLogUrlParams(await searchParams),
	);

	return (
		<StudentQnaLogsView
			apiBasePath="/api/parent/qna-logs"
			parentViewer
			initialListPayload={initialListPayload}
		/>
	);
}
