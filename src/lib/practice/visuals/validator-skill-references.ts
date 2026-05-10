import { z } from "zod";

import skillsLock from "../../../../skills.lock.json";

const lockEntrySchema = z.object({
	version: z.string(),
	path: z.string(),
	entrypoint: z.string(),
	kind: z.string(),
	/** After `scripts/sync-openai-skills.mjs` upload, set the OpenAI skill id here. */
	openai_skill_id: z.string().min(1).optional().nullable(),
});

const lockSchema = z
	.object({
		skills: z.record(z.string(), lockEntrySchema),
	})
	.passthrough();

type ShellSkillReference = {
	type: "skillReference";
	skillId: string;
	version?: string;
};

/**
 * Optional override: `PRACTICE_OPENAI_SKILL_MAP` = JSON object mapping lock
 * keys to `{ "skillId": "...", "version": "..." }` when `openai_skill_id` in
 * the lockfile is still empty.
 */
function parseEnvSkillMap(): Map<string, { skillId: string; version?: string }> {
	const raw = process.env.PRACTICE_OPENAI_SKILL_MAP?.trim();
	if (!raw) return new Map();
	try {
		const parsed = JSON.parse(raw) as Record<string, { skillId?: string; version?: string } | string>;
		const m = new Map<string, { skillId: string; version?: string }>();
		for (const [k, v] of Object.entries(parsed)) {
			if (typeof v === "string" && v.length > 0) {
				m.set(k, { skillId: v });
				continue;
			}
			if (v && typeof v === "object" && typeof v.skillId === "string" && v.skillId.length > 0) {
				m.set(k, { skillId: v.skillId, version: typeof v.version === "string" ? v.version : undefined });
			}
		}
		return m;
	} catch {
		return new Map();
	}
}

/** Ordered list of validator skills (conventions first, then validators). */
export const VALIDATOR_SKILL_LOCK_KEYS = [
	"ncert-diagram-conventions",
	"ncert-chemistry-conventions",
	"validate-smiles",
	"validate-function-plot",
	"validate-accountancy",
	"validate-student-language",
] as const;

export type ValidatorSkillLockKey = (typeof VALIDATOR_SKILL_LOCK_KEYS)[number];

/**
 * Build OpenAI shell `skillReference` entries for the validator container.
 * Skips lock keys with no `openai_skill_id` and no env override. Returns an
 * empty array when nothing is configured — Pass 2 still runs in text-only
 * mode (no shell tool).
 */
export function buildValidatorShellSkillReferences(): ShellSkillReference[] {
	const parsed = lockSchema.safeParse(skillsLock as unknown);
	if (!parsed.success) return [];

	const envMap = parseEnvSkillMap();
	const refs: ShellSkillReference[] = [];

	for (const key of VALIDATOR_SKILL_LOCK_KEYS) {
		const entry = parsed.data.skills[key];
		if (!entry) continue;
		const fromEnv = envMap.get(key);
		const skillId = (fromEnv?.skillId ?? entry.openai_skill_id)?.trim();
		if (!skillId) continue;
		const lockVersion = entry.version?.trim();
		const envVersion = fromEnv?.version?.trim();
		const ref: ShellSkillReference = { type: "skillReference", skillId };
		const version = envVersion ?? lockVersion;
		if (version && !version.includes("pending")) {
			ref.version = version;
		}
		refs.push(ref);
	}

	return refs;
}
