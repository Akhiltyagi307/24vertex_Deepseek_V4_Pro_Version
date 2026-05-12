import { describe, expect, it } from "vitest";

import {
	CORE_VISUAL_TEMPLATE_SUBJECTS,
	VISUAL_TEMPLATE_REGISTRY,
	getVisualTemplatesForSubjectTopic,
	resolveVisualTemplatePolicy,
} from "../templates";
import { QUESTION_VISUAL_KINDS } from "../schemas";

describe("visual template registry", () => {
	it("covers every core subject with at least one subject-local template", () => {
		for (const subject of CORE_VISUAL_TEMPLATE_SUBJECTS) {
			const templates = getVisualTemplatesForSubjectTopic({ subjectName: subject });
			expect(templates.length, `${subject} should have templates`).toBeGreaterThan(0);
			expect(
				templates.every((template) => template.subjects.includes(subject)),
				`${subject} should not borrow templates before policy scoring`,
			).toBe(true);
		}
	});

	it("only references shipped visual schema kinds", () => {
		const allowedKinds = new Set<string>(QUESTION_VISUAL_KINDS);
		for (const template of VISUAL_TEMPLATE_REGISTRY) {
			expect(allowedKinds.has(template.kind), `${template.id} uses an unsupported kind`).toBe(true);
		}
	});

	it("prioritizes topic-specific templates over broad subject defaults", () => {
		const physics = getVisualTemplatesForSubjectTopic({
			subjectName: "Physics",
			topicHint: "electric field lines between two charges and potential difference",
			gradeBand: "11-12",
		});
		expect(physics[0]?.id).toBe("physics-electric-field-lines");

		const biology = getVisualTemplatesForSubjectTopic({
			subjectName: "Biology",
			topicHint: "pedigree chart for inheritance of a recessive trait",
			gradeBand: "11-12",
		});
		expect(biology[0]?.id).toBe("biology-pedigree-trait");
	});

	it("produces a bounded policy for generation prompts", () => {
		const policy = resolveVisualTemplatePolicy({
			subjectName: "Chemistry",
			topicHint: "galvanic cell electrode salt bridge electron flow",
			gradeBand: "11-12",
			maxTemplates: 3,
		});

		expect(policy.enabled).toBe(true);
		expect(policy.templates.length).toBeLessThanOrEqual(3);
		expect(policy.preferredKinds[0]).toBe("chemistry_cell_diagram");
		expect(policy.templates[0]?.slotContract.requiredSlots).toContain("anode");
		expect(policy.promptBrief).toContain("chemistry-galvanic-cell");
	});
});
