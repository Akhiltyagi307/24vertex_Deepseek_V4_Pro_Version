#!/usr/bin/env node
/**
 * sync-openai-skills — package the local `skills/` tree, hash each
 * skill's contents, and (when the OpenAI Skills upload API is
 * documented) push pinned versions to OpenAI Platform. Updates
 * `skills.lock.json` with the resolved versions on success.
 *
 * v1 BEHAVIOUR: this script is a dry-run scaffold. It computes a
 * SHA-256 hash of each skill directory and prints the manifest it
 * WOULD upload. Production sync is enabled by setting
 * SYNC_OPENAI_SKILLS=true and providing OPENAI_API_KEY; until the
 * upload step lands, those flags are no-ops.
 *
 * Why a scaffold? OpenAI Skills are accessed via the Responses API
 * shell tool with a `skill_reference` envelope (see v2 visuals guide
 * §3.4). The exact upload endpoint and skill-id schema are not yet
 * pinned in this repo's stack; once the integration is verified
 * against the live API, replace the placeholder block at the bottom
 * of this file with the real call.
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
