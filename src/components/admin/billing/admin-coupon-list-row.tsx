"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DestructiveConfirm } from "@/components/admin/destructive-confirm";
import { Button } from "@/components/ui/button";

export type AdminCouponListRowProps = {
	id: string;
	code: string;
	kind: string;
	grantsPlanCode: string | null;
	discountPercent: number | null;
	redemptionsCount: number;
	maxRedemptions: number;
	isActive: boolean;
	expiresAt: Date | null;
};

export function AdminCouponListRow({
	code,
	kind,
	grantsPlanCode,
	discountPercent,
	redemptionsCount,
	maxRedemptions,
	isActive,
	expiresAt,
}: AdminCouponListRowProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const codeEnc = encodeURIComponent(code);
	const planOrPercent = kind === "checkout_discount" ? `${discountPercent ?? "—"}%` : (grantsPlanCode ?? "—");

	const handleDelete = async () => {
		try {
			const res = await fetch(`/api/admin/coupons/${codeEnc}/delete`, {
				method: "POST",
				credentials: "include",
			});
			const j = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) throw new Error(j.error ?? res.statusText);
			router.refresh();
		} catch (e) {
			alert(e instanceof Error ? e.message : "Failed to delete coupon");
		}
	};

	return (
		<>
			<tr className="border-b border-border/80">
				<td className="px-3 py-2 font-mono text-xs">
					<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/coupons/${codeEnc}`}>
						{code}
					</Link>
				</td>
				<td className="px-3 py-2 text-xs text-muted-foreground">{kind}</td>
				<td className="px-3 py-2">{planOrPercent}</td>
				<td className="px-3 py-2 tabular-nums">
					{redemptionsCount}/{maxRedemptions}
				</td>
				<td className="px-3 py-2">{isActive ? "yes" : "no"}</td>
				<td className="px-3 py-2 text-muted-foreground">
					{expiresAt ? expiresAt.toISOString().slice(0, 10) : "—"}
				</td>
				<td className="px-3 py-2 text-right">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						aria-label={`Delete coupon ${code}`}
						onClick={() => setOpen(true)}
					>
						<Trash2 className="size-4" />
					</Button>
				</td>
			</tr>
			<DestructiveConfirm
				open={open}
				onOpenChange={setOpen}
				title="Delete coupon"
				description={
					<>
						This permanently deletes the coupon and removes its redemption history. Students who already
						redeemed it <strong>keep their access</strong> — their subscription and quota are preserved.
						Type the coupon code to confirm.
					</>
				}
				confirmText={code}
				submitLabel="Delete coupon"
				onConfirm={handleDelete}
			/>
		</>
	);
}
