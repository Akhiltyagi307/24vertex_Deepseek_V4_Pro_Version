"use client";

import { Building2 } from "lucide-react";

import { settingsNestedWellClass } from "./_account-fields";
import type { UpdateStudentOrganizationState } from "../actions";
import {
	panelRaisedInputClass,
	settingsCtaButtonClass,
	settingsCtaButtonWidthClass,
} from "../_settings-form-styles";
import type { StudentProfileSettingsRow } from "../student-profile-settings-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SerializedOrganization } from "@/lib/organizations/schemas";

export function OrganizationPanel({
	profile,
	organizations,
	currentOrganization,
	organizationState,
	organizationFormAction,
}: {
	profile: StudentProfileSettingsRow;
	organizations: SerializedOrganization[];
	currentOrganization: SerializedOrganization | null;
	organizationState: UpdateStudentOrganizationState | undefined;
	organizationFormAction: (formData: FormData) => void;
}) {
	return (
		<div className={settingsNestedWellClass}>
			<div className="flex flex-col gap-4 medium:flex-row medium:items-start medium:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<Building2 className="size-4 text-muted-foreground" aria-hidden />
						<p className="text-foreground text-sm font-semibold">School or tuition center</p>
					</div>
					<p className="mt-2 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
						Connect your account to an approved organization when your school or tuition center asks you to.
						You can unlink anytime without losing independent tutor links.
					</p>
				</div>
				<div className="shrink-0 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm">
					{currentOrganization ? currentOrganization.name : "Not connected"}
				</div>
			</div>
			<div className="mt-4 grid gap-3 medium:grid-cols-[1fr_auto_auto] medium:items-end">
				<div className="space-y-2">
					<label htmlFor="organizationId" className="text-sm font-medium text-foreground/80">
						Choose organization
					</label>
					<select
						id="organizationId"
						name="organizationId"
						defaultValue={profile.organization_id ?? ""}
						className={cn(
							panelRaisedInputClass,
							"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
						)}
					>
						<option value="">No organization</option>
						{organizations.map((org) => (
							<option key={org.id} value={org.id}>
								{org.name} ({org.type_label})
							</option>
						))}
					</select>
				</div>
				<Button
					type="submit"
					formAction={organizationFormAction}
					variant="default"
					className={cn(settingsCtaButtonClass, settingsCtaButtonWidthClass, "shrink-0")}
				>
					Save organization
				</Button>
				<Button
					type="submit"
					formAction={organizationFormAction}
					name="organizationId"
					value=""
					variant="outline"
					className={cn(settingsCtaButtonClass, settingsCtaButtonWidthClass, "shrink-0")}
				>
					Unlink
				</Button>
			</div>
			{organizationState?.error ? (
				<p className="mt-3 text-destructive text-sm leading-relaxed" role="alert">
					{organizationState.error}
				</p>
			) : null}
			{organizationState?.success ? (
				<p className="mt-3 text-sm text-foreground/80" role="status">
					Organization updated.
				</p>
			) : null}
		</div>
	);
}
