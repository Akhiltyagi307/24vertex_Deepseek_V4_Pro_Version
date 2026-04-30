import { GlowCard } from "@/components/ui/spotlight-card";
import { CpuArchitecture } from "@/components/ui/cpu-architecture";
import { Badge } from "@/components/ui/badge";
import { BarChart3, BookOpenCheck, ShieldCheck, Sparkles, Users } from "lucide-react";

export function Features() {
	return (
		<section id="features" className="border-b border-foreground/20 bg-background py-16 sm:py-20">
			<div className="w-full px-4 sm:px-6 lg:px-8">
				<div className="mx-auto mb-12 max-w-3xl text-center">
					<Badge variant="outline" className="mb-4">
						Features
					</Badge>
					<h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						Platform features built for measurable learning outcomes
					</h2>
					<p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
						Designed to improve student clarity, parent visibility, and teacher action with one
						connected workflow.
					</p>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-6">
					<GlowCard
						glowColor="green"
						customSize
						className="md:col-span-2 min-h-[190px] sm:min-h-[210px] overflow-hidden rounded-[12px] border-white/10 bg-zinc-950 text-zinc-100"
					>
						<div className="relative z-10 flex h-full flex-col justify-between gap-5">
							<div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
								<BookOpenCheck className="size-3.5 text-emerald-300" />
								Aligned learning paths
							</div>
							<div>
								<p className="text-3xl font-semibold tracking-tight sm:text-4xl">100%</p>
								<h3 className="mt-2 text-xl font-semibold sm:text-2xl">Customizable by grade</h3>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="blue"
						customSize
						className="md:col-span-2 min-h-[190px] sm:min-h-[210px] overflow-hidden rounded-[12px] border-white/10 bg-zinc-950 text-zinc-100"
					>
						<div className="relative z-10 grid h-full gap-4">
							<div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
								<ShieldCheck className="size-3.5 text-sky-300" />
								Security mesh
							</div>
							<div className="h-[112px] w-full rounded-[15px] border border-white/10 bg-zinc-900/80 p-1.5">
								<CpuArchitecture className="h-full w-full text-zinc-500" text="SAFE" lineMarkerSize={16} />
							</div>
							<div>
								<h3 className="text-xl font-semibold sm:text-2xl">Secure by default</h3>
								<p className="mt-2 text-sm text-zinc-400">
									Role-based permissions, parent linkage checks, and safer student defaults in every flow.
								</p>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="purple"
						customSize
						className="md:col-span-2 min-h-[190px] sm:min-h-[210px] overflow-hidden rounded-[12px] border-white/10 bg-zinc-950 text-zinc-100"
					>
						<div className="relative z-10 flex h-full flex-col justify-between gap-5">
							<div className="flex items-center gap-2 text-xs text-zinc-300">
								<Sparkles className="size-4 text-violet-300" />
								Adaptive insight signals
							</div>
							<div>
								<h3 className="text-xl font-semibold sm:text-2xl">Faster intervention loops</h3>
								<p className="mt-2 text-sm text-zinc-400">
									Teachers spot drift sooner, students get targeted practice before exams.
								</p>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="orange"
						customSize
						className="md:col-span-3 min-h-[240px] sm:min-h-[260px] overflow-hidden rounded-[12px] border-white/10 bg-zinc-950 text-zinc-100"
					>
						<div className="relative z-10 grid h-full gap-5 sm:grid-cols-2">
							<div className="flex flex-col justify-between">
								<div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
									<BarChart3 className="size-3.5 text-amber-300" />
									Progress analytics
								</div>
								<div>
									<h3 className="mt-4 text-xl font-semibold sm:text-2xl">Performance clarity</h3>
									<p className="mt-2 text-sm text-zinc-400">
										Track topics, session quality, and readiness trends in one place.
									</p>
								</div>
							</div>
							<div className="relative h-full w-full overflow-hidden rounded-[15px] border border-white/10 bg-zinc-900/80 p-3">
								<div className="absolute left-3 top-2 flex gap-1">
									<span className="block size-1.5 rounded-full bg-zinc-500/70" />
									<span className="block size-1.5 rounded-full bg-zinc-500/70" />
									<span className="block size-1.5 rounded-full bg-zinc-500/70" />
								</div>
								<svg
									className="mt-4 h-[calc(100%-1rem)] w-full text-zinc-300"
									viewBox="0 0 366 231"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									aria-hidden
								>
									<path
										d="M1 179.796L4.05663 172.195V183.933L7.20122 174.398L8.45592 183.933L10.0546 186.948V155.455L12.6353 152.613V145.122L15.3021 134.71V149.804V155.455L16.6916 160.829L18.1222 172.195V158.182L19.8001 152.613L21.4105 148.111V137.548L23.6863 142.407V126.049L25.7658 127.87V120.525L27.2755 118.066L29.1801 112.407V123.822L31.0426 120.525V130.26L32.3559 134.71L34.406 145.122V137.548L35.8982 130.26L37.1871 126.049L38.6578 134.71L40.659 138.977V130.26V126.049L43.7557 130.26V123.822L45.972 112.407L47.3391 103.407V92.4726L49.2133 98.4651V106.053L52.5797 89.7556L54.4559 82.7747L56.1181 87.9656L58.9383 89.7556V98.4651L60.7617 103.407L62.0545 123.822L63.8789 118.066L65.631 122.082L68.5479 114.229L70.299 109.729L71.8899 118.066L73.5785 123.822V130.26L74.9446 134.861L76.9243 127.87L78.352 134.71V138.977L80.0787 142.407V152.613L83.0415 142.407V130.26L86.791 123.822L89.0121 116.645V122.082L90.6059 127.87L92.3541 131.77L93.7104 123.822L95.4635 118.066L96.7553 122.082V137.548L99.7094 140.988V131.77L101.711 120.525L103.036 116.645V133.348L104.893 136.218L106.951 140.988L108.933 134.71L110.797 130.26L112.856 140.988V148.111L115.711 152.613L117.941 145.122L119.999 140.988L121.501 148.111L123.4 152.613L125.401 158.182L127.992 152.613L131.578 146.76V155.455L134.143 158.182L135.818 164.629L138.329 158.182L140.612 160.829L144.117 166.757L146.118 155.455L147.823 149.804L151.02 152.613L154.886 145.122L158.496 140.988V133.348L161.295 127.87V122.082L162.855 116.645V109.729L164.83 103.407L166.894 109.729L176.249 98.4651L178.254 106.169L180.77 98.4651V81.045L182.906 69.1641L184.8 56.8669L186.477 62.8428L187.848 79.7483L188.849 106.169L191.351 79.7483L193.485 75.645V98.4651L196.622 94.4523L198.623 87.4228V79.7483L200.717 75.645L202.276 81.045V89.3966L203.638 113.023L205.334 99.8037L207.164 94.4523L208.982 98.4651V102.176L211.267 107.64L212.788 81.045L214.437 66.0083L216.19 62.8428L217.941 56.8669V73.676V79.7483L220.28 75.645L222.516 66.0083V73.676H226.174V84.8662L228.566 98.4651L230.316 75.645L233.61 94.4523V104.25L236.882 102.176L239.543 113.023L241.057 98.4651L243.604 94.4523L244.975 106.169L245.975 87.4228L247.272 89.3966L250.732 84.8662L251.733 96.7549L254.644 94.4523L257.452 99.8037L259.853 91.3111L261.193 84.8662L264.162 75.645L265.808 87.4228L267.247 58.4895L269.757 66.0083L276.625 13.5146L273.33 58.4895L276.25 67.6563L282.377 20.1968L281.37 58.4895V66.0083L283.579 75.645L286.033 56.8669L287.436 73.676L290.628 77.6636L292.414 84.8662L294.214 61.3904L296.215 18.9623L300.826 0.947876L297.531 56.8669L299.973 62.8428L305.548 22.0598L299.755 114.956L301.907 105.378L304.192 112.688V94.9932L308.009 80.0829L310.003 94.9932L311.004 102.127L312.386 105.378L315.007 112.688L316.853 98.004L318.895 105.378L321.257 94.9932L324.349 100.81L325.032 80.0829L327.604 61.5733L329.357 74.9864L332.611 52.6565L334.352 48.5552L335.785 55.2637L338.377 59.5888V73.426L341.699 87.5181L343.843 93.4347L347.714 82.1171L350.229 78.6821L351.974 89.7556L353.323 94.9932L355.821 93.4347L357.799 102.127L360.684 108.794L363.219 98.004L365 89.7556"
										stroke="currentColor"
										strokeWidth="2"
									/>
								</svg>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="green"
						customSize
						className="md:col-span-3 min-h-[240px] sm:min-h-[260px] overflow-hidden rounded-[12px] border-white/10 bg-zinc-950 text-zinc-100"
					>
						<div className="relative z-10 grid h-full gap-5 sm:grid-cols-2">
							<div className="flex flex-col justify-between">
								<div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
									<Users className="size-3.5 text-emerald-300" />
									Student-parent-teacher sync
								</div>
								<div>
									<h3 className="mt-4 text-xl font-semibold sm:text-2xl">Shared accountability</h3>
									<p className="mt-2 text-sm text-zinc-400">
										Everyone sees what matters, without noisy dashboards or guesswork.
									</p>
								</div>
							</div>
							<div className="relative h-full rounded-[15px] border border-white/10 bg-zinc-900/80 p-4">
								<div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-zinc-700/60" />
								<div className="relative flex h-full flex-col justify-center space-y-5 py-3">
									<div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
										<span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200">Likeur</span>
										<div className="size-7 overflow-hidden rounded-full ring-2 ring-zinc-800">
											<img
												className="size-full object-cover"
												src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80"
												alt="User avatar"
											/>
										</div>
									</div>
									<div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
										<div className="size-8 overflow-hidden rounded-full ring-2 ring-zinc-800">
											<img
												className="size-full object-cover"
												src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
												alt="User avatar"
											/>
										</div>
										<span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200">M. Irung</span>
									</div>
									<div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
										<span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200">B. Ng</span>
										<div className="size-7 overflow-hidden rounded-full ring-2 ring-zinc-800">
											<img
												className="size-full object-cover"
												src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
												alt="User avatar"
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</GlowCard>
				</div>
			</div>
		</section>
	);
}
