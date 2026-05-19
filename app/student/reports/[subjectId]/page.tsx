import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports" };

type PageProps = {
	params: Promise<{ subjectId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Old per-subject URL — send users to the unified reports page with the same filters. */
export default async function StudentSubjectReportsRedirect({ params, searchParams }: PageProps) {
	const { subjectId } = await params;
	const sp = await searchParams;

	const p = new URLSearchParams();
	if (subjectId) {
		p.set("subject", subjectId);
	}

	const test = sp.test;
	if (typeof test === "string" && test) {
		p.set("test", test);
	}

	const qs = p.toString();
	redirect(qs ? `/student/reports?${qs}` : "/student/reports");
}
