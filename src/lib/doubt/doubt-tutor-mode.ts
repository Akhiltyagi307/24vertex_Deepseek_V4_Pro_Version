export type DoubtTutorMode = "explain" | "solve_with_me" | "quiz_me";

export function isDoubtTutorMode(v: string): v is DoubtTutorMode {
	return v === "explain" || v === "solve_with_me" || v === "quiz_me";
}

/** Human-readable label for a mode (used in UI selects and analytics). */
export function doubtTutorModeLabel(mode: DoubtTutorMode): string {
	switch (mode) {
		case "explain":
			return "Explain";
		case "solve_with_me":
			return "Solve with me";
		case "quiz_me":
			return "Quiz me";
	}
}
