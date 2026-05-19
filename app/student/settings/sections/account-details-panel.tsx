"use client";

import { AccountReadonlyField, LoginEmailField, settingsNestedWellClass } from "./_account-fields";
import { formatPlacementStream, type PlacementField } from "../placement-field-dialog";
import type { StudentProfileSettingsRow } from "../student-profile-settings-form";
import { cn } from "@/lib/utils";

export function AccountDetailsPanel({
	loginEmail,
	profile,
	enrolled,
	electiveSubjectName,
	onPlacementFieldEdit,
}: {
	loginEmail: string;
	profile: StudentProfileSettingsRow;
	enrolled: string;
	electiveSubjectName: string | null;
	onPlacementFieldEdit: (field: PlacementField) => void;
}) {
	return (
		<div className={cn(settingsNestedWellClass, "text-base")}>
			<div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
				<div className="min-w-0 medium:col-span-2">
					<LoginEmailField email={loginEmail} isVerified={profile.is_verified} />
				</div>
				<AccountReadonlyField
					className="min-w-0 medium:col-span-2"
					label="Enrollment date"
					value={enrolled}
					description="Set when your account was created. This cannot be changed."
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Grade"
					schoolManaged
					value={profile.grade != null ? String(profile.grade) : "—"}
					onSchoolPlacementEdit={() => onPlacementFieldEdit("grade")}
					placementEditTooltip="Edit grade"
					placementEditAriaLabel="Edit grade"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Section"
					schoolManaged
					value={profile.section?.trim() || "—"}
					onSchoolPlacementEdit={() => onPlacementFieldEdit("section")}
					placementEditTooltip="Edit section"
					placementEditAriaLabel="Edit section"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Stream"
					schoolManaged
					value={formatPlacementStream(profile.stream)}
					onSchoolPlacementEdit={() => onPlacementFieldEdit("stream")}
					placementEditTooltip="Edit stream"
					placementEditAriaLabel="Edit stream"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Elective"
					schoolManaged
					value={electiveSubjectName ?? "—"}
					onSchoolPlacementEdit={() => onPlacementFieldEdit("elective")}
					placementEditTooltip="Edit elective"
					placementEditAriaLabel="Edit elective"
				/>
				<AccountReadonlyField
					className="min-w-0 medium:col-span-2"
					label="School"
					schoolManaged
					value={profile.school_name?.trim() || "—"}
					onSchoolPlacementEdit={() => onPlacementFieldEdit("school")}
					placementEditTooltip="Edit school name"
					placementEditAriaLabel="Edit school"
				/>
			</div>
		</div>
	);
}
