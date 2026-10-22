"use client";

import { useEffect, useState } from "react";
import { AdLink } from "@/components/ads/AdLink";
import { AdMedia } from "@/components/ads/AdMedia";
import { recordAdView } from "@/components/ads/record-ad-view";
import type { PublicAd } from "@/lib/ads";

const storageKey = (id: string) => `tribanda-ad-interstitial:${id}`;

export function AdInterstitial({ ad }: { ad: PublicAd }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey(ad.id))) return;
    } catch {
      /* ignore */
    }
    setOpen(true);
    recordAdView(ad.id);
  }, [ad.id]);

  function close() {
    try {
      sessionStorage.setItem(storageKey(ad.id), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/95 p-4 sm:items-center">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface text-cream shadow-2xl">
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-navy/70 text-2xl leading-none text-cream"
          aria-label="Cerrar publicidad"
        >
          ×
        </button>
        {ad.href && ad.provider === "CUSTOM" ? (
          <AdLink href={ad.href} className="block" onClick={close}>
            <AdMedia ad={ad} variant="interstitial" />
          </AdLink>
        ) : (
          <AdMedia ad={ad} variant="interstitial" />
        )}
        <div className="grid gap-3 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
            {ad.provider === "YOUTUBE" ? "YouTube" : ad.provider === "GOOGLE" ? "Google" : "Publicidad"}
          </p>
          <h2 className="font-serif text-2xl leading-tight">{ad.title}</h2>
          {ad.body && ad.provider !== "GOOGLE" ? <p className="text-sm text-cream/80">{ad.body}</p> : null}
          <div className="mt-1 grid gap-2">
            {ad.href && ad.provider === "CUSTOM" ? (
              <AdLink href={ad.href} className="btn btn-primary w-full text-center" onClick={close}>
                Ver más
              </AdLink>
            ) : null}
            <button type="button" className="btn btn-ghost w-full" onClick={close}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
