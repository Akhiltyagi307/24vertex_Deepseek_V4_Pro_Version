"use client";

import Link from "next/link";
import { UserPlus, Users } from "lucide-react";

import { selectParentStudentAction } from "../../select-student/actions";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabAccentClass =
	"bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90";

const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 md:p-5";

const studentSelectButtonClass = cn(
	"w-full rounded-lg border border-border/90 bg-background px-4 py-3 text-left text-sm font-medium text-foreground shadow-sm transition-colors",
	"hover:bg-muted/50 dark:border-border dark:bg-muted/50 dark:hover:bg-muted/70",
);

type LinkedStudent = { id: string; displayName: string };

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
				panelClassName="min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm md:px-8 md:py-8 dark:border-border dark:bg-muted/20"
				persistContentPanels
				tabListPosition="top"
				items={[
					{
						id: "switch",
						title: "Switch student",
						icon: Users,
						color: tabAccentClass,
						content: (
							<div className="space-y-8">
								<div>
									<h2 className="font-semibold text-lg tracking-tight text-foreground">Switch student</h2>
									<p className="mt-1 text-foreground/75 text-sm leading-relaxed dark:text-muted-foreground">
										View overview, progress, and test reports for another student linked to your account.
										Select a name below or open the full student picker.
									</p>
								</div>
								<div className={settingsNestedWellClass}>
									<p className="text-foreground text-sm font-semibold">Linked students</p>
									{linkedStudents.length > 0 ? (
										<ul className="mt-3 flex flex-col gap-2">
											{linkedStudents.map((c) => (
												<li key={c.id}>
													<form action={selectParentStudentAction}>
														<input type="hidden" name="studentId" value={c.id} />
														<button type="submit" className={studentSelectButtonClass}>
															{c.displayName}
														</button>
													</form>
												</li>
											))}
										</ul>
									) : (
										<p className="mt-3 text-muted-foreground text-sm">No linked students yet.</p>
									)}
								</div>
								<Button
									variant="outline"
									className="w-full sm:w-auto"
									render={<Link href="/parent/select-student" />}
								>
									Switch student account
								</Button>
							</div>
						),
					},
					{
						id: "link",
						title: "Link a student",
						icon: UserPlus,
						color: tabAccentClass,
						content: (
							<div className="space-y-8">
								<div>
									<h2 className="font-semibold text-lg tracking-tight text-foreground">Link a student</h2>
									<p className="mt-1 text-foreground/75 text-sm leading-relaxed dark:text-muted-foreground">
										Add another student with the six-character link code from their Profile, or their
										account id.
									</p>
								</div>
								<div className={settingsNestedWellClass}>
									<p className="text-foreground text-sm font-semibold">Connect a student</p>
									<p className="mt-3 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
										You&apos;ll confirm the link on the next screen. The student must generate the code
										from their EduAI profile.
									</p>
									<Button
										className="mt-4 h-11 text-base"
										size="lg"
										render={<Link href="/parent/link-child" />}
									>
										Link another student account
									</Button>
								</div>
							</div>
						),
					},
				]}
			/>
		</div>
	);
}
