/**
 * Sanitizer for any future `custom_svg` escape-hatch visual kind.
 *
 * Phase 1 does NOT enable a custom-SVG visual kind; every visual must come
 * from the strict discriminated union in {@link ./schemas}. If we add an
 * escape hatch later, the renderer MUST funnel its raw SVG string through
 * this helper before injecting it into the DOM. Default-deny posture:
 *
 *   - Strips <script>, on*=, javascript: URLs, foreign objects.
 *   - Allows the standard SVG primitive tags (rect, line, path, text,
 *     polyline, polygon, circle, g, use, defs, marker, etc.).
 *   - Allows safe attributes (geometry, fill, stroke, transform, viewBox,
 *     class, role, aria-*, data-*).
 *   - Returns the empty string on any sanitizer error.
 *
 * Server-side compatibility note: DOMPurify needs a DOM. On Node, callers
 * must pass a DOM window (e.g. `jsdom`). In Next.js client components the
 * default global `window` is fine.
 */

import type DOMPurify from "dompurify";

type SanitizerInput = string;

const ALLOWED_TAGS = [
	"svg",
	"g",
	"defs",
	"rect",
	"line",
	"path",
	"text",
	"tspan",
	"polyline",
	"polygon",
	"circle",
	"ellipse",
	"use",
	"marker",
	"title",
	"desc",
];

const ALLOWED_ATTR = [
	"id",
	"class",
	"role",
	"viewBox",
	"width",
	"height",
	"x",
	"y",
	"x1",
	"y1",
	"x2",
	"y2",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"d",
	"points",
	"fill",
	"fill-opacity",
	"fill-rule",
	"stroke",
	"stroke-width",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-opacity",
	"stroke-dasharray",
	"transform",
	"text-anchor",
	"dominant-baseline",
	"font-size",
	"font-family",
	"font-weight",
	"opacity",
	"marker-start",
	"marker-mid",
	"marker-end",
];

/**
 * Sanitize an inbound SVG string. Returns the empty string when the input
 * cannot be sanitized safely (caller should treat that as "render nothing").
 */
export function sanitizeCustomSvg(input: SanitizerInput, purify: typeof DOMPurify): string {
	if (typeof input !== "string" || input.length === 0) return "";
	if (input.length > 64 * 1024) return "";
	try {
		const cleaned = purify.sanitize(input, {
			ALLOWED_TAGS,
			ALLOWED_ATTR,
			FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "style"],
			USE_PROFILES: { svg: true, svgFilters: false },
			ALLOW_DATA_ATTR: true,
			RETURN_DOM: false,
			RETURN_DOM_FRAGMENT: false,
			RETURN_TRUSTED_TYPE: false,
		});
		return typeof cleaned === "string" ? cleaned : "";
	} catch {
		return "";
	}
}
