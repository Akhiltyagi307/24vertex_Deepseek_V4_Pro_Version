export type DoubtTutorMode = "explain" | "solve_with_me";

export function isDoubtTutorMode(v: string): v is DoubtTutorMode {
	return v === "explain" || v === "solve_with_me";
}
