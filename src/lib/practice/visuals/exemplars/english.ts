import type { VisualExemplar } from "../exemplars-type";

export const ENGLISH_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// ENGLISH
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Rewrite the sentence in the passive voice: Meera is writing a letter.",
		topicKeywords: ["active passive voice", "grammar transformation", "voice change"],
		visual: null,
		subjects: ["english"],
	},
	{
		stem: "Read the passage and identify the figure of speech used in line 3.",
		topicKeywords: ["figures of speech", "poetry excerpt", "personification metaphor"],
		visual: {
			caption: "Numbered poem excerpt (lines 1-3).",
			altText:
				"Three short lines of verse, each prefixed by its line number; no interpretation of the literary device is stated.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Across the dawn the river ran," },
					{ number: 2, text: "A silver thread through fields of wheat," },
					{ number: 3, text: "The wind bent down to whisper softly." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Read the passage below and answer: What does the narrator mean by the phrase in line 4?",
		topicKeywords: ["reading comprehension", "prose analysis", "inference"],
		visual: {
			caption: "Prose extract — an interior monologue (lines 1-4).",
			altText:
				"Four numbered lines of prose narration; no interpretive commentary is provided in the caption.",
			spec: {
				kind: "english_passage",
				title: "The Empty House",
				source: null,
				lines: [
					{ number: 1, text: "Aisha stood at the threshold of the empty house." },
					{ number: 2, text: "Every room she entered felt heavier than the last." },
					{ number: 3, text: "There were no voices, no footsteps — and yet" },
					{ number: 4, text: "the silence screamed louder than anything she had ever known." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "In the poem extract below, identify the poetic device used in line 2 and explain its effect on the reader.",
		topicKeywords: ["literary devices", "metaphor imagery", "class 12 literature"],
		visual: {
			caption: "Poem extract (four lines, line-numbered) from a Class 12 anthology.",
			altText:
				"Four numbered lines of verse; no paraphrase or device identification is given in the caption.",
			spec: {
				kind: "english_passage",
				title: "Dawn",
				source: "Class 12 Anthology",
				lines: [
					{ number: 1, text: "The night retreats on silent feet," },
					{ number: 2, text: "As dawn, a painter, brushes light" },
					{ number: 3, text: "Across the canvas of the sky," },
					{ number: 4, text: "And trades the stars for morning bright." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "You are the Secretary of the Eco Club. Draft the body of a notice for the school noticeboard informing students about an inter-house quiz on sustainable development (date, time, venue, and whom to contact).",
		topicKeywords: ["notice writing", "formats", "Eco Club bulletin"],
		visual: {
			caption: "Numbered notice skeleton — Eco Club announcement.",
			altText:
				"Six short lines formatted like a school notice: heading NOTICE, issuing body Eco Club, dated line, subject line about an inter-house quiz, two lines for schedule and venue placeholders, closing line for contact.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "NOTICE" },
					{ number: 2, text: "Eco Club — Greenfield Senior Secondary School" },
					{ number: 3, text: "Date: _______________" },
					{ number: 4, text: "Subject: Inter-House Quiz on Sustainable Development" },
					{ number: 5, text: "All students are informed that an Inter-House Quiz will be held on _______________ at _______________ in _______________." },
					{ number: 6, text: "Interested participants may register with the undersigned by _______________." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Complete the letter by supplying the missing conventional closing: you are Ananya Sharma of Class XI-A, writing to the Principal to request three days’ leave for a family function.",
		topicKeywords: ["letter writing formal", "application leave", "class 11 english"],
		visual: {
			caption: "Formal letter — leave application (numbered layout).",
			altText:
				"Twelve numbered lines from sender block through subject, salutation, short body, complimentary close, and typed signature — conventional formal letter layout.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Ananya Sharma" },
					{ number: 2, text: "Class XI-A, Roll No. _______________" },
					{ number: 3, text: "Greenfield Senior Secondary School" },
					{ number: 4, text: "Date: _______________" },
					{ number: 5, text: "To" },
					{ number: 6, text: "The Principal, Greenfield Senior Secondary School" },
					{ number: 7, text: "Subject: Application for leave of absence (family function)" },
					{ number: 8, text: "Dear Sir/Madam," },
					{ number: 9, text: "I respectfully request leave for three days beginning _______________ for a family function at _______________." },
					{ number: 10, text: "Thank you." },
					{ number: 11, text: "Yours faithfully," },
					{ number: 12, text: "Ananya Sharma" },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Read the dialogue and state what Rohan agrees to do by the end of line 6.",
		topicKeywords: ["spoken english", "dialogue comprehension", "reading comprehension"],
		visual: {
			caption: "Numbered dialogue — club meeting arrangements.",
			altText:
				"Six alternating spoken lines prefixed by speaker initials R or P about fixing a venue and time for a debate practice.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Rohan: We still haven’t locked the hall for Friday’s debate practice." },
					{ number: 2, text: "Priya: Main auditorium is booked. Could we use the seminar room instead?" },
					{ number: 3, text: "Rohan: Only if we finish by five — the robotics club needs it after." },
					{ number: 4, text: "Priya: Five works. I’ll ask Mrs. Nair for the key and the projector." },
					{ number: 5, text: "Rohan: I’ll print the motion briefs and bring spare markers." },
					{ number: 6, text: "Priya: Perfect — see you ten minutes early to set the chairs." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Complete the email by filling in the conventional subject line and closing requested in lines 4 and 9.",
		topicKeywords: ["email writing", "professional communication", "formal english"],
		visual: {
			caption: "Email skeleton — formal request to the librarian.",
			altText:
				"Nine numbered lines from recipient through subject, greeting, short body about borrowing references, sign-off, and sender block with placeholders.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "To: librarian@greenfieldschool.edu.in" },
					{ number: 2, text: "Cc:" },
					{ number: 3, text: "Dear Sir/Madam," },
					{ number: 4, text: "Subject: _______________________________________________" },
					{
						number: 5,
						text: "I am a student of Class XI-A preparing a project on renewable energy policy. Kindly allow me to borrow two reference titles from the stacks for one week beginning _______________.",
					},
					{ number: 6, text: "The books I require are: (i) _______________ (ii) _______________" },
					{ number: 7, text: "I will abide by all library rules regarding issue and return." },
					{ number: 8, text: "Thank you for your assistance." },
					{ number: 9, text: "_______________________________________________" },
					{ number: 10, text: "Arjun Mehta" },
					{ number: 11, text: "Class XI-A | Roll No. _______________" },
				],
			},
		},
		subjects: ["english"],
	},
];
