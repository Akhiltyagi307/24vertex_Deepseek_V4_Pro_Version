"use client";

import { GraduationCap, Layers2, Library } from "lucide-react";

import { TeacherDashboardAtRiskCard } from "@/app/teacher/(protected)/dashboard/teacher-dashboard-at-risk-card";
import { TeacherDashboardClassPerformanceCard } from "@/app/teacher/(protected)/dashboard/teacher-dashboard-class-performance-card";
import { TeacherDashboardPerformanceBandStrip } from "@/app/teacher/(protected)/dashboard/teacher-dashboard-performance-band-strip";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import {
	buildMockTeacherDashboardBundle,
	MOCK_SCHOOL,
	MOCK_TEACHER_SCOPE_LABEL,
} from "@/lib/marketing/mock-portal-dashboard-data";

const mockBundle = buildMockTeacherDashboardBundle();

export function MarketingMockTeacherDashboard() {
	return (
		<div className="w-full min-w-0 space-y-8 py-6">
			<div className="flex w-full min-w-0 flex-col gap-6 medium:flex-row medium:items-start medium:justify-between medium:gap-8">
				<div className="min-w-0 flex-1 space-y-2">
					<h1 className="shrink-0 text-2xl font-semibold tracking-tight">Dashboard</h1>
					<p className="max-w-3xl text-sm leading-normal text-muted-foreground">
						Use{" "}
						<span className="font-medium text-foreground">Grade / class</span>,{" "}
						<span className="font-medium text-foreground">Subject</span>, and{" "}
						<span className="font-medium text-foreground">Section</span> to focus this dashboard. Distribution,
						class performance, and at-risk lists update together.
					</p>
				</div>
				<div
					className="flex w-[min(100%,30rem)] shrink-0 flex-col gap-3 ms-auto medium:ms-0 medium:w-[min(30rem,calc(100%-1.5rem))]"
					role="group"
					aria-label="Dashboard scope: grade, subject, and section"
				>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-xs font-medium text-muted-foreground medium:w-32">
							Grade / class
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Grade / class"
								ariaLabel="Set dashboard scope: grade or class"
								icon={GraduationCap}
								value="10"
								options={[
									{ value: "", label: "All grades" },
									{ value: "10", label: "Grade 10" },
								]}
								className="shadow-none"
								onValueChange={() => {}}
							/>
						</div>
					</div>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-xs font-medium text-muted-foreground medium:w-32">
							Subject
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Subject"
								ariaLabel="Set dashboard scope: subject"
								icon={Library}
								value=""
								options={[
									{ value: "", label: "All subjects" },
									{ value: "physics", label: "Physics" },
									{ value: "chemistry", label: "Chemistry" },
								]}
								className="shadow-none"
								onValueChange={() => {}}
							/>
						</div>
					</div>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-xs font-medium text-muted-foreground medium:w-32">
							Section
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Section"
								ariaLabel="Set dashboard scope: section"
								icon={Layers2}
								value="A"
								options={[
									{ value: "", label: "All sections" },
									{ value: "A", label: "A" },
									{ value: "B", label: "B" },
								]}
								className="shadow-none"
								onValueChange={() => {}}
							/>
						</div>
					</div>
				</div>
			</div>

			<TeacherDashboardPerformanceBandStrip
				summary={mockBundle.summary}
				pending={false}
				error={null}
				subjectId="all"
				scopeLabel={MOCK_TEACHER_SCOPE_LABEL}
			/>

			<div className="grid grid-cols-1 gap-6 medium:grid-cols-3">
				<TeacherDashboardClassPerformanceCard
					subjectId="all"
					scopeLabel={MOCK_TEACHER_SCOPE_LABEL}
					activeOrganizationName={MOCK_SCHOOL}
					linkedStudentCount={0}
					summary={mockBundle.summary}
					error={null}
					pending={false}
					className="medium:col-span-2"
				/>

				<TeacherDashboardAtRiskCard
					subjectId="all"
					thresholdPercent={50}
					lastGradedCount={5}
					studentsInScope={mockBundle.summary.studentsInScope}
					studentsWithRecentScores={mockBundle.summary.studentsWithRecentScores}
					rows={mockBundle.atRiskRows}
					error={null}
					pending={false}
				/>
			</div>
		</div>
	);
}
