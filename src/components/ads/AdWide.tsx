"use client";

import { useEffect, useRef, useState } from "react";
import { AdLink } from "@/components/ads/AdLink";
import { AdMedia } from "@/components/ads/AdMedia";
import { recordAdView } from "@/components/ads/record-ad-view";
import { adImageSrc, adSlideSrc, type PublicAd } from "@/lib/ads";

const storageKey = (id: string) => `tribanda-ad-wide:${id}`;
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;

function bannerSources(ad: PublicAd) {
  const extra = ad.slides.map((slide) => adSlideSrc(ad.id, slide.id, slide.createdAt));
  if (ad.hasImage) return [adImageSrc(ad.id, ad.updatedAt), ...extra];
  return extra;
}

export function AdWide({ ad }: { ad: PublicAd }) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const ignoreClick = useRef(false);
  const touchX = useRef<number | null>(null);
  const sources = ad.provider === "CUSTOM" ? bannerSources(ad) : [];
  const many = sources.length > 1;
  const current = sources[index] ?? sources[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(ad.id));
      if (raw && Date.now() - Number(raw) < HIDE_MS) return;
    } catch {
      /* ignore */
    }
    setVisible(true);
    recordAdView(ad.id);
  }, [ad.id]);

  useEffect(() => {
    if (!visible || !many) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % sources.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [visible, many, sources.length]);

  function close() {
    try {
      localStorage.setItem(storageKey(ad.id), String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  function step(delta: number) {
    setIndex((value) => (value + delta + sources.length) % sources.length);
  }

  if (!visible) return null;

  const frame =
    ad.provider === "CUSTOM" && current ? (
      <img src={current} alt={ad.title} className="max-h-28 w-full object-contain sm:max-h-36" />
    ) : ad.provider !== "CUSTOM" ? (
      <AdMedia ad={ad} variant="wide" />
    ) : (
      <p className="px-4 text-center text-sm font-semibold">{ad.title}</p>
    );

  const framed = (
    <div className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-line bg-paper sm:h-36">
      {frame}
    </div>
  );

  return (
    <aside
      className="relative mb-4"
      onTouchStart={(event) => {
        touchX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchX.current == null || !many) return;
        const next = event.changedTouches[0]?.clientX;
        if (next == null) return;
        const delta = next - touchX.current;
        touchX.current = null;
        if (Math.abs(delta) < 40) return;
        ignoreClick.current = true;
        step(delta > 0 ? -1 : 1);
      }}
    >
      {ad.href && ad.provider === "CUSTOM" ? (
        <AdLink
          href={ad.href}
          className="block"
          onClick={(event) => {
            if (!ignoreClick.current) return;
            event.preventDefault();
            ignoreClick.current = false;
          }}
        >
          {framed}
        </AdLink>
      ) : (
        framed
      )}
      {many ? (
        <>
          <button
            type="button"
            className="absolute top-1/2 left-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-navy/75 text-2xl leading-none text-cream"
            aria-label="Imagen anterior"
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="absolute top-1/2 right-12 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-navy/75 text-2xl leading-none text-cream"
            aria-label="Imagen siguiente"
            onClick={() => step(1)}
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {sources.map((src, dot) => (
              <button
                key={src}
                type="button"
                aria-label={`Imagen ${dot + 1} de ${sources.length}`}
                className={`h-2 w-2 rounded-full ${dot === index ? "bg-gold" : "bg-cream/50"}`}
                onClick={() => setIndex(dot)}
              />
            ))}
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={close}
        className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-navy/75 text-xl leading-none text-cream"
        aria-label="Cerrar publicidad"
      >
        ×
      </button>
    </aside>
  );
}
