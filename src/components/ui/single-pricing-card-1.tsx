'use client'

import Link from 'next/link'
import { ShieldCheckIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  landingMarketingBadgeClassName,
  landingMarketingSectionEyebrowBadgeClassName,
} from '@/lib/marketing/landing-marketing-badge'
import { LANDING_PARENT_PRIMARY_CTA_HREF } from '@/lib/marketing/landing-copy'
import {
  MARKETING_SECTION_INTRO_MAX_CLASSNAME,
  marketingSectionLeadClassName,
} from '@/lib/marketing/marketing-section-rhythm'
import { cn } from '@/lib/utils'
import {
  pricingSectionGridOverlayClassName,
  pricingTierCardSurfaceClassName,
} from '@/lib/marketing/pricing-card-surface'

export function Pricing() {
  return (
    <section className="relative overflow-hidden bg-background py-16 medium:py-20 xl:py-24">
      <div id="pricing" className="mx-auto w-full max-w-7xl space-y-8 px-4 medium:px-6 xl:px-8 medium:space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className={cn(
            'mx-auto space-y-4 text-center medium:space-y-6',
            MARKETING_SECTION_INTRO_MAX_CLASSNAME,
          )}
        >
          <div className="flex justify-center">
            <Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
              Pricing
            </Badge>
          </div>
          <h2 className="mt-4 text-balance text-center text-3xl font-semibold tracking-tight medium:text-4xl medium:mt-6">
            One plan. Pay monthly to try it, pay yearly and lock in two free months.
          </h2>
          <p className={cn(marketingSectionLeadClassName, 'mt-4 text-pretty text-center leading-relaxed medium:mt-6')}>
            Less than the cost of one week of most home tuitions, for a private AI tutor and a
            parent dashboard your child&rsquo;s school does not give you. Both plans include full
            practice tests, the Explain and Solve-with-me tutor, and chapter-level analytics.
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
            <div className="bg-background relative grid grid-cols-1 gap-3 border border-transparent p-3 medium:grid-cols-2 medium:gap-6 medium:p-7">
              <div
                className={cn(
                  'relative z-10 order-2 flex h-full w-full flex-col overflow-hidden px-4 py-4 medium:order-1 medium:px-6 medium:py-6',
                  pricingTierCardSurfaceClassName,
                  'border-border/55',
                )}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <h3 className="text-base leading-none font-semibold medium:text-lg">Monthly</h3>
                    <Badge variant="secondary" className={landingMarketingBadgeClassName}>
                      Try it for a month
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
                    Stay flexible. Pay one month at a time, cancel any time before the next renewal.
                  </p>
                  {/* Reserve symmetric vertical space with the yearly card without leaving an
                      announce-able phantom string for screen readers (was `opacity-0`). */}
                  <p
                    aria-hidden
                    className="invisible select-none text-sm leading-relaxed medium:text-base"
                  >
                    Save 2 months free compared to monthly billing.
                  </p>
                </div>
                <div className="mt-auto space-y-4 pt-8 medium:space-y-5 medium:pt-12">
                  <div className="text-muted-foreground flex items-end gap-1 text-lg medium:text-xl">
                    <span>&#8377;</span>
                    <span className="text-foreground -mb-0.5 text-3xl font-extrabold tracking-tight medium:text-5xl">
                      1,000
                    </span>
                    <span>/month</span>
                  </div>
                  <Button
                    className="h-10 w-full rounded-full px-4 text-sm font-semibold shadow-none"
                    variant="marketingSecondary"
                    render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
                  >
                    Start free, then ₹1,000/month
                  </Button>
                  <p className="text-muted-foreground min-h-0 text-sm leading-relaxed medium:min-h-[3.5rem]">
                    Cancel any time. Auto-renews monthly only after your 14-day free trial ends.
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  pricingTierCardSurfaceClassName,
                  'relative z-10 order-1 flex h-full w-full flex-col overflow-hidden medium:order-2',
                  // Frosted tier: blur grid/section behind the card (yearly is the only translucent tier).
                  'border-primary/40 bg-[color-mix(in_oklch,var(--card)_72%,transparent)]',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'shadow-[0_20px_56px_-32px_oklch(0.52_0.14_170/.68)]',
                  'ring-1 ring-inset ring-primary/35',
                )}
              >
                <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 medium:px-6 medium:py-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <h3 className="text-lg leading-none font-semibold medium:text-xl">Yearly</h3>
                      <Badge className={landingMarketingBadgeClassName}>2 months free</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
                      Pay once for the whole school year. Locks in your child&rsquo;s practice
                      streak, term break to term break.
                    </p>
                    <p className="text-primary text-sm font-medium medium:text-base">
                      Effective ₹833/month. Save ₹2,000 compared to paying monthly.
                    </p>
                  </div>
                  <div className="mt-auto space-y-4 pt-8 medium:space-y-5 medium:pt-12">
                    <div className="text-muted-foreground flex items-end gap-1 text-xl medium:text-2xl">
                      <span>&#8377;</span>
                      <span className="text-foreground -mb-0.5 text-5xl font-extrabold tracking-tight medium:text-7xl">
                        10,000
                      </span>
                      <span>/year</span>
                    </div>
                    <Button
                      className="h-10 w-full rounded-full px-4 text-sm font-semibold shadow-none"
                      render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
                    >
                      Start free, then ₹10,000/year
                    </Button>
                    <p className="text-muted-foreground min-h-0 text-sm leading-relaxed medium:min-h-[3.5rem]">
                      Cancel any time before renewal. Auto-renews yearly only after the 14-day free trial.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn('mx-auto rounded-2xl border border-border/60 bg-muted/25 px-5 py-4 text-center medium:px-7 medium:py-5', MARKETING_SECTION_INTRO_MAX_CLASSNAME)}>
              <p className="text-foreground text-pretty text-[0.9375rem] font-semibold leading-relaxed medium:text-base">
                Free trial: 14 days. 5 full practice tests. The Explain and Solve-with-me tutor
                included. No card needed to start.
              </p>
              <p className="text-muted-foreground mt-1 text-pretty text-xs leading-relaxed medium:text-sm">
                One subscription per student account. Sibling? Add a second child at the same plan
                price. No extra family fee.
              </p>
            </div>

            <div className="text-muted-foreground flex items-center justify-center gap-x-2 text-center text-sm medium:text-base">
              <ShieldCheckIcon className="size-5" />
              <span>Secure Razorpay checkout. No hidden fees. GST applied where required.</span>
            </div>
            <div className={cn('text-muted-foreground mx-auto text-center text-sm leading-relaxed', MARKETING_SECTION_INTRO_MAX_CLASSNAME)}>
              By continuing, you agree to the billing terms. Manage or cancel any time from your
              account subscription settings.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
