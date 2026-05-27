import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
	...nextVitals,
	...nextTs,
	globalIgnores([".next/**", "node_modules/**", ".claude/**"]),
	{
		// `.cjs` files are CommonJS by definition — `require()` is the only way
		// to write them. The TS-ESLint config bundled with `eslint-config-next`
		// flags `require()` everywhere by default; turn it off for `.cjs`.
		name: "vertex24-cjs-allow-require",
		files: ["**/*.cjs"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	{
		name: "vertex24-no-unused-vars-underscore-ignore",
		files: ["**/*.{ts,tsx}"],
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			// React hooks: keep exhaustive-deps strict so a missing dep is a build
			// error, not a silent warning. Add per-line `// eslint-disable-next-line
			// react-hooks/exhaustive-deps` only with a comment explaining the
			// intentional dependency exclusion.
			"react-hooks/exhaustive-deps": "error",
		},
	},
	{
		name: "vertex24-service-role-import-boundary",
		files: ["**/*.{ts,tsx}"],
		ignores: [
			"src/lib/supabase/admin.ts",
			"src/lib/admin/**",
			"src/lib/billing/**",
			"src/lib/compliance/**",
			"src/lib/internal/**",
			"src/lib/parent/**",
			"app/api/**",
			"src/lib/practice/**",
			"src/lib/cache/**",
			"app/student/practice/session-actions.ts",
			"app/student/practice/actions/**",
			"app/student/subscription/actions.ts",
		],
		rules: {
			"no-restricted-imports": "off",
			"@typescript-eslint/no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/supabase/admin",
							message:
								"Service-role Supabase client must not be imported from client components or non-allowlisted server files. Use allowlisted server modules or src/lib/admin/*. The `ServiceRoleClient` type alias is exported and may be imported as a type.",
							allowTypeImports: true,
						},
					],
				},
			],
		},
	},
	{
		// Marketing / legal surface only: forbid raw `<img>` so all images
		// flow through `next/image` and get AVIF/WebP optimization, lazy
		// loading, intrinsic-size CLS prevention, and the CSP `img-src`
		// allowlist. The rule is scoped to `app/(public)/**` because some
		// authenticated portals (e.g. doubt-chat attachment previews) use
		// raw `<img>` with a blob URL — that's the intended behavior there.
		name: "vertex24-no-raw-img-in-public",
		files: ["app/(public)/**/*.{ts,tsx}", "src/components/marketing/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector: "JSXOpeningElement[name.name='img']",
					message:
						"Use `next/image` (Image) instead of raw <img> in marketing/public surfaces — gets AVIF/WebP, lazy-loading, CLS prevention, and CSP coverage for free.",
				},
			],
		},
	},
	{
		// Type-aware ratchet (PATH_TO_95.md §8 follow-up). Catches floating
		// promises and misused void-returning callbacks at lint time so they
		// can't reach Sentry as unhandled rejections. Type-aware rules need
		// `parserOptions.project`; scoped to ts/tsx and skips test/script trees
		// to keep cold-cache lint under target.
		name: "vertex24-type-aware",
		files: ["**/*.{ts,tsx}"],
		ignores: ["scripts/**", "tests/e2e/**", "**/*.cjs", "**/*.mjs"],
		languageOptions: {
			parserOptions: {
				project: ["./tsconfig.json"],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-floating-promises": [
				"error",
				{
					ignoreVoid: true,
					ignoreIIFE: true,
				},
			],
			"@typescript-eslint/no-misused-promises": [
				"error",
				{
					checksConditionals: true,
					// `attributes: false` keeps `<Button onClick={async ...} />`
					// idiomatic React valid; the rule otherwise flags every JSX
					// async event handler.
					checksVoidReturn: { attributes: false },
				},
			],
		},
	},
	{
		// Forbid direct `element.innerHTML = <expr>` writes. Use
		// `Element.replaceChildren()` to clear, or wrap untrusted strings in
		// `DOMPurify.sanitize()` before any HTML injection. This is an
		// AST-level guard against accidentally creating an XSS sink if
		// someone copies the imperative-renderer "clear the mount node"
		// pattern with an LLM-derived string. The original imperative
		// renderers (chemistry-molecule, math-function-plot, economics-curve)
		// have already been migrated to `replaceChildren()` so no allowlist
		// override is needed. `dangerouslySetInnerHTML` (a JSX attribute,
		// not a MemberExpression assignment) is NOT covered by this rule
		// and remains allowed for trusted-source HTML (e.g. KaTeX output).
		name: "vertex24-no-innerhtml-assignment",
		files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						"AssignmentExpression[operator='='][left.type='MemberExpression'][left.property.name='innerHTML']",
					message:
						"Direct innerHTML assignment is forbidden. Use Element.replaceChildren() to clear, or wrap untrusted strings in DOMPurify.sanitize() before any HTML injection.",
				},
			],
		},
	},
]);
