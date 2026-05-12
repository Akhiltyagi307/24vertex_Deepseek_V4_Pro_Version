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
		name: "eduai-cjs-allow-require",
		files: ["**/*.cjs"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	{
		name: "eduai-no-unused-vars-underscore-ignore",
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
		name: "eduai-service-role-import-boundary",
		files: ["**/*.{ts,tsx}"],
		ignores: [
			"src/lib/supabase/admin.ts",
			"src/lib/admin/**",
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
		// Type-aware ratchet (PATH_TO_95.md §8 follow-up). Catches floating
		// promises and misused void-returning callbacks at lint time so they
		// can't reach Sentry as unhandled rejections. Type-aware rules need
		// `parserOptions.project`; scoped to ts/tsx and skips test/script trees
		// to keep cold-cache lint under target.
		name: "eduai-type-aware",
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
]);
