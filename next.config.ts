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
		remotePatterns: supabaseStorageRemotePatterns(),
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "X-Frame-Options", value: "SAMEORIGIN" },
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
				],
			},
		];
	},
};

export default nextConfig;
