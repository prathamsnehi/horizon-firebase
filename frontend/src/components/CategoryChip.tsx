import { titleCase } from "../lib/format";

export function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-caption font-medium text-muted-foreground">
      {titleCase(label)}
    </span>
  );
}
