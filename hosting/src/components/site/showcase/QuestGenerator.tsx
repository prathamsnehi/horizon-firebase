import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, Shuffle, Check, MapPin, Navigation, Clock } from "lucide-react";
import { color, font } from "@/lib/tokens";
import { QUESTS, PLACE_TICKER, type DemoQuest } from "./quests";

type Phase = "idle" | "gen" | "done";

const GEN_STEPS = ["Reading what you keep going around…", "Scanning places around the world…", "Checking it's open tonight…"];

function pickQuest(prev: DemoQuest | null): DemoQuest {
  if (QUESTS.length === 1) return QUESTS[0];
  let q = QUESTS[Math.floor(Math.random() * QUESTS.length)];
  while (q === prev) q = QUESTS[Math.floor(Math.random() * QUESTS.length)];
  return q;
}

export function QuestGenerator() {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("idle");
  const [quest, setQuest] = useState<DemoQuest | null>(null);
  const [step, setStep] = useState(0);
  const [ticker, setTicker] = useState(PLACE_TICKER[0]);
  const [typed, setTyped] = useState("");
  const [accepted, setAccepted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const generate = () => {
    clearTimers();
    const q = pickQuest(quest);
    setQuest(q);
    setAccepted(false);
    setStep(0);
    setPhase("gen");
    if (reduce) {
      timers.current.push(setTimeout(() => setPhase("done"), 450));
      return;
    }
    timers.current.push(setTimeout(() => setStep(1), 750));
    timers.current.push(setTimeout(() => setStep(2), 1650));
    timers.current.push(setTimeout(() => setPhase("done"), 2500));
  };

  // slot-machine ticker while "scanning places"
  useEffect(() => {
    if (phase !== "gen" || step !== 1 || reduce) return;
    const id = setInterval(() => setTicker(PLACE_TICKER[Math.floor(Math.random() * PLACE_TICKER.length)]), 90);
    return () => clearInterval(id);
  }, [phase, step, reduce]);

  // type the task out on reveal
  useEffect(() => {
    if (phase !== "done" || !quest) {
      setTyped("");
      return;
    }
    if (reduce) {
      setTyped(quest.task);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(quest.task.slice(0, i));
      if (i >= quest.task.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [phase, quest, reduce]);

  return (
    <div style={{ width: 380, maxWidth: "100%", margin: "0 auto" }}>
      {/* The card — fixed min-height so generate→reveal doesn't shift the layout */}
      <div
        style={{
          position: "relative",
          minHeight: 452,
          background: color.paperWarm,
          border: "1px solid rgba(33,29,24,.1)",
          borderRadius: 22,
          boxShadow: "0 34px 64px -34px rgba(33,29,24,.45), 0 4px 12px -8px rgba(33,29,24,.22)",
          padding: "28px 26px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", minHeight: 396 }}>
              <span style={{ width: 40, height: 20, background: color.peach, borderRadius: "40px 40px 0 0", display: "block", marginBottom: 22 }} />
              <div style={{ fontFamily: font.display, fontSize: 24, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.12, color: color.ink, marginBottom: 12 }}>
                One small quest, somewhere in the world.
              </div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: color.inkBody }}>
                Press the button and watch Horizon find you one — a real kind of place, a thing worth doing tonight.
              </p>
            </motion.div>
          )}

          {phase === "gen" && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ minHeight: 396, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
              <div style={{ fontFamily: font.display, fontSize: 11.5, fontWeight: 800, letterSpacing: ".2em", color: color.rust }}>GENERATING</div>
              {GEN_STEPS.map((label, i) => {
                const done = reduce ? false : i < step;
                const active = reduce ? true : i === step;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, opacity: reduce ? 1 : i <= step ? 1 : 0.38, transition: "opacity .3s ease" }}>
                    <span style={{ width: 18, height: 18, flex: "0 0 auto", marginTop: 1, display: "grid", placeItems: "center" }}>
                      {done ? (
                        <Check size={16} strokeWidth={2.6} color={color.green} />
                      ) : (
                        <motion.span
                          style={{ width: 9, height: 9, borderRadius: "50%", background: active ? color.peach : "rgba(33,29,24,.2)" }}
                          animate={active && !reduce ? { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] } : undefined}
                          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </span>
                    <div style={{ fontSize: 14.5, lineHeight: 1.4, color: color.ink }}>
                      {label}
                      {active && i === 1 && !reduce && (
                        <div style={{ marginTop: 7, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, color: color.inkMuted, height: 18, overflow: "hidden" }}>{ticker}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {phase === "done" && quest && (
            <motion.div key="done" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: color.rust, marginBottom: 14 }}>
                You keep going around · {quest.fear}
              </div>
              <div style={{ fontFamily: font.display, fontSize: 25, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.12, color: color.ink, marginBottom: 20, minHeight: 84 }}>
                {typed}
                {!reduce && typed.length < quest.task.length && (
                  <span style={{ display: "inline-block", width: 2, height: 20, background: color.rust, verticalAlign: -3, marginLeft: 2, animation: "hzBlink 1s steps(1) infinite" }} />
                )}
              </div>

              <QuestRow icon={<MapPin size={15} strokeWidth={2.2} color={color.inkFaint} />} label={quest.venue} value={quest.city} />
              <QuestRow icon={<Navigation size={15} strokeWidth={2.2} color={color.inkFaint} />} label="Distance" value={quest.distance} />
              <QuestRow icon={<Clock size={15} strokeWidth={2.2} color={color.inkFaint} />} label="Open until" value={quest.openUntil} />

              <div style={{ fontFamily: font.hand, fontSize: 19, lineHeight: 1.35, color: color.inkHand, marginTop: 18 }}>{quest.note}</div>

              {accepted && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: color.green, fontSize: 13.5, fontWeight: 700 }}
                >
                  <Check size={16} strokeWidth={2.6} /> Pinned to your map — go before midnight.
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {phase === "idle" && (
          <PrimaryButton onClick={generate}>
            <Sparkles size={17} strokeWidth={2.2} /> Generate tonight&apos;s quest
          </PrimaryButton>
        )}

        {phase === "gen" && (
          <PrimaryButton disabled>
            <Sparkles size={17} strokeWidth={2.2} /> Finding your quest…
          </PrimaryButton>
        )}

        {phase === "done" && (
          <>
            {!accepted && (
              <PrimaryButton onClick={() => setAccepted(true)}>
                <Check size={17} strokeWidth={2.4} /> Accept · start walking
              </PrimaryButton>
            )}
            <GhostButton onClick={generate}>
              <Shuffle size={16} strokeWidth={2.2} /> Surprise me again
            </GhostButton>
          </>
        )}
      </div>
    </div>
  );
}

function QuestRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ borderTop: "1px solid rgba(33,29,24,.12)", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, color: color.inkFaint }}>
        {icon}
        {label}
      </span>
      <span style={{ fontWeight: 600, color: color.ink, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        fontFamily: font.display,
        fontSize: 15,
        fontWeight: 700,
        color: color.ink,
        background: color.peach,
        border: "none",
        padding: "13px 22px",
        borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: "0 12px 26px -14px rgba(160,85,42,.7)",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: font.display,
        fontSize: 15,
        fontWeight: 700,
        color: color.ink,
        background: "transparent",
        border: "1px solid rgba(33,29,24,.2)",
        padding: "13px 20px",
        borderRadius: 10,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
