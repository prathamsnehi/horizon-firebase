import { cn } from "../lib/cn";

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-foreground">
        <span className="absolute bottom-1.5 h-4 w-4 rounded-full bg-primary" />
        <span className="absolute bottom-[7px] h-[2.5px] w-6 rounded-full bg-background" />
      </span>
      {withText && (
        <span className="text-title3 font-bold tracking-tight text-foreground">
          Horizon
        </span>
      )}
    </span>
  );
}
