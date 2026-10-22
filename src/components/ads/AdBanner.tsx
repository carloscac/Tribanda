"use client";

import { useEffect, useState } from "react";
import { AdLink } from "@/components/ads/AdLink";
import { AdMedia } from "@/components/ads/AdMedia";
import { recordAdView } from "@/components/ads/record-ad-view";
import type { PublicAd } from "@/lib/ads";

const storageKey = (id: string) => `tribanda-ad-banner:${id}`;
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;

export function AdBanner({ ad }: { ad: PublicAd }) {
  const [visible, setVisible] = useState(false);

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

  function close() {
    try {
      localStorage.setItem(storageKey(ad.id), String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const inner = (
    <>
      <AdMedia ad={ad} variant="banner" />
      {ad.provider !== "GOOGLE" ? (
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {ad.provider === "YOUTUBE" ? "YouTube" : "Publicidad"}
          </p>
          <p className="truncate text-sm font-semibold">{ad.title}</p>
          {ad.body ? <p className="line-clamp-2 text-xs text-muted">{ad.body}</p> : null}
        </div>
      ) : null}
    </>
  );

  return (
    <aside className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-paper px-3 py-2.5">
      {ad.href && ad.provider === "CUSTOM" ? (
        <AdLink href={ad.href} className="flex min-w-0 flex-1 items-center gap-3 text-ink">
          {inner}
        </AdLink>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      <button
        type="button"
        onClick={close}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-muted hover:bg-cream"
        aria-label="Cerrar publicidad"
      >
        ×
      </button>
    </aside>
  );
}
