"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error, {
			tags: { component: "error-boundary", scope: "global" },
			extra: { digest: error.digest },
		});
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "24px",
					backgroundColor: "#0a0a0a",
					color: "#fafafa",
					fontFamily:
						"system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
				}}
			>
				<div style={{ maxWidth: 420, width: "100%" }}>
					<h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
						Something went wrong.
					</h1>
					<p
						style={{
							marginTop: 8,
							marginBottom: 24,
							fontSize: 14,
							lineHeight: 1.5,
							color: "#a1a1a1",
						}}
					>
						We hit an unexpected error. The team has been notified — please try again.
					</p>
					{error.digest ? (
						<p
							style={{
								margin: "0 0 16px 0",
								fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
								fontSize: 12,
								color: "#a1a1a1",
								padding: "8px 12px",
								borderRadius: 6,
								border: "1px solid #262626",
								backgroundColor: "#171717",
							}}
						>
							Reference: {error.digest}
						</p>
					) : null}
					<button
						type="button"
						onClick={() => reset()}
						style={{
							appearance: "none",
							border: 0,
							borderRadius: 8,
							padding: "8px 14px",
							fontSize: 14,
							fontWeight: 500,
							cursor: "pointer",
							backgroundColor: "#fafafa",
							color: "#0a0a0a",
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
