"use client";

import * as React from "react";

import { CoachMarks, type CoachMarkStep } from "@/components/onboarding/coach-marks";
import { useOnboardingFlag } from "@/components/onboarding/use-onboarding-flag";
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog";
import type { StudentDashboardOnboarding } from "@/lib/student/load-student-dashboard";

export type StudentOnboardingProps = {
	onboarding: StudentDashboardOnboarding;
	/** First name for the greeting; falls back to a neutral salutation when absent. */
	firstName?: string | null;
	/** Display grade label (e.g. "Grade 9") shown in the setup confirmation line. */
	gradeLabel?: string | null;
};

/**
 * Student tour. Each step points at a nav item rendered with the matching
 * `data-onboarding-id`. Copy is short and student-friendly; missing targets are
 * skipped by the coach-marks engine.
 */
const STUDENT_TOUR_STEPS: CoachMarkStep[] = [
	{
		targetId: "nav-dashboard",
		title: "Your dashboard",
		body: "Your home base — scores, subject progress, and what to work on next live here.",
		placement: "right",
	},
	{
		targetId: "nav-practice",
		title: "Practice tests",
		body: "Generate a test tuned to your grade and subjects, then take it whenever you like.",
		placement: "right",
	},
	{
		targetId: "nav-doubt",
		title: "Ask a topic",
		body: "Stuck on something? The AI tutor explains it, solves with you, or quizzes you.",
		placement: "right",
	},
	{
		targetId: "nav-performance",
		title: "Performance",
		body: "See which topics are solid and which need another pass, subject by subject.",
		placement: "right",
	},
	{
		targetId: "nav-reports",
		title: "Reports",
		body: "Download detailed reports of your tests to review or share with a parent.",
		placement: "right",
	},
	{
		targetId: "nav-assignments",
		title: "Assignments",
		body: "Tests your teacher sets for you show up here — keep an eye out for due dates.",
		placement: "right",
	},
];

export function StudentOnboarding({ onboarding, firstName, gradeLabel }: StudentOnboardingProps) {
	const welcome = useOnboardingFlag("welcome");
	const tour = useOnboardingFlag("tour");

	// User-driven state only (set in handlers, never in an effect) so the
	// `react-hooks/set-state-in-effect` rule stays satisfied.
	const [welcomeClosed, setWelcomeClosed] = React.useState(false);
	const [tourActive, setTourActive] = React.useState(false);
	// Bumped on each tour start so <CoachMarks> remounts and re-runs its lazy
	// first-step initializer instead of resetting state inside an effect.
	const [tourRunId, setTourRunId] = React.useState(0);

	// Only new students who have not seen the welcome get the first-run flow.
	const eligible = onboarding.isNewStudent;
	const welcomeOpen = eligible && !welcome.done && !welcomeClosed;

	const closeWelcome = React.useCallback(() => {
		setWelcomeClosed(true);
		welcome.markDone();
	}, [welcome]);

	const startTour = React.useCallback(() => {
		setWelcomeClosed(true);
		welcome.markDone();
		setTourRunId((id) => id + 1);
		setTourActive(true);
	}, [welcome]);

	const finishTour = React.useCallback(() => {
		setTourActive(false);
		tour.markDone();
	}, [tour]);

	if (!eligible) return null;

	const name = firstName?.trim();
	const greetingTitle = name ? `Welcome to 24Vertex, ${name}!` : "Welcome to 24Vertex!";
	const lines: string[] = [];
	if (gradeLabel?.trim()) {
		lines.push(`You're all set for ${gradeLabel.trim()}.`);
	} else {
		lines.push("Your account is ready to go.");
	}
	lines.push("Generate a practice test, ask the tutor a doubt, and track your progress as you go.");

	return (
		<>
			<WelcomeDialog
				open={welcomeOpen}
				onOpenChange={(next) => {
					if (!next) closeWelcome();
				}}
				title={greetingTitle}
				lines={lines}
				primaryCta={{ label: "Generate your first test", href: "/student/practice" }}
				onStartTour={!tour.done ? startTour : undefined}
			/>
			<CoachMarks
				key={tourRunId}
				steps={STUDENT_TOUR_STEPS}
				active={tourActive}
				onClose={finishTour}
				onFinish={finishTour}
			/>
		</>
	);
}
