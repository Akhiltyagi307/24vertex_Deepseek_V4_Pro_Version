import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white [a]:hover:bg-emerald-600/90 dark:bg-emerald-500 dark:[a]:hover:bg-emerald-500/90",
        outline:
          "border-2 border-emerald-600 bg-background text-emerald-800 shadow-none hover:bg-emerald-600 hover:text-white aria-expanded:bg-emerald-600 aria-expanded:text-white dark:border-emerald-500 dark:bg-input/30 dark:text-emerald-100 dark:hover:bg-emerald-500 dark:aria-expanded:bg-emerald-500 dark:aria-expanded:text-white [a]:hover:bg-emerald-600 [a]:hover:text-white dark:[a]:hover:bg-emerald-500",
        secondary:
          "bg-emerald-600 text-white hover:bg-emerald-600/90 aria-expanded:bg-emerald-600 aria-expanded:text-white dark:bg-emerald-500 dark:hover:bg-emerald-500/90 dark:aria-expanded:bg-emerald-500 [a]:hover:bg-emerald-600/90 dark:[a]:hover:bg-emerald-500/90",
        ghost:
          "text-foreground hover:bg-emerald-600/12 hover:text-emerald-900 aria-expanded:bg-emerald-600/12 aria-expanded:text-emerald-900 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-50 dark:aria-expanded:bg-emerald-500/15 dark:aria-expanded:text-emerald-50 [a]:hover:bg-emerald-600/12 dark:[a]:hover:bg-emerald-500/15",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link:
          "text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.9rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const effectiveNativeButton =
    nativeButton ?? (render == null ? true : false)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      nativeButton={effectiveNativeButton}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
