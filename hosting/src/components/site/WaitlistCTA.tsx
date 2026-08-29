import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

/**
 * Waitlist email capture — the primary conversion action while the app is
 * pre-launch. Posts to WAITLIST_ENDPOINT when set (Formspree / Tally / Buttondown,
 * or a TestFlight-collecting form); otherwise shows the success state optimistically
 * so the UI is testable before the endpoint exists. Deliberately Firebase-free so
 * the `/` route stays out of the admin/Firebase chunk.
 */
// TODO(founder): set your waitlist endpoint (e.g. a Formspree/Tally form POST URL).
const WAITLIST_ENDPOINT = "";

type Status = "idle" | "submitting" | "done" | "error";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function WaitlistCTA({ id, className, dark = false }: { id?: string; className?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      if (WAITLIST_ENDPOINT) {
        const res = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, source: "horizon-marketing" }),
        });
        if (!res.ok) throw new Error("bad status");
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const field = dark
    ? "border-white/20 bg-white/5 text-paper placeholder:text-white/40"
    : "border-ink/15 bg-white text-ink placeholder:text-ink-faint";

  return (
    <div id={id} className={cn("w-full max-w-md", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {status === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex items-center gap-2.5 py-2 text-[15px] font-medium", dark ? "text-paper" : "text-ink")}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="grid size-6 shrink-0 place-items-center rounded-full bg-forest text-white"
            >
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
            You’re on the list — we’ll email your invite.
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className={cn(
                "h-12 flex-1 rounded-lg border px-4 text-[15px] outline-none transition-colors focus:border-rust",
                field
              )}
            />
            <ShimmerButton type="submit" disabled={status === "submitting"} className="h-12 shrink-0 rounded-lg bg-ink text-paper">
              {status === "submitting" ? "Joining…" : "Join the waitlist"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ShimmerButton>
          </motion.form>
        )}
      </AnimatePresence>
      <p className={cn("mt-2.5 text-[13px]", dark ? "text-white/55" : "text-ink-faint")}>
        {status === "error" ? (
          <span className="text-rust">Enter a valid email — we’ll only use it for your invite.</span>
        ) : (
          "Free · iOS first · no feed, ever."
        )}
      </p>
    </div>
  );
}
