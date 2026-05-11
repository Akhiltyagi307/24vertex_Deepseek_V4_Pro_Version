/**
 * Region ids for `@svg-maps/india` v2 — must stay aligned with package paths.
 * Each id matches one SVG `<path>` (states / union territories groupings).
 *
 * @see https://github.com/VictorCazanave/svg-maps/tree/master/packages/india
 */
export const INDIA_MAP_LOCATION_IDS = [
	"an",
	"ap",
	"ar",
	"as",
	"br",
	"ch",
	"ct",
	"dd",
	"dl",
	"dn",
	"ga",
	"gj",
	"hp",
	"hr",
	"jh",
	"jk",
	"ka",
	"kl",
	"ld",
	"mh",
	"ml",
	"mn",
	"mp",
	"mz",
	"nl",
	"or",
	"pb",
	"py",
	"rj",
	"sk",
	"tg",
	"tn",
	"tr",
	"up",
	"ut",
	"wb",
] as const;

export type IndiaMapLocationId = (typeof INDIA_MAP_LOCATION_IDS)[number];

export function parseSvgViewBox(viewBox: string): {
	vx: number;
	vy: number;
	vw: number;
	vh: number;
} {
	const parts = viewBox
		.trim()
		.split(/[\s,]+/)
		.map((x) => Number.parseFloat(x));
	if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
		return { vx: 0, vy: 0, vw: 612, vh: 696 };
	}
	return { vx: parts[0]!, vy: parts[1]!, vw: parts[2]!, vh: parts[3]! };
}
