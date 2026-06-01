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

export type TeacherOnboardingProps = {
	/**
	 * Whether this teacher should see the first-run flow. Computed server-side from
	 * the profile (`is_verified` AND `created_at` within the new-teacher window) and
	 * passed down so the orchestrator stays decoupled from the profile query.
	 */
	isNewTeacher: boolean;
	/** First name for the greeting; falls back to a neutral salutation when absent. */
	firstName?: string | null;
};

/**
 * Teacher tour. Each step points at a nav item rendered with the matching
 * `data-onboarding-id`. Copy is short and teacher-friendly; targets that aren't
 * present (e.g. "Link Student" for org teachers) are skipped by the coach-marks
 * engine, so the same step list works for org and independent teachers.
 */
const TEACHER_TOUR_STEPS: CoachMarkStep[] = [
	{
		targetId: "nav-teacher-dashboard",
		title: "Your dashboard",
		body: "Class snapshot — at-risk students, recent submissions, and overall progress live here.",
		placement: "right",
	},
	{
		targetId: "nav-link-student",
		title: "Link a student",
		body: "Share your code to connect a student's account so their results flow to you.",
		placement: "right",
	},
	{
		targetId: "nav-assignments",
		title: "Assignments",
		body: "Set a practice test for a class or student and track who's completed it.",
		placement: "right",
	},
	{
		targetId: "nav-submissions",
		title: "Submissions",
		body: "Review completed work as it arrives, with scores and per-question detail.",
		placement: "right",
	},
	{
		targetId: "nav-student-performance",
		title: "Student performance",
		body: "Drill into any student's progress across subjects to see who needs support.",
		placement: "right",
	},
	{
		targetId: "nav-topic-performance",
		title: "Topic performance",
		body: "Spot which topics the class is acing and which to reteach, subject by subject.",
		placement: "right",
	},
	{
		targetId: "nav-settings",
		title: "Settings",
		body: "Update your profile, school details, and account preferences anytime.",
		placement: "right",
	},
];

export function TeacherOnboarding({ isNewTeacher, firstName }: TeacherOnboardingProps) {
	const welcome = useOnboardingFlag("teacher-welcome");
	const tour = useOnboardingFlag("teacher-tour");

	// User-driven state only (set in handlers, never in an effect) so the
	// `react-hooks/set-state-in-effect` rule stays satisfied.
	const [welcomeClosed, setWelcomeClosed] = React.useState(false);
	const [tourActive, setTourActive] = React.useState(false);
	// Bumped on each tour start so <CoachMarks> remounts and re-runs its lazy
	// first-step initializer instead of resetting state inside an effect.
	const [tourRunId, setTourRunId] = React.useState(0);

	const isMobile = useIsMobile();

	// Only new, verified teachers who have not seen the welcome get the first-run flow.
	const eligible = isNewTeacher;
	// `!tourActive` keeps the welcome and the tour mutually exclusive even under a
	// re-render that races the two state updates.
	const welcomeOpen = eligible && !welcome.done && !welcomeClosed && !tourActive;

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
		if (!hasReachableTourTarget(TEACHER_TOUR_STEPS)) {
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
		if (!hasReachableTourTarget(TEACHER_TOUR_STEPS)) return;
		setTourRunId((id) => id + 1);
		setTourActive(true);
	}, []);
	React.useEffect(() => subscribeTourReplay("teacher", replayTour), [replayTour]);

	const name = firstName?.trim();
	const greetingTitle = name ? `Welcome to 24Vertex, ${name}!` : "Welcome to 24Vertex!";
	const lines = [
		"This is your teaching workspace — classes, assignments, and student progress.",
		"Set an assignment, link a student, and track how your class is doing.",
	];

	return (
		<>
			<WelcomeDialog
				open={welcomeOpen}
				onOpenChange={(next) => {
					if (!next) closeWelcome();
				}}
				title={greetingTitle}
				lines={lines}
				primaryCta={{ label: "Explore your dashboard", href: "/teacher/dashboard" }}
				onStartTour={!tour.done && !isMobile ? startTour : undefined}
			/>
			<CoachMarks
				key={tourRunId}
				steps={TEACHER_TOUR_STEPS}
				active={tourActive}
				onClose={finishTour}
				onFinish={finishTour}
			/>
		</>
	);
}
