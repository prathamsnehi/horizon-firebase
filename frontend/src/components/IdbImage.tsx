import { usePhotoUrl } from "../lib/usePhotoUrl";
import { cn } from "../lib/cn";

/** Renders a completion photo stored in IndexedDB by its id. */
export function IdbImage({
  id,
  alt = "",
  className,
}: {
  id: string;
  alt?: string;
  className?: string;
}) {
  const url = usePhotoUrl(id);
  if (!url) {
    return <div className={cn("skeleton h-full w-full", className)} />;
  }
  return (
    <img src={url} alt={alt} className={cn("h-full w-full object-cover", className)} />
  );
}
