"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Camera, ImageUp } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { getCroppedImageBlob } from "@/lib/images/crop-to-blob";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_MAX_BYTES } from "@/lib/supabase/avatar-storage-url";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;

function initialsFromName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

type Props = {
	userId: string;
	displayName: string;
	initialAvatarUrl: string | null;
};

export function StudentAvatarUpload({ userId, displayName, initialAvatarUrl }: Props) {
	const dialogTitleId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
	const [cropOpen, setCropOpen] = useState(false);
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setAvatarUrl(initialAvatarUrl ?? "");
	}, [initialAvatarUrl]);

	const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
		setCroppedAreaPixels(areaPixels);
	}, []);

	useEffect(() => {
		return () => {
			if (imageSrc?.startsWith("blob:")) {
				URL.revokeObjectURL(imageSrc);
			}
		};
	}, [imageSrc]);

	function openFilePicker() {
		setError(null);
		fileInputRef.current?.click();
	}

	function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		if (!ACCEPTED.includes(file.type as (typeof ACCEPTED)[number])) {
			setError("Please choose a JPEG, PNG, or WebP image.");
			return;
		}
		if (file.size > AVATAR_MAX_BYTES) {
			setError("Image must be 5MB or smaller.");
			return;
		}

		if (imageSrc?.startsWith("blob:")) {
			URL.revokeObjectURL(imageSrc);
		}
		const url = URL.createObjectURL(file);
		setImageSrc(url);
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setCroppedAreaPixels(null);
		setCropOpen(true);
	}

	function closeCropDialog() {
		setCropOpen(false);
		if (imageSrc?.startsWith("blob:")) {
			URL.revokeObjectURL(imageSrc);
		}
		setImageSrc(null);
	}

	async function confirmCrop() {
		if (!imageSrc || !croppedAreaPixels) {
			setError("Adjust the image, then try again.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const { blob, mimeType } = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
			if (blob.size > AVATAR_MAX_BYTES) {
				setError("Cropped image is still too large. Try zooming out.");
				setBusy(false);
				return;
			}

			const ext = mimeType === "image/jpeg" ? "jpg" : "webp";
			const path = `${userId}/avatar.${ext}`;
			const supabase = createClient();
			const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
				upsert: true,
				contentType: mimeType,
			});
			if (upErr) {
				setError(upErr.message);
				setBusy(false);
				return;
			}
			const otherPath = ext === "jpg" ? `${userId}/avatar.webp` : `${userId}/avatar.jpg`;
			await supabase.storage.from("avatars").remove([otherPath]);
			const { data } = supabase.storage.from("avatars").getPublicUrl(path);
			setAvatarUrl(data.publicUrl);
			closeCropDialog();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setBusy(false);
		}
	}

	function removePhoto() {
		setAvatarUrl("");
		setError(null);
	}

	return (
		<Field className="gap-4">
			<FieldLabel className="text-base font-semibold tracking-tight text-foreground">
				Profile picture
			</FieldLabel>
			<FieldContent className="gap-0">
				<input ref={fileInputRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={onFileChosen} />
				<input type="hidden" name="avatarUrl" value={avatarUrl} />

				<div
					className={cn(
						cardSurfaceFrameClassName,
						"w-full min-w-0 overflow-hidden shadow-sm",
						"bg-background dark:border-input dark:bg-input/35",
					)}
				>
					<div className="flex flex-col items-center gap-8 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8 md:gap-12 md:px-10 md:py-9">
						<div className="relative shrink-0">
							<div
								className={cn(
									"absolute -inset-2 rounded-full bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent opacity-80 blur-md",
									"dark:from-emerald-400/15",
								)}
								aria-hidden
							/>
							<Avatar
								size="lg"
								className={cn(
									"relative z-[1] size-56 rounded-full shadow-md ring-4 ring-background sm:size-64",
									avatarUrl
										? "ring-emerald-600/25 dark:ring-emerald-400/30"
										: "ring-border/60 dark:ring-border/80",
								)}
							>
								{avatarUrl ? (
									<AvatarImage
										src={avatarUrl}
										alt=""
										loading="eager"
										decoding="async"
										fetchPriority="high"
									/>
								) : null}
								<AvatarFallback className="text-6xl font-semibold tracking-tight text-muted-foreground sm:text-7xl">
									{initialsFromName(displayName)}
								</AvatarFallback>
							</Avatar>
						</div>

						<div className="flex min-w-0 flex-1 flex-col items-center gap-6 pb-1 text-center sm:items-start sm:gap-7 sm:pb-0 sm:text-left">
							<div className="max-w-md space-y-2.5 sm:space-y-3">
								<p className="text-foreground text-sm font-medium leading-snug sm:text-base">
									{displayName.trim() ? (
										<>
											Photo for <span className="text-foreground/90">{displayName.trim()}</span>
										</>
									) : (
										"Your profile photo"
									)}
								</p>
								<p className="text-muted-foreground text-sm leading-relaxed sm:text-[0.9375rem]">
									Square crop, shown across EduAI. JPEG, PNG, or WebP, up to 5MB — zoom and
									reposition before saving.
								</p>
							</div>

							<div className="flex w-full max-w-md flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:pl-3 md:pl-5">
								<Button
									type="button"
									variant="default"
									size="lg"
									className="h-10 w-full gap-2 px-5 sm:w-auto"
									onClick={openFilePicker}
								>
									{avatarUrl ? (
										<Camera className="size-4" aria-hidden />
									) : (
										<ImageUp className="size-4" aria-hidden />
									)}
									{avatarUrl ? "Change photo" : "Upload photo"}
								</Button>
								{avatarUrl ? (
									<Button
										type="button"
										variant="ghost"
										size="lg"
										className="h-10 w-full text-muted-foreground sm:w-auto"
										onClick={removePhoto}
									>
										Remove photo
									</Button>
								) : null}
							</div>
						</div>
					</div>
				</div>

				{error ? (
					<p className="mt-3 text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}

				<FieldDescription className="mt-4 text-xs leading-relaxed text-muted-foreground sm:mt-5 sm:text-sm">
					Tip: use a clear, well-lit face or logo — it appears small in navigation and lists.
				</FieldDescription>
			</FieldContent>

			<Dialog.Root open={cropOpen} onOpenChange={(o) => !o && closeCropDialog()}>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,640px)] w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<Dialog.Title id={dialogTitleId} className="font-semibold text-base tracking-tight">
							Adjust photo
						</Dialog.Title>
						<Dialog.Description className="text-muted-foreground text-sm">
							Drag to reposition. Use the slider to zoom. The preview is square like your profile picture.
						</Dialog.Description>

						{imageSrc ? (
							<div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
								<Cropper
									image={imageSrc}
									crop={crop}
									zoom={zoom}
									aspect={1}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onCropComplete={onCropComplete}
								/>
							</div>
						) : null}

						<div className="flex flex-col gap-2">
							<label className="text-muted-foreground text-xs" htmlFor={`${dialogTitleId}-zoom`}>
								Zoom
							</label>
							<input
								id={`${dialogTitleId}-zoom`}
								type="range"
								min={1}
								max={3}
								step={0.01}
								value={zoom}
								onChange={(e) => setZoom(Number(e.target.value))}
								className="w-full accent-primary"
							/>
						</div>

						<div className="flex justify-end gap-2 border-border border-t pt-2">
							<Button type="button" variant="outline" onClick={closeCropDialog} disabled={busy}>
								Cancel
							</Button>
							<Button type="button" onClick={() => void confirmCrop()} disabled={busy || !croppedAreaPixels}>
								{busy ? "Uploading…" : "Save photo"}
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</Field>
	);
}
