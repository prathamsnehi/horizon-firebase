/**
 * Horizon scroll-story math, ported from the design handoff
 * (`design_handoff_horizon_site/scroll-story.js` + the prototype's `renderVals`).
 *
 * Framework-agnostic and DOM-light on purpose: feed `storyFrame` a single scalar
 * `p` (0..1 progress through the pinned section) plus the viewport, and it returns
 * every animated value the section needs, as ready-to-drop CSS strings/numbers.
 * `scrollProgressLoop` produces `p` from a ref via rAF (deliberately NOT a scroll
 * listener — the per-frame lerp toward the target is what gives the motion weight).
 */

/* ── beat windows ─────────────────────────────────────────────────────────
 * Five beats across the pinned section, as [start, end] positions in `p`.
 * Beat 3 (index 2, the pin drop) is deliberately shorter than its neighbours. */
export const BEATS: ReadonlyArray<readonly [number, number]> = [
  [0.1, 0.29], // 0 — 01 NAME IT
  [0.29, 0.46], // 1 — 02 ONE QUEST BACK
  [0.46, 0.61], // 2 — THE PIN DROPS (map beat)
  [0.61, 0.79], // 3 — 03 GO (walk / arrive)
  [0.79, 0.94], // 4 — 04 KEEP IT (log)
];

/* ── primitives ───────────────────────────────────────────────────────── */
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const ramp = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t); // smoothstep
export const mixRgb = (c1: number[], c2: number[], t: number) =>
  `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;

/** progress within one beat: 0 before, 0..1 inside, 1 after */
export const local = (i: number, p: number) => {
  const [a, b] = BEATS[i];
  return clamp((p - a) / (b - a), 0, 1);
};

/** The fear text that types itself into phone screen 1. */
const FEAR_TEXT = "eating dinner on my own where people can see me";

/* Lane tables. Phone holds right for beats 1–2, crosses left for the map beat and
 * the walk, then returns right for the log. Copy is always opposite. */
export const PHONE_LANES = [0.68, 0.68, 0.32, 0.32, 0.68];
export const COPY_LANES = [0.27, 0.27, 0.72, 0.72, 0.28];

/** Copy block slide — in/out ramps live entirely inside the beat's own window so
 *  two blocks are never visible at once. */
function slide(i: number, p: number, dist = 80) {
  const [a, b] = BEATS[i];
  const w = (b - a) * 0.26;
  const inT = smooth(ramp(p, a, a + w));
  const outT = smooth(ramp(p, b - w, b));
  const o = inT * (1 - outT);
  return {
    o: Number(o.toFixed(3)),
    x: `${Math.round(lerp(dist, 0, inT) + lerp(0, -dist, outT))}px`,
    pe: o > 0.5 ? "auto" : "none",
  };
}

/** Phone screen cross-fade — slightly wider than `slide` so the screen leads its copy. */
function screenFade(i: number, p: number) {
  const [a, b] = BEATS[i];
  const o = ramp(p, a - 0.035, a + 0.02) * (1 - ramp(p, b - 0.02, b + 0.035));
  return { o: Number(o.toFixed(3)), y: o > 0.02 ? "0px" : "14px" };
}

/** Eases between per-beat horizontal lanes so the device travels rather than teleports. */
function lane(p: number, targets: number[]) {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (p >= BEATS[k][0]) i = k;
  const [a, b] = BEATS[i];
  const next = Math.min(BEATS.length - 1, i + 1);
  return lerp(targets[i], targets[next], smooth(ramp(p, b - (b - a) * 0.62, b)));
}

/* ── the 3D city ground plane ─────────────────────────────────────────────
 * A stylised SF: dense Financial District grid receding into distance, plus lower
 * SoMa blocks nearer the camera rotated -9deg off Market Street. Deterministic, so
 * the skyline never reshuffles between renders. `py` is depth: SMALL py = FAR. */
export interface CityBlock {
  xp: number;
  py: number;
  w: number;
  h: number;
  rise: number;
  rot: number;
}

let _blocks: CityBlock[] | null = null;
export function cityBlocks(): CityBlock[] {
  if (_blocks) return _blocks;
  const out: CityBlock[] = [];
  const rnd = (s: number) => {
    const x = Math.sin(s * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  let n = 0;
  // Financial District — 13 × 6, towers concentrated in the core.
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 13; c++) {
      n++;
      const core = 1 - (Math.abs(c - 6) / 7) * 0.6 - Math.abs(r - 3) / 8;
      out.push({
        xp: -26 + c * 11.5,
        py: 210 + r * 108,
        w: 88 + Math.round(rnd(n + 40) * 16),
        h: 56,
        rise: Math.round(90 + core * 460 + rnd(n) * 70),
        rot: 0,
      });
    }
  }
  // SoMa — bigger, lower, rotated off Market Street.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      n++;
      out.push({ xp: -24 + c * 15, py: 900 + r * 200, w: 150, h: 110, rise: Math.round(70 + rnd(n) * 130), rot: -9 });
    }
  }
  _blocks = out;
  return out;
}

export interface BlockStyle {
  x: string;
  y: string;
  w: string;
  h: string;
  rise: string;
  rot: string;
  face: string;
  side: string;
  edge: string;
}

export interface MapPin {
  x: string;
  y: string;
  s: string;
  a: number;
}

export interface CopyMotion {
  o: number;
  x: string;
  pe: string;
}
export interface ScreenMotion {
  o: number;
  y: string;
}

export interface StoryFrame {
  narrow: boolean;
  tiny: boolean;

  // section shell
  scrollHeight: string;
  bgColor: string;
  stickyMinH: string;
  navLinks: string;
  h2Size: string;
  pSize: string;
  asideShow: string;
  railShow: string;
  chromeOpacity: number;

  // ground
  groundTop: string;
  mapOpacity: number;
  panX: string;
  blocks: BlockStyle[];
  mapPins: MapPin[];

  // pin drop (world)
  dropX: string;
  dropY: string;
  dropOpacity: number;
  dropSize: string;
  ringSize: string;
  ringAlpha: string;

  // copy
  copyLeft: string;
  copyTop: string;
  copyW: string;
  copyBoxH: string;
  copy: CopyMotion[];

  // phone
  phoneLeft: string;
  phoneTop: string;
  phoneBoxW: string;
  phoneBoxH: string;
  phoneScale: number;
  tiltY: string;
  tiltX: string;
  shadowX: string;
  glowSize: string;
  glowX: string;

  // screens
  screens: ScreenMotion[];
  typed: string;
  pinInPhone: number;
  routePct: string;
  walkerX: string;
  remaining: string;
  arrivalNote: string;
  arrivalDot: string;
  logRows: number[];

  // vignette + rail
  vigSize: string;
  vigInner: string;
  vigAlpha: string;
  ticks: { color: string; h: string }[];
}

export interface StoryOpts {
  scrollPerStep?: number; // vh per beat; 70–170, default 105
}

/** One fully-computed frame of the pinned section. Ported from the prototype's
 *  `renderVals`, minus the DOM ref. */
export function storyFrame(p: number, vp: { w: number; h: number }, opts: StoryOpts = {}): StoryFrame {
  const { w, h } = vp;
  const narrow = w < 960;
  const tiny = w < 560;

  // dark dip in, light bloom out
  const LIGHT = [251, 248, 243];
  const DARK = [17, 13, 10];
  const dip = ramp(p, 0.0, 0.075);
  const bloom = ramp(p, 0.965, 1.0);
  const darkness = dip * (1 - bloom);

  // phone scale: fits the viewport, eases up on entry, settles back on exit
  const entry = ramp(p, 0.04, 0.2);
  const base = narrow ? (tiny ? 0.6 : 0.72) : Math.min(1.06, (h - 60) / 660);
  const fit = narrow
    ? Math.max(0.4, Math.min(base, (Math.max(520, Math.min(h, 780)) - (tiny ? 208 : 192) - 50) / 660))
    : base;
  const phoneScale = Number((fit * lerp(0.86, 1, entry) * lerp(1, 0.94, bloom)).toFixed(3));
  const tiltSpan = lerp(-9, 9, clamp((p - 0.1) / 0.84, 0, 1));

  // map layer parallax + map-beat swell
  const mapBeat = local(2, p);
  const mapPresence = lerp(0.5, 1, ramp(p, 0.4, 0.52)) * (1 - bloom * 0.8);

  // pin drop
  const dropT = ramp(mapBeat, 0.1, 0.62);
  const ringT = ramp(mapBeat, 0.5, 1);

  // walk beat
  const wEase = ramp(local(3, p), 0.1, 0.86);
  const arrived = wEase > 0.95;

  // log beat
  const logT = ramp(local(4, p), 0.05, 0.8);

  const phoneLane = lane(p, PHONE_LANES);
  const copyLane = lane(p, COPY_LANES);

  const tickOn = (i: number) => p >= BEATS[i][0] - 0.03 && p < BEATS[i][1] + 0.03;
  const tickColor = (i: number) =>
    tickOn(i) ? "#FFB693" : p > BEATS[i][1] ? "rgba(255,182,147,.45)" : "rgba(247,241,234,.22)";

  const type1 = ramp(local(0, p), 0.06, 0.8);

  return {
    narrow,
    tiny,

    scrollHeight: `${(opts.scrollPerStep ?? 105) * 5 + 90}vh`,
    bgColor: mixRgb(LIGHT, DARK, darkness),
    stickyMinH: narrow ? `${Math.round(Math.max(520, Math.min(h, 780)))}px` : "700px",
    navLinks: tiny ? "none" : "inline",
    h2Size: narrow ? "clamp(26px,5.4vw,34px)" : "clamp(34px,3.6vw,50px)",
    pSize: narrow ? "14.5px" : "clamp(15px,1.5vw,17.5px)",
    asideShow: narrow ? "none" : "block",
    railShow: tiny ? "none" : "flex",
    chromeOpacity: Number(darkness.toFixed(3)),

    groundTop: narrow ? "58%" : "50%",
    mapOpacity: Number(clamp(mapPresence * lerp(0.9, 1, mapBeat), 0, 1).toFixed(3)),
    panX: `${Math.round(lerp(90, -300, p))}px`,
    blocks: cityBlocks().map((b) => {
      const dim = clamp(0.4 + b.py / 1500, 0.4, 1);
      return {
        x: `${b.xp.toFixed(1)}%`,
        y: `${b.py}px`,
        w: `${b.w}px`,
        h: `${b.h}px`,
        rise: `${b.rise}px`,
        rot: `${b.rot}deg`,
        face: `rgb(${Math.round(46 + 26 * dim)},${Math.round(38 + 20 * dim)},${Math.round(33 + 16 * dim)})`,
        side: `rgb(${Math.round(19 + 9 * dim)},${Math.round(15 + 7 * dim)},${Math.round(13 + 6 * dim)})`,
        edge: `rgba(255,182,147,${(0.34 + 0.34 * dim).toFixed(2)})`,
      };
    }),
    mapPins: [
      { x: "24%", y: "620px", s: "15px", a: 0.5 },
      { x: "62%", y: "420px", s: "12px", a: 0.36 },
      { x: "78%", y: "900px", s: "17px", a: 0.3 },
    ],

    dropX: narrow ? "50%" : `${(copyLane * 100).toFixed(2)}%`,
    dropY: narrow ? "24%" : "46%",
    dropOpacity: Number((dropT * (1 - ramp(mapBeat, 0.9, 1))).toFixed(3)),
    dropSize: `${Math.round(lerp(10, 34, dropT))}px`,
    ringSize: `${Math.round(lerp(40, 320, ringT))}px`,
    ringAlpha: (0.4 * (1 - ringT)).toFixed(2),

    copyLeft: narrow ? "50%" : `${(copyLane * 100).toFixed(2)}%`,
    copyTop: narrow ? "80%" : "50%",
    copyW: narrow ? "calc(100% - 40px)" : "min(500px,40vw)",
    copyBoxH: narrow ? (tiny ? "196px" : "184px") : "340px",
    copy: [0, 1, 2, 3, 4].map((i) => slide(i, p)),

    phoneLeft: narrow ? "50%" : `${(phoneLane * 100).toFixed(2)}%`,
    phoneTop: narrow ? "31%" : "43%",
    phoneBoxW: `${Math.round(320 * fit)}px`,
    phoneBoxH: `${Math.round(660 * fit)}px`,
    phoneScale,
    tiltY: `${(lerp(-6, 6, phoneLane) * -1).toFixed(2)}deg`,
    tiltX: `${lerp(3.5, -2.5, clamp((p - 0.1) / 0.84, 0, 1)).toFixed(2)}deg`,
    shadowX: `${Math.round(tiltSpan * -1.6)}px`,
    glowSize: `${Math.round(lerp(360, 560, entry) * (narrow ? 0.8 : 1))}px`,
    glowX: `${Math.round(tiltSpan * 2.4)}px`,

    screens: [0, 1, 2, 3, 4].map((i) => screenFade(i, p)),
    typed: FEAR_TEXT.slice(0, Math.round(type1 * FEAR_TEXT.length)),
    pinInPhone: Number(ramp(mapBeat, 0.25, 0.7).toFixed(3)),
    routePct: `${Math.round(wEase * 100)}%`,
    walkerX: `calc(26px + ${(wEase * 100).toFixed(1)}% - ${(wEase * 52).toFixed(1)}px)`,
    remaining: arrived ? "Arrived" : `${(0.4 * (1 - wEase)).toFixed(1)} mi to go`,
    arrivalNote: arrived ? "You are here. The app stops talking." : "Horizon will know when you arrive.",
    arrivalDot: arrived ? "#4A7A5C" : "rgba(33,29,24,.12)",
    logRows: [0, 0.8, 1.6, 2.4].map((off) => Number(clamp(logT * 4 - off, 0, 1).toFixed(2))),

    vigSize: `${Math.round(lerp(90, 200, darkness))}px`,
    vigInner: `${Math.round(lerp(0, 40, darkness))}px`,
    vigAlpha: (0.72 * darkness).toFixed(2),
    ticks: [0, 1, 2, 3, 4].map((i) => ({ color: tickColor(i), h: tickOn(i) ? "38px" : "16px" })),
  };
}

/* ── scroll progress loop ───────────────────────────────────────────────────
 * Reads getBoundingClientRect() every frame and lerps toward the target — the
 * slight lag is the "weight" the design asks for. Do NOT swap for a scroll event
 * listener. Reports viewport size in the same loop so a single rAF drives it all. */
export const SMOOTHING = 0.14;

export function scrollProgressLoop(
  el: HTMLElement,
  onChange: (state: { p: number; w: number; h: number }) => void,
  { smoothing = SMOOTHING }: { smoothing?: number } = {}
): () => void {
  let sp: number | null = null;
  let raf = 0;
  let lastP = -1;
  let lastW = -1;
  let lastH = -1;
  const tick = () => {
    const r = el.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const target = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    if (sp === null) sp = target;
    sp += (target - sp) * smoothing;
    if (Math.abs(target - sp) < 0.0004) sp = target;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (Math.abs(sp - lastP) > 0.0006 || w !== lastW || h !== lastH) {
      lastP = sp;
      lastW = w;
      lastH = h;
      onChange({ p: sp, w, h });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
