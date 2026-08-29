/**
 * Horizon marketing-site design tokens, ported verbatim from the design handoff
 * (`design_handoff_horizon_site/tokens.js`). Values are final / high-fidelity.
 */

export const color = {
  // light surfaces
  paper: "#FBF8F3", // page background, phone screen background
  paperWarm: "#FCFAF4", // polaroid card stock
  paperMap: "#EFEBE2", // map background inside phone screens
  white: "#FFFFFF", // cards inside phone screens

  // ink
  ink: "#211D18", // primary text, dark buttons
  inkBody: "#4A4338", // body copy
  inkMuted: "#6E6659", // nav links, secondary copy
  inkFaint: "#8A8073", // meta, captions, footer
  inkHand: "#8A6B4A", // handwritten aside (hero)

  // brand
  peach: "#FFB693", // primary — CTA fill, eyebrow labels, pins, edges
  rust: "#A0552A", // peach's readable-on-light counterpart
  green: "#4A7A5C", // "COMPLETED" state only

  // dark section
  darkBg: "rgb(17,13,10)",
  darkGround: "#070605",
  darkPhone: "#0B0907",
  darkOnLight: "#F7F1EA",
  darkBody: "rgba(247,241,234,.66)",
} as const;

export const font = {
  display: "'Hanken Grotesk', system-ui, -apple-system, sans-serif", // crisp humanist sans — headlines, labels
  condensed: "'Hanken Grotesk', system-ui, -apple-system, sans-serif", // CTA display
  body: "'Hanken Grotesk', system-ui, -apple-system, sans-serif", // body copy
  hand: "'Caveat', cursive", // asides only, never body copy
} as const;

export const layout = {
  pageMax: 1320,
  gutter: "clamp(20px, 5vw, 48px)",
  heroGap: "clamp(40px, 8vw, 130px)",
  breakpointNarrow: 960,
  breakpointTiny: 560,
} as const;

export const motion = {
  scrollPerStepVh: 105, // × 5 beats + 90vh = pinned section height
  smoothing: 0.14,
  hoverTransition: "transform .25s ease",
} as const;
