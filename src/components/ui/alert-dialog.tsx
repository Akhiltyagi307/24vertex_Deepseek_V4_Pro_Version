"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// AlertDialog is a modal dialog intended for destructive or irreversible actions.
// It intentionally does not close when the user clicks the overlay, so accidental
// dismissal is prevented. Built on @radix-ui/react-dialog with pointer-down-outside
// and escape-key events suppressed on the content level.

type AlertDialogProps = DialogPrimitive.DialogProps;

function AlertDialog({ ...props }: AlertDialogProps) {
	return <DialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: DialogPrimitive.DialogPortalProps) {
	return <DialogPrimitive.Portal {...props} />
}

function AlertDialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="alert-dialog-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/50",
				"data-[state=open]:animate-in data-[state=closed]:animate-out",
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<DialogPrimitive.Content
				data-slot="alert-dialog-content"
				// Prevent accidental dismissal: keep the dialog open on overlay click and Escape.
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
				className={cn(
					"fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
					"grid w-full max-w-lg gap-4 rounded-xl border border-border bg-background p-6 shadow-lg",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
					"data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
					className,
				)}
				{...props}
			/>
		</AlertDialogPortal>
	)
}

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn("flex flex-col gap-2 text-center medium:text-left", className)}
			{...props}
		/>
	)
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn("flex flex-col-reverse gap-2 medium:flex-row medium:justify-end", className)}
			{...props}
		/>
	)
}

function AlertDialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn("text-lg font-semibold", className)}
			{...props}
		/>
	)
}

function AlertDialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	)
}

/** Confirm action button — wraps a DialogPrimitive.Close so clicking it closes the dialog. */
function AlertDialogAction({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>) {
	return (
		<DialogPrimitive.Close
			className={cn(buttonVariants(), className)}
			{...props}
		/>
	)
}

/** Cancel button — wraps a DialogPrimitive.Close with the outline style. */
function AlertDialogCancel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>) {
	return (
		<DialogPrimitive.Close
			className={cn(buttonVariants({ variant: "outline" }), className)}
			{...props}
		/>
	)
}

export {
	AlertDialog,
	AlertDialogPortal,
	AlertDialogOverlay,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogAction,
	AlertDialogCancel,
}
