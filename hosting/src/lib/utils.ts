import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class lists, resolving conflicts (shadcn / registry convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
