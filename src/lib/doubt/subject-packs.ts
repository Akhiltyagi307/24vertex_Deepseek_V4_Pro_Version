/**
 * Subject-pack resolution for doubt-tutor system prompts.
 *
 * A "subject pack" is a small (~300-400 token) block of subject-specific
 * guidance — common student traps, notation quirks, CBSE marking specifics,
 * model honesty guardrails — that gets inserted between the shared preamble
 * and the per-conversation scope block. Two chats on the same subject share
 * `preamble + pack` as a cache prefix, so a Physics student in one chat and
 * a Physics student in another chat both hit the same preamble+pack prefix
 * cache.
 *
 * Subjects without a matching pack (e.g. Hindi, Accountancy, regional
 * languages today) gracefully render the prompt with no pack inserted. The
 * resolver never throws — unrecognised subjects just return null.
 */

export const SUBJECT_PACK_KEYS = [
	"mathematics",
	"science",
	"physics",
	"chemistry",
	"biology",
	"social-science",
	"history",
	"geography",
	"political-science",
	"economics",
	"english",
	"computer-science",
] as const;

export type SubjectPackKey = (typeof SUBJECT_PACK_KEYS)[number];

/** Static filename map — kept here so Turbopack/NFT stays happy with static path tracing. */
export const SUBJECT_PACK_FILE: Record<SubjectPackKey, string> = {
	mathematics: "mathematics.md",
	science: "science.md",
	physics: "physics.md",
	chemistry: "chemistry.md",
	biology: "biology.md",
	"social-science": "social-science.md",
	history: "history.md",
	geography: "geography.md",
	"political-science": "political-science.md",
	economics: "economics.md",
	english: "english.md",
	"computer-science": "computer-science.md",
};

/**
 * Map a raw CBSE subject name (as stored in `subjects.name`) to a pack key.
 * Handles common naming variants the catalog uses today:
 *   - "Mathematics", "Maths", "Math"
 *   - "Science" (combined grades 6-10) is its own pack
 *   - "Social Science" / "SST" is its own pack
 *   - "Political Science" / "Civics" share a pack
 *   - "Computer Science" / "Informatics Practices" share a pack
 *
 * Returns null when no pack matches (e.g. Hindi, Sanskrit, Accountancy,
 * Business Studies). The composer treats null as "skip the pack, render
 * preamble+scope+tail directly" — same behaviour as before subject packs
 * existed.
 */
export function resolveSubjectKey(subjectName: string | null | undefined): SubjectPackKey | null {
	if (!subjectName) return null;
	const s = subjectName.toLowerCase().trim();
	if (s.length === 0) return null;

	// Order matters: more specific tests first. "Science" must come AFTER the
	// specific Physics/Chemistry/Biology/Social-Science tests so a "Physics"
	// subject doesn't fall into the generic science bucket.
	if (s.includes("math")) return "mathematics";
	if (s.includes("physics")) return "physics";
	if (s.includes("chemistry") || s === "chem") return "chemistry";
	if (s.includes("biology") || s === "bio") return "biology";
	if (s.includes("social science") || s === "sst" || s === "social studies") {
		return "social-science";
	}
	if (s.includes("history") || s === "hist") return "history";
	if (s.includes("geography") || s === "geo") return "geography";
	if (s.includes("political") || s.includes("civics") || s === "polsci") return "political-science";
	if (s.includes("economics") || s === "eco") return "economics";
	if (s.includes("english")) return "english";
	if (s.includes("computer") || s.includes("informatics") || s === "ip" || s === "cs") {
		return "computer-science";
	}
	// Generic Science (grades 6-10 combined) — checked last so the specific
	// sub-subjects above win.
	if (s.includes("science")) return "science";

	return null;
}
