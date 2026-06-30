import { useState } from "react";
import { Compass } from "lucide-react";
import { cn } from "../lib/cn";
import { placeholderGradient } from "../data/placeholders";

interface HeroVisualProps {
  photoURL?: string;
  placeholderIndex: number;
  alt: string;
  className?: string;
  rounded?: string;
}

/**
 * Renders a location quest's photo, falling back to a warm Igneous Core
 * gradient (the web equivalent of bundled placeholder art) for
 * non-location quests or when an image fails to load.
 */
export function HeroVisual({
  photoURL,
  placeholderIndex,
  alt,
  className,
  rounded,
}: HeroVisualProps) {
  const [failed, setFailed] = useState(false);
  const showImage = photoURL && !failed;

  if (showImage) {
    return (
      <img
        src={photoURL}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", rounded, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center",
        rounded,
        className
      )}
      style={{ backgroundImage: placeholderGradient(placeholderIndex) }}
      aria-label={alt}
      role="img"
    >
      <Compass className="h-10 w-10 text-white/70" strokeWidth={1.5} />
    </div>
  );
}
