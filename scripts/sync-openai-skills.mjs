#!/usr/bin/env node
/**
 * sync-openai-skills — package the local `skills/` tree, hash each
 * skill's contents, and (when enabled) prepare pinned uploads for OpenAI.
 * Updates `skills.lock.json` with resolved versions on success.
 *
 * Operational checklist (Pass 2 shell + skills):
 * 1. Set OPENAI_API_KEY (and SYNC_OPENAI_SKILLS=true when the upload step is implemented).
 * 2. Run: `node scripts/sync-openai-skills.mjs` (or the GitHub workflow that wraps it).
 * 3. For each skill in `skills.lock.json`, set `openai_skill_id` to the Platform skill id,
 *    and replace `v0.1.0-pending-upload` with the pinned version string returned by OpenAI.
 *    Alternatively, set env `PRACTICE_OPENAI_SKILL_MAP` with a JSON map (see `.env.example`).
 * 4. Redeploy the app — `buildValidatorShellSkillReferences()` only emits skillReference
 *    entries for keys that have a real id and non-pending version (or env override).
 *
 * v1 BEHAVIOUR: this script may still be a dry-run scaffold depending on repo state;
 * see the implementation below. Production sync is enabled by setting
 * SYNC_OPENAI_SKILLS=true and providing OPENAI_API_KEY.
 *
 * OpenAI Skills are used with the Responses API shell tool + `skill_reference`
 * envelopes (v2 visuals guide §3.4).
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCKFILE = path.join(ROOT, "skills.lock.json");
const SKILLS_DIR = path.join(ROOT, "skills");

function hashDirectory(dir) {
	const hash = createHash("sha256");
	const entries = readdirSync(dir).sort();
	for (const name of entries) {
		const p = path.join(dir, name);
		const stat = statSync(p);
		if (stat.isDirectory()) {
			hash.update(`d:${name}\n`);
			hash.update(hashDirectory(p));
		} else if (stat.isFile()) {
			hash.update(`f:${name}\n`);
			hash.update(readFileSync(p));
		}
	}
	return hash.digest("hex").slice(0, 16);
}

function main() {
	const lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
	const skills = lock.skills ?? {};
	const updated = { ...lock, skills: { ...skills } };
	let changed = false;
	console.log("Skill                              hash             status");
	console.log("─".repeat(72));
	for (const [name, meta] of Object.entries(skills)) {
		const skillPath = path.join(ROOT, meta.path);
		const hash = hashDirectory(skillPath);
		const expectedVersion = `v0.1.0-${hash}`;
		const status =
			meta.version === expectedVersion
				? "pinned (no change)"
				: meta.version.endsWith("-pending-upload")
				? "pending upload (not pushed in v1)"
				: "drift detected (re-pin)";
		console.log(`${name.padEnd(34)}  ${hash.padEnd(16)}  ${status}`);
		if (meta.version !== expectedVersion && process.env.SKILLS_LOCK_PIN === "true") {
			updated.skills[name] = { ...meta, version: expectedVersion };
			changed = true;
		}
	}
	console.log("");
	if (changed) {
		writeFileSync(LOCKFILE, `${JSON.stringify(updated, null, 2)}\n`);
		console.log("Updated skills.lock.json with hashed versions.");
	}
	if (process.env.SYNC_OPENAI_SKILLS === "true") {
		console.log("SYNC_OPENAI_SKILLS=true is recognised but the upload API integration");
		console.log("is not yet pinned. See SKILL.md for the v1 vs v2 roadmap.");
	}
}

main();
