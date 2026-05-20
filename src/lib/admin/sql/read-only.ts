import "server-only";

export const ADMIN_SQL_MAX_RESULT_ROWS = 1000;

export function stripTrailingSemicolons(s: string): string {
	return s.replace(/;+\s*$/g, "").trim();
}

/**
 * Wraps the user's read-only query in a CTE and applies the row cap on the
 * outer SELECT. This is materially stronger than the previous tail-regex
 * approach, which only matched a LIMIT at the very end of the string and
 * therefore did not bound:
 *
 *   - subqueries that themselves contained LIMIT
 *     `SELECT * FROM (SELECT * FROM x LIMIT 50000) q LIMIT 10`
 *   - WITH … SELECT FROM cte where the cte is unbounded
 *   - non-trailing LIMITs followed by trailing comments / whitespace tricks
 *
 * Postgres allows LIMIT on the outer SELECT to take precedence regardless of
 * what's inside the CTE, so wrapping is the simplest reliable cap that
 * doesn't require a SQL parser. EXPLAIN is short-circuited by the caller
 * (`assertReadOnlySelect`) so its plan is not affected.
 *
 * The CTE alias name is internal and quoted to avoid colliding with a user-
 * defined name in their query (PG identifier visibility rules already make
 * collisions hard, but quoting makes it certain).
 */
export function enforceSelectMaxRows(inner: string): string {
	const trimmed = inner.trim();
	return `WITH "__admin_console_outer__" AS (${trimmed}) SELECT * FROM "__admin_console_outer__" LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`;
}

/**
 * D2: Single-word keywords that must never appear in read-only mode. The
 * caller-side `SET TRANSACTION READ ONLY` (in the SQL run route) is the
 * authoritative defense; this parser-side scan catches the issue earlier
 * with a clearer error message and rejects CTE-with-DML escapes such as:
 *
 *   WITH x AS (DELETE FROM t RETURNING id) SELECT * FROM x
 *
 * which slip past the previous `startsWith("with")` check.
 */
const FORBIDDEN_READ_ONLY_KEYWORDS = new Set<string>([
	// DML
	"insert",
	"update",
	"delete",
	"merge",
	"truncate",
	// DDL
	"create",
	"alter",
	"drop",
	"rename",
	// Permissions
	"grant",
	"revoke",
	// File I/O
	"copy",
	// Concurrency / state mutation
	"lock",
	"listen",
	"notify",
	"unlisten",
	// Procedure / anonymous block (executes arbitrary code)
	"call",
	"do",
	// Materialized views / imports
	"refresh",
	"import",
]);

type Token =
	| { kind: "word"; text: string }
	| { kind: "punct"; text: string }
	| { kind: "string"; text: string }
	| { kind: "comment"; text: string };

/**
 * Minimal SQL tokenizer: skips single-quoted strings (with `''` escape),
 * double-quoted identifiers (with `""` escape), line and block comments,
 * and dollar-quoted strings (`$$…$$` or `$tag$…$tag$`). Emits word tokens
 * for keyword matching and punctuation for statement-terminator detection.
 *
 * The tokenizer is intentionally permissive — it does not validate SQL
 * syntax. Its only job is to expose the bare word stream so the keyword
 * check below cannot be fooled by string literals, quoted identifiers,
 * or comments embedding DML.
 */
function* tokenize(s: string): Generator<Token> {
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		const c2 = s[i + 1];

		// line comment
		if (c === "-" && c2 === "-") {
			const end = s.indexOf("\n", i);
			yield { kind: "comment", text: s.slice(i, end === -1 ? s.length : end) };
			i = end === -1 ? s.length : end;
			continue;
		}
		// block comment
		if (c === "/" && c2 === "*") {
			const end = s.indexOf("*/", i + 2);
			yield { kind: "comment", text: s.slice(i, end === -1 ? s.length : end + 2) };
			i = end === -1 ? s.length : end + 2;
			continue;
		}
		// single-quoted string (allow '' escape)
		if (c === "'") {
			let j = i + 1;
			while (j < s.length) {
				if (s[j] === "'" && s[j + 1] === "'") {
					j += 2;
					continue;
				}
				if (s[j] === "'") {
					j++;
					break;
				}
				j++;
			}
			yield { kind: "string", text: s.slice(i, j) };
			i = j;
			continue;
		}
		// double-quoted identifier (allow "" escape)
		if (c === '"') {
			let j = i + 1;
			while (j < s.length) {
				if (s[j] === '"' && s[j + 1] === '"') {
					j += 2;
					continue;
				}
				if (s[j] === '"') {
					j++;
					break;
				}
				j++;
			}
			yield { kind: "string", text: s.slice(i, j) };
			i = j;
			continue;
		}
		// dollar-quoted string $$…$$ or $tag$…$tag$
		if (c === "$") {
			const rest = s.slice(i);
			const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
			if (tagMatch) {
				const tag = tagMatch[0];
				const end = s.indexOf(tag, i + tag.length);
				yield {
					kind: "string",
					text: s.slice(i, end === -1 ? s.length : end + tag.length),
				};
				i = end === -1 ? s.length : end + tag.length;
				continue;
			}
			// bare $ → treat as punctuation
			yield { kind: "punct", text: c };
			i++;
			continue;
		}
		// word
		if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
			yield { kind: "word", text: s.slice(i, j) };
			i = j;
			continue;
		}
		// whitespace
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		// punctuation
		yield { kind: "punct", text: c };
		i++;
	}
}

/** Returns true if there is a `;` outside of any string/comment (i.e., a real statement separator). */
function hasEmbeddedStatementTerminator(s: string): boolean {
	for (const t of tokenize(s)) {
		if (t.kind === "punct" && t.text === ";") return true;
	}
	return false;
}

/** Returns the first non-comment, non-whitespace word, lowercased. */
function firstSignificantWord(s: string): string | null {
	for (const t of tokenize(s)) {
		if (t.kind === "word") return t.text.toLowerCase();
	}
	return null;
}

/**
 * Scans the word stream for any forbidden read-only keyword or phrase.
 * Returns the offending term (lowercased) on the first hit, else null.
 *
 * Quoted identifiers, string literals, and comments cannot trigger this —
 * they are filtered out by the tokenizer. So `SELECT "deleted_at" FROM t`
 * and `SELECT 1 -- DELETE FROM t` pass, while
 * `WITH x AS (DELETE FROM t RETURNING 1) SELECT * FROM x` is caught.
 */
function findForbiddenReadOnlyTerm(sqlText: string): string | null {
	const words: string[] = [];
	for (const t of tokenize(sqlText)) {
		if (t.kind === "word") words.push(t.text.toLowerCase());
	}

	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const w2 = words[i + 1];
		const w3 = words[i + 2];
		const w4 = words[i + 3];

		if (FORBIDDEN_READ_ONLY_KEYWORDS.has(w)) return w;

		// SET ROLE / SET SESSION / SET LOCAL — privilege/session mutation.
		// Bare "SET" alone is too aggressive (legitimate inside some constructs),
		// so we require the second word.
		if (w === "set" && (w2 === "role" || w2 === "session" || w2 === "local")) {
			return `set ${w2}`;
		}

		// Row-lock acquisition modes — write-like reads, rejected by Postgres
		// READ ONLY transactions anyway; reject here for a clearer error.
		if (w === "for") {
			if (w2 === "update" || w2 === "share") return `for ${w2}`;
			if (w2 === "no" && w3 === "key" && w4 === "update") return "for no key update";
			if (w2 === "key" && w3 === "share") return "for key share";
		}
	}
	return null;
}

export function assertReadOnlySelect(
	sqlText: string,
): { ok: true; sql: string } | { ok: false; error: string } {
	const inner = stripTrailingSemicolons(sqlText);
	if (!inner) return { ok: false, error: "Empty SQL" };
	if (hasEmbeddedStatementTerminator(inner)) {
		return { ok: false, error: "Multiple statements are not allowed" };
	}
	const first = firstSignificantWord(inner);
	if (first !== "select" && first !== "with" && first !== "explain") {
		return {
			ok: false,
			error: "Only SELECT, WITH, or standalone EXPLAIN are allowed in read-only mode",
		};
	}

	// D2 defense-in-depth: even inside a CTE or after EXPLAIN, DML/DDL/COPY/etc.
	// are not allowed. The transaction-level `SET TRANSACTION READ ONLY` guard
	// (in the SQL run route) is the authoritative check; this lexical guard
	// surfaces a clearer error and is the unit-testable layer.
	const forbidden = findForbiddenReadOnlyTerm(inner);
	if (forbidden) {
		return {
			ok: false,
			error: `Statement contains "${forbidden}" which is not allowed in read-only mode`,
		};
	}

	if (first === "explain") {
		return { ok: true, sql: inner };
	}
	return { ok: true, sql: enforceSelectMaxRows(inner) };
}
