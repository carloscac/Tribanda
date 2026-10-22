"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdBanner } from "@/components/ads/AdBanner";
import { AdInterstitial } from "@/components/ads/AdInterstitial";
import { AdWide } from "@/components/ads/AdWide";
import type { PublicAd } from "@/lib/ads";

const PHONE = "(max-width: 767px)";

function usePhoneViewport() {
  const [phone, setPhone] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return phone;
}

export function AdSlots({
  interstitial,
  banner,
  wide = null,
}: {
  interstitial: PublicAd | null;
  banner: PublicAd | null;
  wide?: PublicAd | null;
}) {
  const pathname = usePathname();
  const phone = usePhoneViewport();
  if (pathname.endsWith("/tv") || phone === null) return null;
  const strip = phone ? banner : (banner ?? interstitial);
  if (!wide && !strip && !(phone && interstitial)) return null;
  return (
    <>
      {wide ? <AdWide ad={wide} /> : null}
      {phone && interstitial ? <AdInterstitial ad={interstitial} /> : null}
      {strip ? <AdBanner ad={strip} /> : null}
    </>
  );
}
