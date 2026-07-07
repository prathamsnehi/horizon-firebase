import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Sparkles,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAppStore } from "../store/useAppStore";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

export default function Landing() {
  const hasOnboarded = useAppStore((s) => s.hasCompletedOnboarding);
  const ctaHref = hasOnboarded ? "/app/home" : "/app/onboarding";

  return (
    <div className="min-h-full bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to={ctaHref}>
              <Button size="sm">Open app</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgb(var(--app-primary)), transparent)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-footnote font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-crafted quests for the real world
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-display font-semibold leading-[1.03] tracking-tight text-foreground sm:text-display-lg">
              Step past the edge of your{" "}
              <span className="text-primary">comfort zone</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Horizon turns who you are into real-world sidequests — personal,
              place-aware, and made to be lived, not scrolled.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={ctaHref}>
                <Button size="lg" className="w-full sm:w-auto">
                  {hasOnboarded ? "Continue your journey" : "Get started"}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                  How it works
                </Button>
              </a>
            </div>
            <p className="mt-4 text-footnote text-muted-foreground">
              No account needed. Your journey stays on your device.
            </p>
          </motion.div>

          {/* Floating preview cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {PREVIEW.map((p) => (
              <div
                key={p.title}
                className="rounded-4xl border border-border bg-surface p-5 text-left shadow-card"
              >
                <div
                  className="mb-4 h-36 w-full rounded-2xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${p.image})` }}
                />
                <p className="font-display text-headline font-semibold text-foreground">
                  {p.title}
                </p>
                <p className="mt-1 text-footnote text-muted-foreground">
                  {p.meta}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Two ways in */}
      <section className="border-t border-border/60 bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            {...fade}
            className="text-center font-display text-title1 font-semibold tracking-tight text-foreground sm:text-largetitle"
          >
            Two ways to find your next thing
          </motion.h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {MODES.map((m, i) => (
              <motion.div
                key={m.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-4xl border border-border bg-surface p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <m.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-display text-title3 font-semibold text-foreground">
                  {m.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{m.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            {...fade}
            className="text-center font-display text-title1 font-semibold tracking-tight text-foreground sm:text-largetitle"
          >
            Three steps to your next story
          </motion.h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-4xl border border-border bg-surface p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <s.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <p className="mt-5 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-display text-title3 font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fade}
            className="mt-16 overflow-hidden rounded-4xl border border-border bg-foreground px-8 py-14 text-center"
          >
            <h2 className="font-display text-largetitle font-semibold tracking-tight text-background">
              Your horizon is waiting.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-background/70">
              Build your profile in under two minutes and get your first three
              sidequests.
            </p>
            <Link to={ctaHref} className="mt-8 inline-block">
              <Button size="lg">
                {hasOnboarded ? "Continue" : "Get started"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <Logo />
          <p className="text-footnote text-muted-foreground">
            Sidequests are AI-generated. Use your own judgment and stay safe.
          </p>
        </div>
      </footer>
    </div>
  );
}

const PREVIEW = [
  {
    title: "Sunrise at the overlook",
    meta: "Moderate · 90 min · 2.4 mi away",
    image: "/sunrise_overlook.png",
  },
  {
    title: "Order in another language",
    meta: "Easy · 30 min · Anywhere",
    image: "/cafe_order.png",
  },
  {
    title: "Open mic, front row",
    meta: "Hard · 2 hr · 2.0 mi away",
    image: "/open_mic.png",
  },
];

const MODES = [
  {
    icon: Sparkles,
    title: "Get three, curated for you",
    body: "Tell us who you are once. Every day, our two-pass AI scouts real places near you and hands you three sidequests worth your time — no endless feed to sift through.",
  },
  {
    icon: PenLine,
    title: "Or describe your own",
    body: "In the mood for something specific? Describe it in a sentence and we'll shape it into a real, doable quest — tied to a place near you when it makes sense.",
  },
];

const STEPS = [
  {
    icon: Compass,
    title: "Tell us your vibe",
    body: "A quick guided flow captures your interests, growth goals, budget, and how far you're willing to roam.",
  },
  {
    icon: Sparkles,
    title: "Get your picks",
    body: "Three tailored sidequests, place-aware and personal — or describe your own idea and we'll craft it on the spot.",
  },
  {
    icon: CheckCircle2,
    title: "Live it, log it",
    body: "Choose one, head out, and capture the moment with photos and a reflection you keep forever.",
  },
];
