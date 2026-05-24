/** Human-readable labels for profile `stream` and curriculum `subjects.stream` values. */
export const STREAM_LABEL_OPTIONS: { value: string; label: string }[] = [
	{ value: "science", label: "Science" },
	{ value: "science_pcmb", label: "Science (PCMB)" },
	{ value: "science_pcm", label: "Science (PCM)" },
	{ value: "science_pcb", label: "Science (PCB)" },
	{ value: "commerce", label: "Commerce" },
	{ value: "commerce_with_maths", label: "Commerce with Mathematics" },
	{ value: "arts", label: "Arts" },
];

export function formatStreamLabel(stream: string | null | undefined): string {
	if (!stream) return "";
	const label = STREAM_LABEL_OPTIONS.find((o) => o.value === stream)?.label;
	if (label) return label;
	return stream.charAt(0).toUpperCase() + stream.slice(1).replaceAll("_", " ");
}
