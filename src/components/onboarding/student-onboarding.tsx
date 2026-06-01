"use client";

import * as React from "react";

import {
	CoachMarks,
	hasReachableTourTarget,
	type CoachMarkStep,
} from "@/components/onboarding/coach-marks";
import { useOnboardingFlag } from "@/components/onboarding/use-onboarding-flag";
import { subscribeTourReplay } from "@/components/onboarding/tour-replay";
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { markWelcomeSeen } from "@/lib/onboarding/welcome-actions";
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

	const isMobile = useIsMobile();

	// `eligible` (window-based) also drives the checklist; the server-durable
	// `welcomeSeen` gates only the welcome modal so a cross-device dismissal sticks.
	const eligible = onboarding.isNewStudent;
	// `!tourActive` keeps the welcome and the tour mutually exclusive.
	const welcomeOpen =
		eligible && !onboarding.welcomeSeen && !welcome.done && !welcomeClosed && !tourActive;

	const closeWelcome = React.useCallback(() => {
		setWelcomeClosed(true);
		welcome.markDone();
		// Persist the dismissal server-side so the welcome doesn't return on another
		// device/browser. Best-effort; the UI has already closed off localStorage.
		void markWelcomeSeen();
	}, [welcome]);

	const startTour = React.useCallback(() => {
		setWelcomeClosed(true);
		welcome.markDone();
		// No anchorable nav targets (e.g. the mobile drawer sidebar is closed/unmounted):
		// skip rather than render a contentless tour. Mark it done so it isn't re-offered.
		if (!hasReachableTourTarget(STUDENT_TOUR_STEPS)) {
			tour.markDone();
			return;
		}
		setTourRunId((id) => id + 1);
		setTourActive(true);
	}, [welcome, tour]);

	const finishTour = React.useCallback(() => {
		setTourActive(false);
		tour.markDone();
	}, [tour]);

	// Re-entry: a top-bar control can replay the tour at any time — even for users
	// past the first-run window — so the orchestrator stays mounted regardless of
	// `eligible` and listens for replay requests for this portal scope.
	const replayTour = React.useCallback(() => {
		if (!hasReachableTourTarget(STUDENT_TOUR_STEPS)) return;
		setTourRunId((id) => id + 1);
		setTourActive(true);
	}, []);
	React.useEffect(() => subscribeTourReplay("student", replayTour), [replayTour]);

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
				onStartTour={!tour.done && !isMobile ? startTour : undefined}
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
