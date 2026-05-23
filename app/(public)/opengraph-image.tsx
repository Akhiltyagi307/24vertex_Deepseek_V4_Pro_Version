import { ImageResponse } from "next/og";

export const alt = "24Vertex: Catch your child's weak chapters before report-card day";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
	return new ImageResponse(
		(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					justifyContent: "center",
					padding: "80px",
					background: "linear-gradient(135deg, #0a0a0a 0%, #122218 100%)",
					color: "#ffffff",
					fontFamily: "system-ui, -apple-system, sans-serif",
				}}
			>
				{/* 24Vertex brand green hex (DESIGN.md §2). OG renders headless — CSS vars don't resolve here. */}
				<div
					style={{
						color: "#2ea070",
						fontSize: 28,
						fontWeight: 600,
						letterSpacing: 2,
						textTransform: "uppercase",
						marginBottom: 24,
					}}
				>
					24Vertex
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						fontSize: 76,
						fontWeight: 700,
						lineHeight: 1.05,
						letterSpacing: -2,
						maxWidth: 980,
					}}
				>
					<div>Stop finding out on</div>
					<div style={{ color: "#2ea070" }}>report-card day.</div>
				</div>
				<div
					style={{
						marginTop: 32,
						fontSize: 26,
						color: "rgba(255,255,255,0.72)",
						maxWidth: 940,
						lineHeight: 1.35,
					}}
				>
					Adaptive AI practice, a private Explain and Solve-with-me tutor, and a chapter-level
					parent dashboard. For grades 6 to 10.
				</div>
			</div>
		),
		{ ...size },
	);
}
