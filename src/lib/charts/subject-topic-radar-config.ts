import type { ChartConfig } from "@/components/ui/chart";

export type SubjectTopicRadarDatum = {
	subject: string;
	coverage: number;
	perfected: number;
};

/**
 * Marketing and dashboard topic radar accent. Resolves to the EduAI brand green
 * via the `--subject-grid-icon` token so the chart inherits theme switches
 * (One Voice Rule, DESIGN.md §2).
 */
export const SUBJECT_TOPIC_RADAR_ACCENT = "var(--subject-grid-icon)" as const;

export const subjectTopicRadarChartConfig = {
	coverage: {
		label: "Topic coverage",
		color: `color-mix(in oklab, ${SUBJECT_TOPIC_RADAR_ACCENT} 32%, var(--muted-foreground))`,
	},
	perfected: {
		label: "Topics perfected",
		color: SUBJECT_TOPIC_RADAR_ACCENT,
	},
} satisfies ChartConfig;
