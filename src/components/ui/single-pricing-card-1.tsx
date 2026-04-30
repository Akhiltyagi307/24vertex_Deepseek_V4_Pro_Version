'use client'

import Link from 'next/link'
import { ShieldCheckIcon } from 'lucide-react'
import { motion } from 'framer-motion'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Pricing() {
  return (
    <section className="relative overflow-hidden border-b border-foreground/20 bg-background py-16 sm:py-20">
      <div id="pricing" className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 md:space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl space-y-4 md:space-y-6"
        >
          <div className="flex justify-center">
            <Badge variant="outline">Pricing</Badge>
          </div>
          <h2 className="mt-4 text-center text-3xl font-semibold tracking-tight sm:text-4xl md:mt-6">
            Pick the plan that matches your study pace
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed sm:text-lg md:mt-6">
            Both plans include full access to practice tests, assignments, and doubt support. Choose
            monthly flexibility or yearly savings.
          </p>
        </motion.div>

        <div className="relative">
          <div
            className={cn(
              'pointer-events-none absolute inset-0 z-10 hidden size-full md:block',
              'bg-[linear-gradient(to_right,--theme(--color-foreground/.2)_1px,transparent_1px),linear-gradient(to_bottom,--theme(--color-foreground/.2)_1px,transparent_1px)]',
              'bg-[size:32px_32px]',
              '[mask-image:radial-gradient(ellipse_at_center,var(--background)_10%,transparent)]'
            )}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="mx-auto w-full max-w-4xl space-y-5"
          >
            <div className="bg-background relative grid gap-3 border border-transparent p-3 md:grid-cols-2 md:gap-6 md:p-7">
              <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background/60 px-4 py-4 shadow-[0_18px_50px_-30px_oklch(0.2_0.02_170/.75)] md:px-6 md:py-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <h3 className="text-lg leading-none font-semibold">Monthly</h3>
                    <div className="flex items-center gap-x-1">
                      <span className="text-muted-foreground text-sm md:text-base">₹999</span>
                      <Badge variant="secondary">Billed monthly</Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                    Full access plan for consistent monthly prep.
                  </p>
                  <p className="text-sm leading-relaxed opacity-0 md:text-base">
                    Save ₹1,989 compared to monthly billing.
                  </p>
                </div>
                <div className="mt-auto space-y-4 pt-8 md:space-y-5 md:pt-12">
                  <div className="text-muted-foreground flex items-end gap-1 text-xl md:text-2xl">
                    <span>₹</span>
                    <span className="text-foreground -mb-0.5 text-4xl font-extrabold tracking-tight md:text-6xl">
                      999
                    </span>
                    <span>/month</span>
                  </div>
                  <Button
                    className="h-10 w-full rounded-full px-4 text-sm"
                    variant="outline"
                    render={<Link href="/signup/role-picker" />}
                  >
                    Choose Monthly
                  </Button>
                  <p className="text-muted-foreground min-h-0 text-sm leading-relaxed md:min-h-[3.5rem]">
                    Auto-renews every month. Cancel anytime before renewal.
                  </p>
                </div>
              </div>
              <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background/60 px-4 py-4 shadow-[0_20px_56px_-32px_oklch(0.52_0.14_170/.68)] md:px-6 md:py-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <h3 className="text-lg leading-none font-semibold">Yearly</h3>
                    <div className="flex items-center gap-x-1">
                      <span className="text-muted-foreground text-sm md:text-base">₹9,999</span>
                      <Badge className="border-primary/40 bg-primary/20 text-primary md:hidden">Recommended</Badge>
                      <Badge className="hidden md:inline-flex">Best value</Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                    One payment for the full year with uninterrupted access.
                  </p>
                  <p className="text-primary text-sm font-medium md:text-base">
                    Save ₹1,989 compared to monthly billing.
                  </p>
                </div>
                <div className="mt-auto space-y-4 pt-8 md:space-y-5 md:pt-12">
                  <div className="text-muted-foreground flex items-end gap-1 text-xl md:text-2xl">
                    <span>₹</span>
                    <span className="text-foreground -mb-0.5 text-4xl font-extrabold tracking-tight md:text-6xl">
                      9,999
                    </span>
                    <span>/year</span>
                  </div>
                  <Button className="h-10 w-full rounded-full px-4 text-sm" render={<Link href="/signup/role-picker" />}>
                    Choose Yearly
                  </Button>
                  <p className="text-muted-foreground min-h-0 text-sm leading-relaxed md:min-h-[3.5rem]">
                    Auto-renews yearly. Effective monthly cost is about ₹833.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-muted-foreground flex items-center justify-center gap-x-2 text-center text-sm md:text-base">
              <ShieldCheckIcon className="size-5" />
              <span>Secure checkout, no hidden fees. Taxes apply where required.</span>
            </div>
            <div className="text-muted-foreground mx-auto max-w-3xl text-center text-sm leading-relaxed">
              By continuing, you agree to the billing terms. You can manage or cancel your plan from
              your account subscription settings.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
