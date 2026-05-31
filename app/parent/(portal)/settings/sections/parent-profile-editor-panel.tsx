"use client";

import {
	panelRaisedInputClass,
	settingsCardCtaButtonClass,
	settingsCardCtaRowClass,
} from "@/app/student/settings/_settings-form-styles";
import type { ParentProfileSettingsRow } from "../parent-account-settings-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StudentAvatarUpload } from "@/components/student/student-avatar-upload";

export function ParentProfileEditorPanel({
	userId,
	profile,
}: {
	userId: string;
	profile: ParentProfileSettingsRow;
}) {
	return (
		<div>
			<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-0">
					<CardTitle className="text-lg">Profile</CardTitle>
					<CardDescription className="text-base">
						Name, photo, and phone for your parent account.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0">
					<FieldSet className="gap-6 border-0 p-0">
						<FieldLegend className="sr-only">Editable profile</FieldLegend>
						<FieldGroup className="gap-6">
							<Field>
								<FieldLabel className="text-base" htmlFor="parentFullName">
									Display name
								</FieldLabel>
								<FieldContent>
									<Input
										id="parentFullName"
										name="fullName"
										required
										className={panelRaisedInputClass}
										defaultValue={profile.full_name}
										autoComplete="name"
									/>
								</FieldContent>
							</Field>
							<StudentAvatarUpload
								userId={userId}
								displayName={profile.full_name}
								initialAvatarUrl={profile.avatar_url}
							/>
							<Field>
								<FieldLabel className="text-base" htmlFor="parentPhone">
									Phone
								</FieldLabel>
								<FieldContent>
									<Input
										id="parentPhone"
										name="phone"
										type="tel"
										className={panelRaisedInputClass}
										autoComplete="tel"
										defaultValue={profile.phone ?? ""}
									/>
								</FieldContent>
							</Field>
						</FieldGroup>
					</FieldSet>
					<div className={settingsCardCtaRowClass}>
						<Button type="submit" className={settingsCardCtaButtonClass}>
							Save changes
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
