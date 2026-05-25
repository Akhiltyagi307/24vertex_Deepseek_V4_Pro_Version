import { notFound } from "next/navigation";

import { Providers } from "@/components/providers";

export default function MarketingDevLayout({ children }: { children: React.ReactNode }) {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}

	return <Providers>{children}</Providers>;
}
