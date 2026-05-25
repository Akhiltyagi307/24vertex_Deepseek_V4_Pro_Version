"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArchiveIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";

import { tabAccentClass } from "@/app/student/settings/_settings-form-styles";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { TeacherAssignmentsSubmissionsHub } from "@/components/teacher/teacher-assignments-submissions-hub";
import {
	partitionTeacherSubmissionBundles,
	type TeacherSubmissionBucket,
} from "@/lib/assignments/teacher-submission-buckets";
import type { TeacherSubmissionAssignmentBundle } from "@/lib/assignments/teacher-submissions-hub-types";

const SUBMISSIONS_TAB_PANEL_CLASS =
	"min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20";

const TAB_IDS = ["ongoing", "completed", "past"] as const satisfies readonly TeacherSubmissionBucket[];

function isSubmissionTabId(value: string | null): value is TeacherSubmissionBucket {
	return value != null && (TAB_IDS as readonly string[]).includes(value);
}

const EMPTY_COPY: Record<TeacherSubmissionBucket, { title: string; body: string }> = {
	ongoing: {
		title: "No ongoing assignments",
		body: "Assignments that are still open and waiting on hand-ins show up here.",
	},
	completed: {
		title: "Nothing completed yet",
		body: "When every student has handed in, or the due date has passed, assignments move here.",
	},
	past: {
		title: "No archived assignments",
		body: "Assignments more than a week past their due date are kept here for reference.",
	},
};

type Props = {
	submissionBundles: TeacherSubmissionAssignmentBundle[];
};

export function TeacherSubmissionsPage({ submissionBundles }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const tabParam = searchParams.get("tab");
	const defaultTabId: TeacherSubmissionBucket = isSubmissionTabId(tabParam) ? tabParam : "ongoing";

	const partitioned = React.useMemo(
		() => partitionTeacherSubmissionBundles(submissionBundles),
		[submissionBundles],
	);

	const [activateTabRequest, setActivateTabRequest] = React.useState<{
		token: number;
		tabId: string;
	} | null>(null);

	React.useEffect(() => {
		if (!isSubmissionTabId(tabParam)) return;
		setActivateTabRequest((prev) => ({
			token: (prev?.token ?? 0) + 1,
			tabId: tabParam,
		}));
	}, [tabParam]);

	const handleTabChange = React.useCallback(
		(tabId: string) => {
			if (!isSubmissionTabId(tabId)) return;
			const params = new URLSearchParams(searchParams.toString());
			params.set("tab", tabId);
			router.replace(`/teacher/submissions?${params.toString()}`, { scroll: false });
		},
		[router, searchParams],
	);

	const tabItems = React.useMemo(
		() =>
			([
				{
					id: "ongoing" as const,
					title: `Ongoing (${partitioned.ongoing.length})`,
					icon: ClockIcon,
					color: tabAccentClass,
					content: (
						<TeacherAssignmentsSubmissionsHub
							bundles={partitioned.ongoing}
							bucket="ongoing"
							emptyTitle={EMPTY_COPY.ongoing.title}
							emptyBody={EMPTY_COPY.ongoing.body}
						/>
					),
				},
				{
					id: "completed" as const,
					title: `Completed (${partitioned.completed.length})`,
					icon: CheckCircle2Icon,
					color: tabAccentClass,
					content: (
						<TeacherAssignmentsSubmissionsHub
							bundles={partitioned.completed}
							bucket="completed"
							emptyTitle={EMPTY_COPY.completed.title}
							emptyBody={EMPTY_COPY.completed.body}
						/>
					),
				},
				{
					id: "past" as const,
					title: `Past (${partitioned.past.length})`,
					icon: ArchiveIcon,
					color: tabAccentClass,
					content: (
						<TeacherAssignmentsSubmissionsHub
							bundles={partitioned.past}
							bucket="past"
							emptyTitle={EMPTY_COPY.past.title}
							emptyBody={EMPTY_COPY.past.body}
						/>
					),
				},
			]),
		[partitioned],
	);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 py-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Submissions</h1>
				<p className="max-w-[65ch] text-muted-foreground text-sm leading-relaxed">
					Track hand-in progress, follow up with learners who are late, and review topic gaps after grading.
				</p>
			</div>

			<SmoothTab
				defaultTabId={defaultTabId}
				activateTabRequest={activateTabRequest}
				panelClassName={SUBMISSIONS_TAB_PANEL_CLASS}
				persistContentPanels
				deferUntilActivatedTabIds={["completed", "past"]}
				tabListPosition="top"
				items={tabItems}
				onChange={handleTabChange}
			/>
		</div>
	);
}
