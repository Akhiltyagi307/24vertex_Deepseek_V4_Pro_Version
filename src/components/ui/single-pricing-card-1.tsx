'use client'

import Link from 'next/link'
import { ShieldCheckIcon } from 'lucide-react'
import { motion } from 'framer-motion'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  landingMarketingBadgeClassName,
  landingMarketingSectionEyebrowBadgeClassName,
} from '@/lib/marketing/landing-marketing-badge'
import { cn } from '@/lib/utils'
import {
  pricingSectionGridOverlayClassName,
  pricingTierCardSurfaceClassName,
} from '@/lib/marketing/pricing-card-surface'

export function Pricing() {
  return (
    <section className="relative overflow-hidden bg-background py-16 sm:py-20">
      <div id="pricing" className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 md:space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl space-y-4 md:space-y-6"
        >
          <div className="flex justify-center">
            <Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
              Pricing
            </Badge>
          </div>
          <h2 className="mt-4 text-center text-3xl font-semibold tracking-tight sm:text-4xl md:mt-6">
            Pick the plan that matches your study pace
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed sm:text-lg md:mt-6">
            Both plans include full access to practice tests, assignments, and doubt support. Yearly
            costs less per month if you expect a full year of prep; monthly stays the better fit when
            you want to renew one month at a time.
          </p>
        </motion.div>

        <div className="relative">
          <div className={pricingSectionGridOverlayClassName} aria-hidden />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="mx-auto w-full space-y-5"
          >
            <div className="bg-background relative grid grid-cols-1 gap-3 border border-transparent p-3 md:grid-cols-2 md:gap-6 md:p-7">
              <div
                className={cn(
                  'relative z-10 order-2 flex h-full w-full flex-col overflow-hidden px-4 py-4 md:order-1 md:px-6 md:py-6',
                  pricingTierCardSurfaceClassName,
                  'border-border/55',
                )}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <h3 className="text-base leading-none font-semibold md:text-lg">Monthly</h3>
                    <div className="flex items-center gap-x-1">
                      <span className="text-muted-foreground text-sm md:text-base">₹999</span>
                      <Badge variant="secondary" className={landingMarketingBadgeClassName}>
                        Billed monthly
                      </Badge>
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
                  <div className="text-muted-foreground flex items-end gap-1 text-lg md:text-xl">
                    <span>₹</span>
                    <span className="text-foreground -mb-0.5 text-3xl font-extrabold tracking-tight md:text-5xl">
                      999
                    </span>
                    <span>/month</span>
                  </div>
                  <Button
                    className="h-10 w-full rounded-full px-4 text-sm font-semibold shadow-none"
                    variant="marketingSecondary"
                    render={<Link href="/signup/role-picker" />}
                  >
                    Choose Monthly
                  </Button>
                  <p className="text-muted-foreground min-h-0 text-sm leading-relaxed md:min-h-[3.5rem]">
                    Auto-renews every month. Cancel anytime before renewal.
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  pricingTierCardSurfaceClassName,
                  'relative z-10 order-1 flex h-full w-full flex-col overflow-hidden md:order-2',
                  // Frosted tier: blur grid/section behind the card (yearly is the only translucent tier).
                  'border-primary/40 bg-[color-mix(in_oklch,var(--card)_72%,transparent)]',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'shadow-[0_20px_56px_-32px_oklch(0.52_0.14_170/.68)]',
                  'ring-1 ring-inset ring-primary/35',
                )}
              >
                <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <h3 className="text-lg leading-none font-semibold md:text-xl">Yearly</h3>
                      <div className="flex items-center gap-x-1">
                        <span className="text-muted-foreground text-sm md:text-base">₹9,999</span>
                        <Badge className={cn('md:hidden', landingMarketingBadgeClassName)}>Recommended</Badge>
                        <Badge className={cn('hidden md:inline-flex', landingMarketingBadgeClassName)}>
                          Best value
                        </Badge>
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
                      <span className="text-foreground -mb-0.5 text-5xl font-extrabold tracking-tight md:text-7xl">
                        9,999
                      </span>
                      <span>/year</span>
                    </div>
                    <Button
                      className="h-10 w-full rounded-full px-4 text-sm font-semibold shadow-none"
                      render={<Link href="/signup/role-picker" />}
                    >
                      Choose Yearly
                    </Button>
                    <p className="text-muted-foreground min-h-0 text-sm leading-relaxed md:min-h-[3.5rem]">
                      Auto-renews yearly. Effective monthly cost is about ₹833.
                    </p>
                  </div>
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
