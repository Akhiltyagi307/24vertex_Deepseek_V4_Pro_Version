import type { NextConfig } from "next";

function supabaseStorageRemotePatterns() {
	const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!raw) return [];
	try {
		const { hostname } = new URL(raw);
		if (!hostname) return [];
		return [
			{
				protocol: "https" as const,
				hostname,
				pathname: "/storage/v1/object/**",
			},
		];
	} catch {
		return [];
	}
}

const nextConfig: NextConfig = {
	reactStrictMode: true,
	compress: true,
	poweredByHeader: false,
	// Pin workspace root explicitly — avoids Turbopack inferring an unrelated
	// parent directory when multiple lockfiles exist on the dev machine.
	turbopack: {
		root: process.cwd(),
	},
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"recharts",
			"motion",
			"@radix-ui/react-avatar",
			"@radix-ui/react-dialog",
			"@radix-ui/react-label",
			"@radix-ui/react-separator",
			"@radix-ui/react-slot",
			"@radix-ui/react-toggle",
			"@radix-ui/react-toggle-group",
			"date-fns",
			"@tiptap/core",
			"@tiptap/react",
			"@tiptap/starter-kit",
		],
	},
	// `smiles-drawer` 2.x ships its main entry as `app.js` but that file
	// imports from `./src/Drawer`, `./src/SvgDrawer`, etc. — and one of
	// those internal source files (`CIP.ts`) is TypeScript. Webpack's
	// default config ignores node_modules for transpilation, so the
	// build fails with "Module parse failed: Unexpected token" on the
	// `type` keyword. Listing the package here runs it through Next's
	// SWC transpiler. Same for any future visual-renderer dep that
	// ships untranspiled TS — add to this list rather than ejecting
	// from `next/dynamic({ ssr: false })`.
	//
	// `@svg-maps/india` is plain `export default { viewBox, locations[] }` JS — no TS,
	// no parse failures; production `next build` succeeds without listing it here.
	// See `src/lib/practice/visuals/__tests__/svg-maps-india-package.test.ts`.
	transpilePackages: ["smiles-drawer"],
	serverExternalPackages: [
		"@sentry/nextjs",
		"drizzle-orm",
		"postgres",
		"@react-pdf/renderer",
		"razorpay",
		"resend",
		// Practice visuals: statistics_chart (box) uses Plotly; keep as external for SSR edge cases.
		"plotly.js-dist-min",
	],
	images: {
		formats: ["image/avif", "image/webp"],
		minimumCacheTTL: 60 * 60 * 24 * 365,
		dangerouslyAllowSVG: false,
		remotePatterns: [
			...supabaseStorageRemotePatterns(),
			{
				protocol: "https",
				hostname: "images.unsplash.com",
				pathname: "/**",
			},
		],
	},
	async headers() {
		// `Content-Security-Policy` is set per-request in `proxy.ts` so we can issue a fresh
		// nonce for `script-src 'strict-dynamic' 'nonce-…'`. Static security headers stay here so
		// they're applied even on routes the proxy matcher excludes (static assets, images).
		const base: { key: string; value: string }[] = [
			{ key: "X-Content-Type-Options", value: "nosniff" },
			{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
			{ key: "X-Frame-Options", value: "SAMEORIGIN" },
			{
				key: "Permissions-Policy",
				value: "camera=(), microphone=(), geolocation=()",
			},
		];

		if (process.env.VERCEL_ENV === "production") {
			base.push({
				key: "Strict-Transport-Security",
				value: "max-age=63072000; includeSubDomains; preload",
			});
		}

		const robotsAdmin: { key: string; value: string } = {
			key: "X-Robots-Tag",
			value: "noindex, nofollow",
		};

		return [
			{
				source: "/:all*(svg|jpg|jpeg|png|gif|webp|avif|ico|mp4|webm)",
				headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
			},
			{
				source: "/admin/:path*",
				headers: [...base, robotsAdmin],
			},
			{
				source: "/api/admin/:path*",
				headers: [...base, robotsAdmin],
			},
			{
				source: "/:path*",
				headers: base,
			},
		];
	},
};

export default async function loadConfig(): Promise<NextConfig> {
	if (process.env.ANALYZE === "true") {
		const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
		return bundleAnalyzer({ enabled: true })(nextConfig);
	}
	return nextConfig;
}
