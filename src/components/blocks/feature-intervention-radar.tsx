"use client";

import { SubjectTopicRadarChart } from "@/components/charts/subject-topic-radar-chart";

/** Illustrative subject snapshot for marketing (percent of syllabus touched vs mastered). */
const demoChartData = [
	{ subject: "Math", coverage: 92, perfected: 71 },
	{ subject: "Physics", coverage: 78, perfected: 52 },
	{ subject: "Chemistry", coverage: 84, perfected: 61 },
	{ subject: "Biology", coverage: 72, perfected: 45 },
	{ subject: "English", coverage: 88, perfected: 66 },
] as const;

export function FeatureInterventionRadar() {
	return <SubjectTopicRadarChart data={[...demoChartData]} variant="marketing" />;
}
