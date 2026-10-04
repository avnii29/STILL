export type WorldInk = {
  primary: string;
  secondary: string;
  muted: string;
  halo: string;
  accent: string;
  surface: string;
  ctaInk: string;
  ctaPaper: string;
};

const STOPS: Array<{ at: number; ink: WorldInk }> = [
  {
    at: 0,
    ink: {
      primary: "#1a1814",
      secondary: "#3f3a33",
      muted: "#5a534a",
      halo: "rgba(243, 238, 230, 0.62)",
      accent: "#2a4f54",
      surface: "rgba(243, 238, 230, 0.22)",
      ctaInk: "#f7f3ea",
      ctaPaper: "#1a1814",
    },
  },
  {
    at: 0.34,
    ink: {
      primary: "#221e18",
      secondary: "#4a4338",
      muted: "#6a5f52",
      halo: "rgba(246, 236, 214, 0.5)",
      accent: "#3d5a4a",
      surface: "rgba(246, 236, 214, 0.18)",
      ctaInk: "#f7f3ea",
      ctaPaper: "#221e18",
    },
  },
  {
    at: 0.58,
    ink: {
      primary: "#2a1c14",
      secondary: "#5c4032",
      muted: "#7a5644",
      halo: "rgba(248, 226, 196, 0.42)",
      accent: "#8a4b3a",
      surface: "rgba(248, 226, 196, 0.16)",
      ctaInk: "#f7f1e6",
      ctaPaper: "#2a1c14",
    },
  },
  {
    at: 0.72,
    ink: {
      primary: "#f4ebe0",
      secondary: "#d8c8b4",
      muted: "#c4b29a",
      halo: "rgba(18, 16, 22, 0.42)",
      accent: "#e8d3b0",
      surface: "rgba(20, 16, 24, 0.18)",
      ctaInk: "#1a1814",
      ctaPaper: "#f4ebe0",
    },
  },
  {
    at: 1,
    ink: {
      primary: "#f2eee6",
      secondary: "#c9c4bb",
      muted: "#a8a49c",
      halo: "rgba(8, 10, 18, 0.5)",
      accent: "#d7e0e4",
      surface: "rgba(8, 10, 18, 0.22)",
      ctaInk: "#16141a",
      ctaPaper: "#f2eee6",
    },
  },
];

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ] as const;
}

function mixHex(from: string, to: string, t: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `#${[mix(0), mix(1), mix(2)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function mixRgba(from: string, to: string, t: number) {
  const parse = (value: string) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return [0, 0, 0, 1];
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    const [r = 0, g = 0, b = 0, a = 1] = parts;
    return [r, g, b, a];
  };
  const a = parse(from);
  const b = parse(to);
  const mix = (i: number) => a[i] + (b[i] - a[i]) * t;
  return `rgba(${mix(0).toFixed(1)}, ${mix(1).toFixed(1)}, ${mix(2).toFixed(1)}, ${mix(3).toFixed(3)})`;
}

export function worldInkForDay(day: number): WorldInk {
  const progress = Math.min(1, Math.max(0, day));
  let index = 0;
  while (index < STOPS.length - 1 && STOPS[index + 1].at <= progress) index += 1;
  const from = STOPS[index];
  const to = STOPS[Math.min(index + 1, STOPS.length - 1)];
  const span = to.at - from.at || 1;
  const t = Math.min(1, Math.max(0, (progress - from.at) / span));
  return {
    primary: mixHex(from.ink.primary, to.ink.primary, t),
    secondary: mixHex(from.ink.secondary, to.ink.secondary, t),
    muted: mixHex(from.ink.muted, to.ink.muted, t),
    halo: mixRgba(from.ink.halo, to.ink.halo, t),
    accent: mixHex(from.ink.accent, to.ink.accent, t),
    surface: mixRgba(from.ink.surface, to.ink.surface, t),
    ctaInk: mixHex(from.ink.ctaInk, to.ink.ctaInk, t),
    ctaPaper: mixHex(from.ink.ctaPaper, to.ink.ctaPaper, t),
  };
}

export function storyToDay(story: number) {
  return Math.min(1, Math.max(0, story));
}

export function windowIn(progress: number, start: number, peak: number, end: number) {
  if (progress <= start || progress >= end) return 0;
  if (progress < peak) return (progress - start) / (peak - start || 1);
  return 1 - (progress - peak) / (end - peak || 1);
}

export function holdIn(progress: number, start: number, holdFrom: number, holdTo: number, end: number) {
  if (progress <= start || progress >= end) return 0;
  if (progress < holdFrom) return (progress - start) / (holdFrom - start || 1);
  if (progress <= holdTo) return 1;
  return 1 - (progress - holdTo) / (end - holdTo || 1);
}

export function applyWorldTokens(day: number, target: HTMLElement | CSSStyleDeclaration = document.documentElement.style) {
  const ink = worldInkForDay(day);
  const style = target instanceof CSSStyleDeclaration ? target : target.style;
  style.setProperty("--world-text-primary", ink.primary);
  style.setProperty("--world-text-secondary", ink.secondary);
  style.setProperty("--world-text-muted", ink.muted);
  style.setProperty("--world-halo", ink.halo);
  style.setProperty("--world-accent", ink.accent);
  style.setProperty("--world-surface", ink.surface);
  style.setProperty("--world-cta-ink", ink.ctaInk);
  style.setProperty("--world-cta-paper", ink.ctaPaper);
  return ink;
}
