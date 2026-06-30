import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";

/** Ticks elapsed milliseconds from when the component mounts. */
function useElapsed() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, []);
  return ms;
}

/** Full-bleed "curating" state shown while a batch is generated. */
export function CuratingState({
  message = "Curating sidequests just for you…",
  showTimer = true,
}: {
  message?: string;
  showTimer?: boolean;
}) {
  const elapsed = useElapsed();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <Compass className="h-8 w-8" />
        </motion.div>
      </div>
      <div>
        <p className="text-title3 font-semibold text-foreground">{message}</p>
        <p className="mt-2 text-muted-foreground">
          Scouting real places and writing quests around them.
        </p>
        {showTimer && (
          <p className="mt-4 font-mono text-footnote tabular-nums text-muted-foreground/70">
            {(elapsed / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}
