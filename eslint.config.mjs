import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
	...nextVitals,
	...nextTs,
	globalIgnores([".next/**", "node_modules/**"]),
	{
		name: "eduai-service-role-import-boundary",
		files: ["**/*.{ts,tsx}"],
		ignores: [
			"src/lib/supabase/admin.ts",
			"src/lib/admin/**",
			"src/lib/compliance/**",
			"src/lib/internal/**",
			"app/api/**",
			"src/lib/practice/**",
			"src/lib/cache/**",
			"app/student/practice/session-actions.ts",
			"app/student/practice/actions/**",
			"app/student/subscription/actions.ts",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/supabase/admin",
							message:
								"Service-role Supabase client must not be imported from client components or non-allowlisted server files. Use allowlisted server modules or src/lib/admin/*.",
						},
					],
				},
			],
		},
	},
]);
