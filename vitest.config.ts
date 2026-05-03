import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.local" });

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"server-only": path.resolve(__dirname, "./src/test/shims/server-only.ts"),
		},
	},
});
