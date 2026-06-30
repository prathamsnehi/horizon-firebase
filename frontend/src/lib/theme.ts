const STORAGE_KEY = "horizon.theme";

export type ThemeMode = "light" | "dark";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getStoredTheme(): ThemeMode | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

/** Resolve and apply the theme on first paint. */
export function initTheme() {
  const mode = getStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
  applyTheme(mode);
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}

export function currentTheme(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
