"use client";

import { useEffect, useRef } from "react";
import { applyWorldTokens } from "@/lib/world/ink";

const SKIES = ["morning", "afternoon", "evening", "night"] as const;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function band(progress: number, start: number, peakFrom: number, peakTo: number, end: number) {
  if (progress <= start || progress >= end) return 0;
  if (progress >= peakFrom && progress <= peakTo) return 1;
  if (progress < peakFrom) return smoothstep(start, peakFrom, progress);
  return 1 - smoothstep(peakTo, end, progress);
}

function skyWeights(progress: number) {
  const morning = band(progress, -0.06, 0, 0.08, 0.24);
  const afternoon = band(progress, 0.1, 0.22, 0.38, 0.54);
  const evening = band(progress, 0.4, 0.52, 0.66, 0.82);
  const night = band(progress, 0.68, 0.82, 1.06, 1.22);
  const total = morning + afternoon + evening + night || 1;
  return {
    morning: morning / total,
    afternoon: afternoon / total,
    evening: evening / total,
    night: night / total,
  };
}

function periodProgress(hour: number) {
  if (hour < 5) return 1;
  if (hour < 11) return 0.06;
  if (hour < 17) return 0.32;
  if (hour < 21) return 0.62;
  return 0.92;
}

export function AmbientLandscape() {
  return <TimeLandscape />;
}

export function TimeLandscape() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    document.documentElement.classList.remove("still-entering");
    const stored = Number(sessionStorage.getItem("still-world-day"));
    const progress = Number.isFinite(stored) ? stored : periodProgress(new Date().getHours());
    if (Number.isFinite(stored)) sessionStorage.removeItem("still-world-day");
    const next = skyWeights(progress);
    SKIES.forEach((name) => {
      const layer = node.querySelector<HTMLElement>(`[data-sky="${name}"]`);
      if (layer) layer.style.opacity = next[name].toFixed(3);
    });
    const day = next.afternoon * 0.34 + next.evening * 0.68 + next.night;
    node.style.setProperty("--day", day.toFixed(4));
    applyWorldTokens(progress);
  }, []);

  return (
    <div ref={root} className="still-bg still-sky-stack" aria-hidden="true">
      {SKIES.map((name, index) => (
        <div key={name} data-sky={name} className="still-sky" style={{ opacity: index === 0 ? 1 : 0 }}>
          <picture>
            <source srcSet={`/still-sky-${name}.webp`} type="image/webp" />
            <img src={`/still-sky-${name}.jpg`} alt="" />
          </picture>
        </div>
      ))}
      <div className="still-bg-veil" />
    </div>
  );
}

function storyProgress() {
  const raw = document.documentElement.style.getPropertyValue("--story").trim();
  const story = Number(raw);
  if (raw !== "" && Number.isFinite(story)) return Math.min(1, Math.max(0, story));
  const marks = [...document.querySelectorAll<HTMLElement>("[data-day]")];
  if (marks.length >= 2) {
    const line = window.innerHeight * 0.42;
    let index = 0;
    for (let i = 0; i < marks.length - 1; i += 1) {
      if (marks[i].getBoundingClientRect().top <= line) index = i;
    }
    const from = marks[index];
    const to = marks[Math.min(index + 1, marks.length - 1)];
    const start = from.getBoundingClientRect().top;
    const end = to.getBoundingClientRect().top;
    const mix = end === start ? 1 : (line - start) / (end - start);
    const a = Number(from.dataset.day);
    const b = Number(to.dataset.day);
    return Math.min(1, Math.max(0, a + (b - a) * Math.min(1, Math.max(0, mix))));
  }
  const experience = document.querySelector<HTMLElement>(".still-experience, .still-living");
  if (experience) {
    const max = Math.max(1, experience.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, -experience.getBoundingClientRect().top / max));
  }
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / max));
}

export function InteractiveLandscape() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const layers = SKIES.map((name) => node.querySelector<HTMLElement>(`[data-sky="${name}"]`));

    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let running = true;

    const paint = () => {
      const next = skyWeights(storyProgress());
      layers.forEach((layer, index) => {
        if (!layer) return;
        layer.style.opacity = next[SKIES[index]].toFixed(3);
      });
      node.style.setProperty(
        "--day",
        (next.afternoon * 0.34 + next.evening * 0.68 + next.night).toFixed(4),
      );
      if (!coarse && !reduce) {
        tx += (mx - tx) * 0.05;
        ty += (my - ty) * 0.05;
        node.style.setProperty("--px", tx.toFixed(4));
        node.style.setProperty("--py", ty.toFixed(4));
        document.documentElement.style.setProperty("--px", tx.toFixed(4));
        document.documentElement.style.setProperty("--py", ty.toFixed(4));
      } else {
        node.style.setProperty("--px", "0");
        node.style.setProperty("--py", "0");
      }
    };

    const tick = () => {
      if (!running) return;
      paint();
      raf = window.requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      mx = event.clientX / window.innerWidth - 0.5;
      my = event.clientY / window.innerHeight - 0.5;
    };

    if (!reduce && !coarse) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("wheel", paint, { passive: true });
    window.addEventListener("touchmove", paint, { passive: true });
    window.addEventListener("still-scroll", paint);
    paint();
    raf = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", paint);
      window.removeEventListener("wheel", paint);
      window.removeEventListener("touchmove", paint);
      window.removeEventListener("still-scroll", paint);
    };
  }, []);

  return (
    <div ref={root} className="still-world" aria-hidden="true">
      <div data-layer-scroll="" className="still-sky-stack">
        {SKIES.map((name, index) => (
          <div key={name} data-sky={name} className="still-sky">
            <picture>
              <source srcSet={`/still-sky-${name}.webp`} type="image/webp" />
              <img
                src={`/still-sky-${name}.jpg`}
                alt=""
                fetchPriority={index === 0 ? "high" : "low"}
              />
            </picture>
          </div>
        ))}
      </div>
      <div className="still-layer still-layer-mist" />
      <div className="still-layer still-layer-near" />
      <div className="still-stars" />
      <div className="still-day-veil" />
      <div className="still-bg-veil" />
    </div>
  );
}

export function Landscape({ className }: { className?: string }) {
  return (
    <div className={className}>
      <AmbientLandscape />
    </div>
  );
}
