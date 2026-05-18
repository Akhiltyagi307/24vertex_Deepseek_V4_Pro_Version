"use client";

import { UserPlus, Users } from "lucide-react";

import { LinkStudentSection } from "./sections/link-student-section";
import { SwitchStudentSection, type LinkedStudent } from "./sections/switch-student-section";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";

const tabAccentClass =
	"bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90";

export function ParentAccountSettingsClient({
	signedInAs,
	linkedStudents,
}: {
	signedInAs: string;
	linkedStudents: LinkedStudent[];
}) {
	return (
		<div className="flex w-full min-w-0 flex-col gap-8">
			<div className="flex shrink-0 flex-col gap-1.5">
				<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Account</h1>
				<PageHeaderSubtext variant="wrap">
					Signed in as <span className="text-foreground/90">{signedInAs}</span>
					{". Use "}
					<span className="text-foreground/90">Switch student account</span>
					{" to change which "}
					<span className="text-foreground/90">student account</span>
					{" you're viewing for overview and reports, or "}
					<span className="text-foreground/90">Link another student account</span>
					{" to connect a new one with their link code."}
				</PageHeaderSubtext>
			</div>

			<SmoothTab
				defaultTabId="switch"
				panelClassName="min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20"
				persistContentPanels
				tabListPosition="top"
				items={[
					{
						id: "switch",
						title: "Switch student",
						icon: Users,
						color: tabAccentClass,
						content: (
							<SwitchStudentSection
								linkedStudents={linkedStudents}
								onSwitchHref="/parent/select-student"
							/>
						),
					},
					{
						id: "link",
						title: "Link a student",
						icon: UserPlus,
						color: tabAccentClass,
						content: <LinkStudentSection />,
					},
				]}
			/>
		</div>
	);
}
