import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Roles, driven by the validated custom properties in src/index.css.
        page: "rgb(var(--page) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        grid: "rgb(var(--grid) / <alpha-value>)",
        axis: "rgb(var(--axis) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        dim: "rgb(var(--dim) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",

        // Categorical series slots (identity).
        s1: "rgb(var(--s1) / <alpha-value>)",
        s2: "rgb(var(--s2) / <alpha-value>)",
        s3: "rgb(var(--s3) / <alpha-value>)",
        s4: "rgb(var(--s4) / <alpha-value>)",
        s5: "rgb(var(--s5) / <alpha-value>)",
        s6: "rgb(var(--s6) / <alpha-value>)",
        s7: "rgb(var(--s7) / <alpha-value>)",
        s8: "rgb(var(--s8) / <alpha-value>)",

        // Status (state) — never used as a series color.
        good: "rgb(var(--good) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        critical: "rgb(var(--critical) / <alpha-value>)",
        serious: "rgb(var(--serious) / <alpha-value>)",

        // Ordinal ramp for the two quantiles of one measure.
        q50: "rgb(var(--q50) / <alpha-value>)",
        q95: "rgb(var(--q95) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem" }],
        tiny: ["0.75rem", { lineHeight: "1.125rem" }],
      },
      borderRadius: {
        // 4px rounded data-ends on bars, per the mark spec.
        mark: "4px",
      },
    },
  },
  plugins: [],
} satisfies Config;
