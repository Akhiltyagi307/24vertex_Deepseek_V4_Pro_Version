import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  /** Retained for call-site compatibility; spotlight styling is not applied. */
  glowColor?: "blue" | "purple" | "green" | "red" | "orange";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const sizeMap = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
} as const;

function GlowCard({
  children,
  className,
  glowColor: _glowColor = "blue",
  size = "md",
  width,
  height,
  customSize = false,
}: GlowCardProps) {
  return (
    <div
      style={{
        ...(width !== undefined && { width: typeof width === "number" ? `${width}px` : width }),
        ...(height !== undefined && { height: typeof height === "number" ? `${height}px` : height }),
      }}
      className={cn(
        !customSize && sizeMap[size],
        !customSize && "aspect-[3/4]",
        "group relative grid rounded-2xl bg-card p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { GlowCard };
