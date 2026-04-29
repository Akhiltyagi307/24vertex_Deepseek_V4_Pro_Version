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

/**
 * Baseline CSP: Supabase API + Realtime, Razorpay checkout script/API, Sentry ingest.
 * `unsafe-inline` scripts/styles align with Next.js + Tailwind; dev adds `unsafe-eval` for tooling.
 */
function contentSecurityPolicy(): string {
	const connectParts = ["'self'"];
	const supabaseRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (supabaseRaw) {
		try {
			const u = new URL(supabaseRaw);
			connectParts.push(u.origin, `wss://${u.hostname}`);
		} catch {
			/* ignore */
		}
	}
	connectParts.push(
		"https://*.ingest.sentry.io",
		"https://*.ingest.de.sentry.io",
		"https://api.razorpay.com",
	);

	let imgSrc = "'self' data: blob: https:";
	if (supabaseRaw) {
		try {
			imgSrc += ` ${new URL(supabaseRaw).origin}`;
		} catch {
			/* ignore */
		}
	}

	const scriptSrc =
		process.env.NODE_ENV === "production" ?
			"'self' 'unsafe-inline' https://checkout.razorpay.com"
		:	"'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com";

	const directives = [
		"default-src 'self'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		`connect-src ${connectParts.join(" ")}`,
		`img-src ${imgSrc}`,
		"font-src 'self' data:",
		"frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
	];

	if (process.env.VERCEL_ENV === "production") {
		directives.push("upgrade-insecure-requests");
	}

	return directives.join("; ");
}

const nextConfig: NextConfig = {
	experimental: {
		optimizePackageImports: ["lucide-react", "recharts"],
	},
	images: {
		remotePatterns: supabaseStorageRemotePatterns(),
	},
	async headers() {
		const base: { key: string; value: string }[] = [
			{ key: "X-Content-Type-Options", value: "nosniff" },
			{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
			{ key: "X-Frame-Options", value: "SAMEORIGIN" },
			{
				key: "Permissions-Policy",
				value: "camera=(), microphone=(), geolocation=()",
			},
			{ key: "Content-Security-Policy", value: contentSecurityPolicy() },
		];

		if (process.env.VERCEL_ENV === "production") {
			base.push({
				key: "Strict-Transport-Security",
				value: "max-age=63072000; includeSubDomains; preload",
			});
		}

		return [
			{
				source: "/:path*",
				headers: base,
			},
		];
	},
};

export default nextConfig;
