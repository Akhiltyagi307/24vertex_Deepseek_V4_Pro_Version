import { StudentQnaLogsView } from "@/components/student/qna-logs/student-qna-logs-view";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import {
	loadInitialQnaLogPayload,
	searchParamsToQnaLogUrlParams,
} from "@/lib/student/qna-logs/load-initial-qna-log-payload";

export const dynamic = "force-dynamic";

export const metadata = { title: "QnA logs" };

type PageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudentQnaLogsPage({ searchParams }: PageProps) {
	const session = await requireVerifiedStudent();
	const initialListPayload = await loadInitialQnaLogPayload(
		session.user.id,
		searchParamsToQnaLogUrlParams(await searchParams),
	);

	return (
		<StudentQnaLogsView
			apiBasePath="/api/student/qna-logs"
			initialListPayload={initialListPayload}
		/>
	);
}
