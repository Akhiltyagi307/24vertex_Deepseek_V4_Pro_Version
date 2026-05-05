import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

const localEnv = path.resolve(__dirname, ".env.local");
const mainRepoEnv = path.resolve(__dirname, "../../../.env.local");
loadEnv({ path: fs.existsSync(localEnv) ? localEnv : mainRepoEnv });

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.ts", "src/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
			exclude: [
				// Test files
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/__tests__/**",
				// Type-only / schema files
				"src/db/schema/**",
				"src/db/migrations/**",
				"**/*.d.ts",
				// Pages without much business logic
				"app/**/page.tsx",
				"app/**/layout.tsx",
				"app/**/loading.tsx",
				"app/**/error.tsx",
				"app/**/not-found.tsx",
				"app/global-error.tsx",
				// Build artifacts / config
				"**/node_modules/**",
				".next/**",
				"src/components/**",
				"src/test/**",
			],
			// Coverage thresholds. Phase 2 ratcheted global to 50 (lines/funcs/stmts)
			// after the server-action test sweep. Phase 5.6 adds per-directory
			// overrides at 70 for `src/lib/` and `src/hooks/` — the parts of the
			// codebase with the densest tests, where regressions matter most.
			// Branches stay at 25 globally because Zod `.safeParse` and
			// discriminated unions inflate the branch denominator; per-dir branch
			// thresholds can go higher.
			thresholds: {
				lines: 50,
				branches: 25,
				functions: 50,
				statements: 50,
				"src/lib/**": {
					lines: 70,
					branches: 50,
					functions: 70,
					statements: 70,
				},
				"src/hooks/**": {
					lines: 70,
					branches: 50,
					functions: 70,
					statements: 70,
				},
			},
		},
	},
	resolve: {
		alias: [
			// `@/app/...` resolves to the Next.js app router, which lives outside
			// `src/`. Tests for route handlers (under `app/api/...`) need this so
			// they can `import { POST } from "@/app/api/.../route"` without
			// reaching out with `../../../`.
			{ find: /^@\/app\//, replacement: path.resolve(__dirname, "./app/") + "/" },
			{ find: "@", replacement: path.resolve(__dirname, "./src") },
			{ find: "server-only", replacement: path.resolve(__dirname, "./src/test/shims/server-only.ts") },
		],
	},
});
