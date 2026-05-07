"use client"

import Image from "next/image"
import * as React from "react"

import { landingMarketingBadgeClassName } from "@/lib/marketing/landing-marketing-badge"
import { cn } from "@/lib/utils"

const STUDENT_AVATAR = "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80"
const PARENT_AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
const TEACHER_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"

export type Customer = {
  id: number | string
  role: "Student" | "Parent" | "Teacher" | "Counselor"
  signal: "Strong" | "Watch" | "Risk"
  statusVariant: "success" | "danger" | "warning"
  focus: string
  avatar: string
  outcome: string
}

export type CustomersTableCardProps = {
  title?: string
  subtitle?: string
  className?: string
  customers?: Customer[]
}

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 1,
    role: "Parent",
    signal: "Strong",
    statusVariant: "success",
    focus: "Weekly check-ins are consistent",
    avatar: PARENT_AVATAR,
    outcome: "Progress is visible without chasing updates",
  },
  {
    id: 2,
    role: "Student",
    signal: "Watch",
    statusVariant: "warning",
    focus: "Revision gaps show up before exam week",
    avatar: STUDENT_AVATAR,
    outcome: "Next-best topic is clear after every session",
  },
  {
    id: 3,
    role: "Teacher",
    signal: "Strong",
    statusVariant: "success",
    focus: "Assignments and interventions stay aligned",
    avatar: TEACHER_AVATAR,
    outcome: "Class momentum improves with less admin overhead",
  },
]

const SignalBadge = ({ children }: { children: React.ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center justify-center rounded-full font-medium",
      landingMarketingBadgeClassName,
    )}
  >
    {children}
  </span>
)

export default function CustomersTableCard({
  title = "Cross-role clarity map",
  subtitle = "Each role sees what matters next, without losing shared context",
  customers = DEFAULT_CUSTOMERS,
  className,
}: CustomersTableCardProps) {
  return (
    <section
      className={cn(
        "bg-background shadow-foreground/5 inset-ring-1 inset-ring-background ring-foreground/5 relative w-full overflow-hidden rounded-2xl border border-border/60 shadow-md ring-1",
        className
      )}
      aria-label={title}
    >
      <div className="space-y-1 border-b border-border/60 p-6">
        <div className="flex items-center gap-1.5">
          <span className="bg-muted size-2 rounded-full border border-black/5" />
          <span className="bg-muted size-2 rounded-full border border-black/5" />
          <span className="bg-muted size-2 rounded-full border border-black/5" />
        </div>
        <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/50 supports-[backdrop-filter]:backdrop-blur-sm sticky top-0 z-10">
            <tr className="text-muted-foreground *:px-3 *:py-3 *:text-left *:font-medium">
              <th className="w-12">#</th>
              <th className="min-w-[120px]">Role</th>
              <th className="min-w-[120px]">Signal</th>
              <th className="min-w-[220px]">Focus area</th>
              <th className="min-w-[160px] pr-4 text-right">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, idx) => (
              <tr
                key={customer.id}
                className="hover:bg-muted/30 border-b border-border/60 transition-colors *:px-3 *:py-2 last:border-0"
              >
                <td className="text-muted-foreground">{idx + 1}</td>
                <td className="whitespace-nowrap">{customer.role}</td>
                <td>
                  <SignalBadge>{customer.signal}</SignalBadge>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="size-7 overflow-hidden rounded-full ring-1 ring-border/60">
                      <Image
                        src={customer.avatar}
                        alt={customer.role}
                        width={28}
                        height={28}
                        sizes="28px"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-foreground truncate font-medium">{customer.focus}</span>
                  </div>
                </td>
                <td className="pr-4 text-right font-medium">{customer.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 p-4 text-xs text-muted-foreground">
        <span>
          Showing <strong>{customers.length}</strong> role snapshots
        </span>
        <span>Aligned across student, parent, and teacher surfaces</span>
      </div>
    </section>
  )
}
