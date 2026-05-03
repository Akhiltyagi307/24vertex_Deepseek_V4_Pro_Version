/** Maps tracker status string to `n_incorrect` payload for `practice_update_trackers_bulk`. */
export function nIncorrectFromStatus(status: string): number {
	if (status === "bad") return 2;
	if (status === "satisfactory") return 1;
	return 0;
}
