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

export type ParentOnboardingProps = {
	/**
	 * Whether this parent is new enough to see the first-run flow. Computed
	 * upstream (in the portal layout) from the parent profile's `created_at`; the
	 * welcome flag is the secondary guard so it never re-shows after dismissal.
	 */
	isNewParent: boolean;
	/** First name for the greeting; falls back to a neutral salutation when absent. */
	firstName?: string | null;
};

/**
 * Parent tour. Each step points at a nav item rendered with the matching
 * `data-onboarding-id`. Copy is short and parent-friendly and notes the portal is
 * read-only over the linked child's data; missing targets are skipped by the
 * coach-marks engine.
 */
const PARENT_TOUR_STEPS: CoachMarkStep[] = [
	{
		targetId: "nav-parent-overview",
		title: "Overview",
		body: "Your home base — a read-only snapshot of your child's scores, recent activity, and where they need support.",
		placement: "right",
	},
	{
		targetId: "nav-learning-chats",
		title: "Learning chats",
		body: "See the topics your child asked the AI tutor about and how those conversations went.",
		placement: "right",
	},
	{
		targetId: "nav-assignments",
		title: "Assignments",
		body: "Track the tests your child's teacher has set, including what's still open and due.",
		placement: "right",
	},
	{
		targetId: "nav-subject-progress",
		title: "Subject progress",
		body: "Follow which topics are solid and which need another pass, subject by subject.",
		placement: "right",
	},
	{
		targetId: "nav-test-reports",
		title: "Test reports",
		body: "Open detailed reports from your child's tests to review their results in depth.",
		placement: "right",
	},
];

export function ParentOnboarding({ isNewParent, firstName }: ParentOnboardingProps) {
	const welcome = useOnboardingFlag("parent-welcome");
	const tour = useOnboardingFlag("parent-tour");

	// User-driven state only (set in handlers, never in an effect) so the
	// `react-hooks/set-state-in-effect` rule stays satisfied.
	const [welcomeClosed, setWelcomeClosed] = React.useState(false);
	const [tourActive, setTourActive] = React.useState(false);
	// Bumped on each tour start so <CoachMarks> remounts and re-runs its lazy
	// first-step initializer instead of resetting state inside an effect.
	const [tourRunId, setTourRunId] = React.useState(0);

	const isMobile = useIsMobile();

	// Only new parents who have not seen the welcome get the first-run flow.
	const eligible = isNewParent;
	// `!tourActive` keeps the welcome and the tour mutually exclusive.
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
		if (!hasReachableTourTarget(PARENT_TOUR_STEPS)) {
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
		if (!hasReachableTourTarget(PARENT_TOUR_STEPS)) return;
		setTourRunId((id) => id + 1);
		setTourActive(true);
	}, []);
	React.useEffect(() => subscribeTourReplay("parent", replayTour), [replayTour]);

	const name = firstName?.trim();
	const greetingTitle = name ? `Welcome to 24Vertex, ${name}!` : "Welcome to 24Vertex!";
	const lines: string[] = [
		"Follow your child's progress — scores, what they're working on, and where they need support.",
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
				primaryCta={{ label: "See your child's progress", href: "/parent/dashboard" }}
				onStartTour={!tour.done && !isMobile ? startTour : undefined}
			/>
			<CoachMarks
				key={tourRunId}
				steps={PARENT_TOUR_STEPS}
				active={tourActive}
				onClose={finishTour}
				onFinish={finishTour}
			/>
		</>
	);
}
