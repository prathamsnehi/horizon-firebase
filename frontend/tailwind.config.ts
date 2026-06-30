import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Igneous Core — driven by CSS variables in index.css
        background: "rgb(var(--app-background) / <alpha-value>)",
        surface: "rgb(var(--app-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--app-surface-muted) / <alpha-value>)",
        primary: "rgb(var(--app-primary) / <alpha-value>)",
        "primary-strong": "rgb(var(--app-primary-strong) / <alpha-value>)",
        "primary-foreground": "rgb(var(--app-primary-foreground) / <alpha-value>)",
        foreground: "rgb(var(--app-primary-text) / <alpha-value>)",
        "muted-foreground": "rgb(var(--app-secondary-text) / <alpha-value>)",
        border: "rgb(var(--app-border) / <alpha-value>)",
        // Difficulty palette
        easy: "rgb(var(--c-easy) / <alpha-value>)",
        moderate: "rgb(var(--c-moderate) / <alpha-value>)",
        hard: "rgb(var(--c-hard) / <alpha-value>)",
        extreme: "rgb(var(--c-extreme) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // iOS Dynamic Type -> web scale
        caption: ["0.75rem", { lineHeight: "1rem" }],
        footnote: ["0.8125rem", { lineHeight: "1.125rem" }],
        subheadline: ["0.9375rem", { lineHeight: "1.375rem" }],
        callout: ["1rem", { lineHeight: "1.5rem" }],
        headline: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        title3: ["1.25rem", { lineHeight: "1.6rem" }],
        title2: ["1.375rem", { lineHeight: "1.75rem" }],
        title1: ["1.75rem", { lineHeight: "2.125rem" }],
        largetitle: ["2.25rem", { lineHeight: "2.5rem" }],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)",
        "card-hover": "0 2px 4px rgb(0 0 0 / 0.06), 0 16px 40px rgb(0 0 0 / 0.12)",
        float: "0 12px 48px rgb(0 0 0 / 0.18)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease both",
      },
    },
  },
  plugins: [],
} satisfies Config;
