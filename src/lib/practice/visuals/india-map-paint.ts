import type { IndiaMapLocationId } from "./india-map-regions";

export type IndiaMapRenderStyle = "political" | "outline" | "physical_palette";

const POLITICAL_FILLS = ["#dbeafe", "#cffafe", "#e9d5ff", "#fde68a", "#bbf7d0", "#fecaca"] as const;
const PHYS_FILLS = ["#d8ead8", "#e8e4d6", "#dce9ee", "#ddd6c6", "#cfe8dc", "#e5dcd4"] as const;

function hashId(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) {
		h = (h * 31 + id.charCodeAt(i)) >>> 0;
	}
	return h;
}

export function normalizeIndiaMapStyle(
	mapStyle: IndiaMapRenderStyle | null,
): IndiaMapRenderStyle {
	return mapStyle ?? "political";
}

export function indiaMapOceanFill(style: IndiaMapRenderStyle): string {
	switch (style) {
		case "outline":
			return "#f8fafc";
		case "physical_palette":
			return "#bae6fd";
		case "political":
		default:
			return "#e0f2fe";
	}
}

/** Fill / stroke for one region (SVG or PDF path). Highlights drawn last for stacking. */
export function indiaRegionPaint(
	mapStyle: IndiaMapRenderStyle,
	id: IndiaMapLocationId,
	highlighted: ReadonlySet<string>,
): { fill: string; stroke: string; strokeWidth: number } {
	const hi = highlighted.has(id);
	if (mapStyle === "outline") {
		if (hi) {
			return { fill: "#fef9c3", stroke: "#b45309", strokeWidth: 2.2 };
		}
		return { fill: "#f1f5f9", stroke: "#64748b", strokeWidth: 0.75 };
	}

	if (mapStyle === "physical_palette") {
		const base = PHYS_FILLS[hashId(id) % PHYS_FILLS.length]!;
		if (hi) {
			return { fill: "#fde047", stroke: "#a16207", strokeWidth: 2 };
		}
		return { fill: base, stroke: "#57534e", strokeWidth: 0.65 };
	}

	// political
	const base = POLITICAL_FILLS[hashId(id) % POLITICAL_FILLS.length]!;
	if (hi) {
		return { fill: "#93c5fd", stroke: "#1e40af", strokeWidth: 2 };
	}
	return { fill: base, stroke: "#334155", strokeWidth: 0.55 };
}

export const INDIA_MAP_ATTRIBUTION =
	"India map data © Victor Cazanave, CC BY 4.0 (@svg-maps/india).";
