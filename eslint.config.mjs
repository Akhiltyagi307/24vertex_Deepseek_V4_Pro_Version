import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
	...nextVitals,
	...nextTs,
	globalIgnores([".next/**", "node_modules/**"]),
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
]);
