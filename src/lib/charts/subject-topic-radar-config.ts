import type { ChartConfig } from "@/components/ui/chart";

export type SubjectTopicRadarDatum = {
	subject: string;
	coverage: number;
	perfected: number;
};

/** Marketing and dashboard topic radar accent (matches Features bento). */
export const SUBJECT_TOPIC_RADAR_ACCENT_HEX = "#3ECF8E" as const;

export const subjectTopicRadarChartConfig = {
	coverage: {
		label: "Topic coverage",
		color: `color-mix(in oklab, ${SUBJECT_TOPIC_RADAR_ACCENT_HEX} 32%, var(--muted-foreground))`,
	},
	perfected: {
		label: "Topics perfected",
		color: SUBJECT_TOPIC_RADAR_ACCENT_HEX,
	},
} satisfies ChartConfig;
