import { AdminBroadcastComposeClient } from "./compose-broadcast-client";

export const metadata = {
	title: "Compose broadcast · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default function AdminBroadcastComposePage() {
	return <AdminBroadcastComposeClient />;
}
