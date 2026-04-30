import { ArrowUp, Globe, Play, Plus, Signature, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import CustomersTableCard from "@/components/ui/features"

const STUDENT_AVATAR = "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80"
const PARENT_AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
const TEACHER_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
const COUNSELOR_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"

export default function FeaturesSection() {
  return (
    <section id="benefits" className="border-b border-foreground/20 bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4">
            Benefits
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Benefits that compound across student, parent, and teacher workflows
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Every role sees what matters next, so follow-ups stay timely and progress does not stall.
          </p>
        </div>

        <div className="mt-16 grid gap-12">
          <div className="grid items-center gap-6 sm:grid-cols-5">
            <Card className="p-6 sm:col-span-2">
              <MeetingIllustration />
            </Card>
            <div className="max-w-md sm:col-span-3">
              <h3 className="text-foreground text-lg font-semibold">Shared progress snapshots</h3>
              <p className="text-muted-foreground mt-3 text-balance">
                Everyone reads from the same source of truth, which keeps revision plans, parent
                updates, and teacher actions aligned.
              </p>
            </div>
          </div>

          <div className="grid items-center gap-6 sm:grid-cols-5">
            <Card className="overflow-hidden p-6 sm:col-span-2 sm:overflow-clip">
              <CodeReviewIllustration />
            </Card>
            <div className="max-w-md sm:col-span-3">
              <h3 className="text-foreground text-lg font-semibold">Early intervention signals</h3>
              <p className="text-muted-foreground mt-3 text-balance">
                Weak-topic signals appear early, so support happens while recovery is still easy.
              </p>
            </div>
          </div>

          <div className="grid items-center gap-6 sm:grid-cols-5">
            <Card className="overflow-hidden px-6 sm:col-span-2">
              <div className="mask-b-from-75% -mx-2 -mt-2 px-2 pt-6">
                <AIAssistantIllustration />
              </div>
            </Card>
            <div className="max-w-md sm:col-span-3">
              <h3 className="text-foreground text-lg font-semibold">Context-aware support</h3>
              <p className="text-muted-foreground mt-3 text-balance">
                AI guidance stays grounded in coursework context, helping learners move from
                confusion to clarity in fewer attempts.
              </p>
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
    <Card aria-hidden className="aspect-video p-4">
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
              <img
                className="aspect-square rounded-full object-cover"
                src={avatar.src}
                alt={avatar.alt}
                height="460"
                width="460"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="text-muted-foreground text-sm font-medium">Role-aligned next actions</div>
    </Card>
  )
}

const CodeReviewIllustration = () => {
  return (
    <div aria-hidden className="relative">
      <Card className="aspect-video w-4/5 p-3 transition-transform duration-200 ease-in-out group-hover:-rotate-3">
        <div className="mb-3 grid grid-cols-[auto_1fr] gap-2">
          <div className="bg-background size-6 rounded-full border p-0.5 shadow shadow-zinc-950/5">
            <img
              className="aspect-square rounded-full object-cover"
              src={TEACHER_AVATAR}
              alt="Teacher"
              height="460"
              width="460"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground line-clamp-1 text-sm font-medium">
              Teacher update
            </span>
            <span className="text-muted-foreground/75 text-xs">2m</span>
          </div>
        </div>

        <div className="ml-8 space-y-2">
          <div className="bg-foreground/10 h-2 rounded-full" />
          <div className="bg-foreground/10 h-2 w-3/5 rounded-full" />
          <div className="bg-foreground/10 h-2 w-1/2 rounded-full" />
        </div>

        <Signature className="ml-8 mt-3 size-5" />
      </Card>
      <Card className="aspect-3/5 absolute right-0 top-4 flex w-2/5 translate-y-4 p-2 transition-transform duration-200 ease-in-out group-hover:rotate-3">
        <div className="bg-foreground/5 m-auto flex size-10 rounded-full">
          <Play className="fill-foreground/50 stroke-foreground/50 m-auto size-4" />
        </div>
      </Card>
    </div>
  )
}

const AIAssistantIllustration = () => {
  return (
    <Card aria-hidden className="aspect-video p-4 transition-transform duration-200 group-hover:translate-y-0">
      <div className="w-fit">
        <Sparkles className="size-3.5 fill-purple-300 stroke-purple-300" />
        <p className="mt-2 line-clamp-2 text-sm">
          What should I revise first before next week based on my latest quiz mistakes?
        </p>
      </div>
      <div className="bg-foreground/5 -mx-3 -mb-3 mt-3 space-y-3 rounded-lg p-3">
        <div className="text-muted-foreground text-sm">Ask AI Assistant</div>

        <div className="flex justify-between">
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

          <Button size="icon-sm" className="size-7 rounded-2xl">
            <ArrowUp strokeWidth={3} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
