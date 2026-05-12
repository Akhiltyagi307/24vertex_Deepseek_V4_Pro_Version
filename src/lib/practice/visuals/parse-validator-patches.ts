import { z } from "zod";

import type { VisualPatch } from "./apply-visual-patches";

const indexSchema = z.coerce.number().int().nonnegative();

const PATCH_CONTAINER_KEYS = ["patches", "visual_patches", "patch_list", "actions", "items"] as const;

function normalizeAction(raw: unknown): VisualPatch["action"] | null {
	if (typeof raw !== "string") return null;
	const action = raw.trim().toLowerCase();
	if (
		action === "replace_visual" ||
		action === "replacevisual" ||
		action === "replace" ||
		action === "set_visual" ||
		action === "setvisual" ||
		action === "add_visual" ||
		action === "visual_replace" ||
		action === "update_visual"
	) {
		return "replace_visual";
	}
	if (
		action === "null_visual" ||
		action === "nullvisual" ||
		action === "remove_visual" ||
		action === "skip_visual" ||
		action === "no_visual"
	) {
		return "null_visual";
	}
	if (
		action === "rewrite_stem" ||
		action === "rewrite_question" ||
		action === "rewrite_question_text"
	) {
		return "rewrite_stem";
	}
	if (
		action === "rewrite_explanation" ||
		action === "rewrite_answer_explanation" ||
		action === "rewrite_reasoning"
	) {
		return "rewrite_explanation";
	}
	return null;
}

function parseIndex(record: Record<string, unknown>): number | null {
	const raw =
		record.index ??
		record.question_index ??
		record.questionIndex ??
		record.idx ??
		record.question_no;
	const parsed = indexSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}

function extractPatchList(data: unknown): unknown[] {
	if (Array.isArray(data)) return data;
	if (!data || typeof data !== "object") return [];
	const record = data as Record<string, unknown>;
	for (const key of PATCH_CONTAINER_KEYS) {
		const candidate = record[key];
		if (Array.isArray(candidate)) return candidate;
	}
	return [];
}

function normalizePatch(item: unknown): VisualPatch | null {
	if (!item || typeof item !== "object" || Array.isArray(item)) return null;
	const record = item as Record<string, unknown>;
	const action = normalizeAction(record.action ?? record.type ?? record.op);
	if (!action) return null;
	const index = parseIndex(record);
	if (index === null) return null;
	switch (action) {
		case "replace_visual": {
			const value = record.value ?? record.visual ?? record.new_visual;
			if (value == null) return null;
			return { action: "replace_visual", index, value };
		}
		case "null_visual":
			return { action: "null_visual", index };
		case "rewrite_stem": {
			const questionText = record.question_text ?? record.stem ?? record.text;
			if (typeof questionText !== "string") return null;
			return { action: "rewrite_stem", index, question_text: questionText };
		}
		case "rewrite_explanation": {
			const explanation = record.explanation ?? record.answer_explanation ?? record.reasoning;
			if (typeof explanation !== "string") return null;
			return { action: "rewrite_explanation", index, explanation };
		}
		default:
			return null;
	}
}

/**
 * Extract a JSON array of visual patches from model output (raw JSON or ```json fence).
 */
export function parseVisualPatchesFromValidatorText(text: string): VisualPatch[] {
	const trimmed = text.trim();
	let raw = trimmed;
	const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(trimmed);
	if (fence?.[1]) {
		raw = fence[1].trim();
	}

	const candidates: string[] = [raw];
	if (trimmed !== raw) candidates.push(trimmed);
	const firstBracket = trimmed.indexOf("[");
	const lastBracket = trimmed.lastIndexOf("]");
	if (firstBracket >= 0 && lastBracket > firstBracket) {
		candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
	}

	for (const candidate of candidates) {
		try {
			const data = JSON.parse(candidate) as unknown;
			const rawPatches = extractPatchList(data);
			if (rawPatches.length === 0) continue;
			const normalized = rawPatches
				.map((item) => normalizePatch(item))
				.filter((patch): patch is VisualPatch => patch !== null);
			if (normalized.length > 0) return normalized;
		} catch {
			// try the next extraction candidate
		}
	}
	return [];
}
