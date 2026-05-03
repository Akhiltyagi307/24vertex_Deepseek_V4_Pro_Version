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
	experimental: {
		optimizePackageImports: ["lucide-react", "recharts"],
	},
	images: {
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
		// `Content-Security-Policy` is set per-request in `middleware.ts` so we can issue a fresh
		// nonce for `script-src 'strict-dynamic' 'nonce-…'`. Static security headers stay here so
		// they're applied even on routes the middleware matcher excludes (static assets, images).
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

export default nextConfig;
