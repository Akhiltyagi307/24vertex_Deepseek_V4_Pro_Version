import Image from "next/image"
import { ArrowUp, Globe, Play, Plus, Signature, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, cardSurfaceFrameClassName } from "@/components/ui/card"
import CustomersTableCard from "@/components/ui/features"
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge"
import { cn } from "@/lib/utils"

const featurePreviewShell = cn(
  cardSurfaceFrameClassName,
  "group relative aspect-video w-full shrink-0 overflow-hidden p-4",
)

const STUDENT_AVATAR = "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80"
const PARENT_AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
const TEACHER_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
const COUNSELOR_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"

export default function FeaturesSection() {
  return (
    <section id="benefits" className="bg-background py-16 medium:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
            Benefits
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground medium:text-4xl">
            Benefits that compound across student, parent, and teacher workflows
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground medium:text-lg">
            Every role sees what matters next, so follow-ups stay timely and progress does not stall.
          </p>
        </div>

        <div className="mt-16 grid gap-12">
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-3 xl:items-stretch xl:gap-8 xl:gap-10">
            <div className="flex h-full min-h-0 flex-col gap-5">
              <div className={featurePreviewShell}>
                <MeetingIllustration />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="text-foreground text-lg font-semibold">Shared progress snapshots</h3>
                <p className="text-muted-foreground mt-3 text-pretty">
                  Everyone reads from the same source of truth, which keeps revision plans, parent
                  updates, and teacher actions aligned.
                </p>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col gap-5">
              <div className={featurePreviewShell}>
                <CodeReviewIllustration />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="text-foreground text-lg font-semibold">Early intervention signals</h3>
                <p className="text-muted-foreground mt-3 text-pretty">
                  Weak-topic signals appear early, so support happens while recovery is still easy.
                </p>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col gap-5">
              <div className={featurePreviewShell}>
                <div className="mask-b-from-75% h-full min-h-0">
                  <AIAssistantIllustration />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="text-foreground text-lg font-semibold">Context-aware support</h3>
                <p className="text-muted-foreground mt-3 text-pretty">
                  AI guidance stays grounded in coursework context, helping learners move from
                  confusion to clarity in fewer attempts.
                </p>
              </div>
            </div>
          </div>

          <CustomersTableCard className="mt-2" />
        </div>
      </div>
    </section>
  )
}

const MeetingIllustration = () => {
  return (
    <div aria-hidden className="flex h-full min-h-0 flex-col">
      <div className="mb-0.5 text-sm font-semibold">Weekly learning check-in</div>
      <div className="mb-4 flex gap-2 text-sm">
        <span className="text-muted-foreground">4:00 - 4:30 PM</span>
      </div>
      <div className="mb-2 flex -space-x-1.5">
        <div className="flex -space-x-1.5">
          {[
            { src: STUDENT_AVATAR, alt: "Student" },
            { src: PARENT_AVATAR, alt: "Parent" },
            { src: TEACHER_AVATAR, alt: "Teacher" },
            { src: COUNSELOR_AVATAR, alt: "Counselor" },
          ].map((avatar) => (
            <div
              key={avatar.alt}
              className="bg-background size-7 rounded-full border p-0.5 shadow shadow-zinc-950/5"
            >
              <Image
                className="aspect-square rounded-full object-cover"
                src={avatar.src}
                alt={avatar.alt}
                height={460}
                width={460}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="text-muted-foreground mt-auto text-sm font-medium">Role-aligned next actions</div>
    </div>
  )
}

const CodeReviewIllustration = () => {
  return (
    <div aria-hidden className="relative h-full min-h-0 w-full">
      <Card className="absolute bottom-3 left-3 top-3 flex w-[62%] flex-col p-3 transition-transform duration-200 ease-in-out group-hover:-rotate-3">
        <div className="mb-3 grid min-h-0 grid-cols-[auto_1fr] gap-2">
          <div className="bg-background size-6 shrink-0 rounded-full border p-0.5 shadow shadow-zinc-950/5">
            <Image
              className="aspect-square rounded-full object-cover"
              src={TEACHER_AVATAR}
              alt="Teacher"
              height={460}
              width={460}
            />
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground line-clamp-1 text-sm font-medium">
              Teacher update
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">2m</span>
          </div>
        </div>

        <div className="ml-8 min-h-0 flex-1 space-y-2">
          <div className="bg-foreground/10 h-2 rounded-full" />
          <div className="bg-foreground/10 h-2 w-3/5 rounded-full" />
          <div className="bg-foreground/10 h-2 w-1/2 rounded-full" />
        </div>

        <Signature className="ml-8 mt-2 size-5 shrink-0" />
      </Card>
      <Card className="absolute bottom-5 right-3 top-10 flex w-[34%] flex-col justify-center p-2 transition-transform duration-200 ease-in-out group-hover:rotate-3">
        <div className="bg-foreground/5 mx-auto flex size-10 rounded-full">
          <Play className="fill-foreground/50 stroke-foreground/50 m-auto size-4" />
        </div>
      </Card>
    </div>
  )
}

const AIAssistantIllustration = () => {
  return (
    <div
      // `inert` removes children from the focus/interaction tree (fixes
      // aria-hidden-focus); `aria-hidden` keeps them out of the accessibility
      // tree so axe's color-contrast rule also skips this decorative subtree.
      inert
      aria-hidden
      className="flex h-full min-h-0 flex-col transition-transform duration-200 group-hover:translate-y-0"
    >
      <div className="min-h-0 w-fit max-w-full">
        <Sparkles className="size-3.5 fill-purple-300 stroke-purple-300" />
        <p className="mt-2 line-clamp-2 text-sm">
          What should I revise first before next week based on my latest quiz mistakes?
        </p>
      </div>
      <div className="bg-foreground/5 mt-auto space-y-3 rounded-lg p-3">
        <div className="text-muted-foreground text-sm">Ask AI Assistant</div>

        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className="size-7 rounded-2xl bg-transparent shadow-none"
            >
              <Plus />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-7 rounded-2xl bg-transparent shadow-none"
            >
              <Globe />
            </Button>
          </div>

          <Button size="icon-sm" className="size-7 shrink-0 rounded-2xl">
            <ArrowUp strokeWidth={3} />
          </Button>
        </div>
      </div>
    </div>
  )
}
