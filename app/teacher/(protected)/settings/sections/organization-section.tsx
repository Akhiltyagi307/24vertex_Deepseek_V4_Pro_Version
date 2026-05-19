"use client";

import { settingsPrimarySubmitClass } from "./_shared";
import {
	panelRaisedInputClass,
} from "@/app/student/settings/_settings-form-styles";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { SerializedOrganization } from "@/lib/organizations/schemas";

import type {
	TeacherOrganizationState,
} from "../actions";

export function TeacherOrganizationSection({
	organizations,
	activeOrganization,
	joinState,
	leaveState,
	joinAction,
	leaveAction,
}: {
	organizations: SerializedOrganization[];
	activeOrganization: SerializedOrganization | null;
	joinState: TeacherOrganizationState | undefined;
	leaveState: TeacherOrganizationState | undefined;
	joinAction: (formData: FormData) => void;
	leaveAction: (formData: FormData) => void;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg tracking-tight text-foreground">School or tuition center</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
					Pick your institution and enter the <span className="font-medium text-foreground">linking code</span> your
					administrator shares from the admin panel. Joining revokes link-code access to independently linked students.
				</p>
			</div>
			<div className="space-y-4">
				{joinState?.error ? <p className="text-sm text-destructive">{joinState.error}</p> : null}
				{joinState?.success ? (
					<p className="text-sm text-muted-foreground">
						Organization connected. Use the <span className="font-medium text-foreground">Teaching filters</span> tab (opened
						for you) to choose grade and subject for roster data.
					</p>
				) : null}
				{leaveState?.error ? <p className="text-sm text-destructive">{leaveState.error}</p> : null}
				{leaveState?.success ? (
					<p className="text-sm text-muted-foreground">Organization disconnected.</p>
				) : null}

				{activeOrganization ? (
					<form action={leaveAction} className="space-y-4">
						<div className="rounded-lg border border-border/80 bg-muted/30 p-4">
							<p className="text-sm text-muted-foreground">Connected to</p>
							<p className="mt-1 font-medium">{activeOrganization.name}</p>
							<p className="text-sm text-muted-foreground">{activeOrganization.type_label}</p>
						</div>
						<Button type="submit" variant="outline" className={settingsPrimarySubmitClass}>
							Leave organization
						</Button>
					</form>
				) : (
					<form action={joinAction} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="teacherOrganizationId">Choose organization</Label>
							<NativeSelect id="teacherOrganizationId" name="organizationId" required>
								<option value="">Select a school or tuition center</option>
								{organizations.map((org) => (
									<option key={org.id} value={org.id}>
										{org.name} ({org.type_label})
									</option>
								))}
							</NativeSelect>
						</div>
						<div className="space-y-2">
							<Label htmlFor="teacherOrganizationLinkingCode">Organization linking code</Label>
							<Input
								id="teacherOrganizationLinkingCode"
								name="organizationLinkingCode"
								required
								autoComplete="off"
								spellCheck={false}
								maxLength={16}
								className={panelRaisedInputClass}
								placeholder="8 characters from your administrator"
							/>
							<p className="text-muted-foreground text-xs leading-relaxed">
								This code is unique to your school or tuition center. Paste or type it exactly as shared — letters are not
								case-sensitive.
							</p>
						</div>
						<SubmitButton
							label="Join organization"
							pendingLabel="Joining..."
							className={settingsPrimarySubmitClass}
						/>
					</form>
				)}
			</div>
		</div>
	);
}
