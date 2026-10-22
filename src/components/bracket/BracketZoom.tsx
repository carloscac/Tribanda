"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function BracketZoom({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const pendingScroll = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const normal = Math.abs(zoom - 1) < 0.02;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      const next = { w: content.scrollWidth, h: content.scrollHeight };
      setSize((current) => (current.w === next.w && current.h === next.h ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const left = pendingScroll.current;
    if (!scroller || left == null) return;
    pendingScroll.current = null;
    scroller.scrollLeft = left;
  }, [zoom]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let startDistance = 0;
    let startZoom = 1;

    const distance = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return 0;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const applyZoom = (next: number, clientX: number) => {
      const previous = zoomRef.current;
      const clamped = clampZoom(next);
      if (clamped === previous) return;
      const rect = el.getBoundingClientRect();
      const focal = clientX - rect.left;
      pendingScroll.current = (el.scrollLeft + focal) * (clamped / previous) - focal;
      zoomRef.current = clamped;
      setZoom(clamped);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = distance(event.touches);
      startZoom = zoomRef.current;
    };

    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) return;
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      if (!a || !b) return;
      const midpoint = (a.clientX + b.clientX) / 2;
      applyZoom(startZoom * (distance(event.touches) / startDistance), midpoint);
    };

    const onEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) return;
      startDistance = 0;
      if (Math.abs(zoomRef.current - 1) < 0.05) {
        pendingScroll.current = el.scrollLeft;
        zoomRef.current = 1;
        setZoom(1);
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyZoom(zoomRef.current * Math.exp(-event.deltaY * 0.01), event.clientX);
    };

    const onGestureStart = (event: Event) => {
      event.preventDefault();
      startZoom = zoomRef.current;
    };
    const onGestureChange = (event: Event) => {
      const gesture = event as Event & { scale?: number; clientX?: number };
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(startZoom * (gesture.scale || 1), gesture.clientX ?? rect.left + rect.width / 2);
    };

    const webkitPinch = "ongesturestart" in el;
    el.addEventListener("wheel", onWheel, { passive: false });
    if (webkitPinch) {
      el.addEventListener("gesturestart", onGestureStart);
      el.addEventListener("gesturechange", onGestureChange);
    } else {
      el.addEventListener("touchstart", onStart, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: false });
      el.addEventListener("touchend", onEnd);
      el.addEventListener("touchcancel", onEnd);
    }
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  function reset() {
    pendingScroll.current = 0;
    zoomRef.current = 1;
    setZoom(1);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Pellizca con dos dedos para agrandar o achicar.</p>
        {normal ? null : (
          <button type="button" className="shrink-0 text-xs font-semibold text-gold" onClick={reset}>
            Tamaño normal
          </button>
        )}
      </div>
      <div
        ref={scrollerRef}
        data-bracket-zoom=""
        className={`@container overflow-x-auto pb-3 ${normal ? "snap-x snap-mandatory sm:snap-none" : ""}`}
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div
          className="relative"
          style={{
            width: size.w ? size.w * zoom : undefined,
            height: size.h ? size.h * zoom : undefined,
          }}
        >
          <div
            ref={contentRef}
            className={size.w ? "absolute top-0 left-0" : undefined}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
