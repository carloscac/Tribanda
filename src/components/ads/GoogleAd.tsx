"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function GoogleAd({
  client,
  slot,
  format = "auto",
}: {
  client: string;
  slot: string;
  format?: "auto" | "rectangle";
}) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [client, slot]);

  return (
    <>
      <Script
        id="adsbygoogle-js"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: format === "rectangle" ? 90 : 250 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format === "auto" ? "auto" : "rectangle"}
        data-full-width-responsive="true"
      />
    </>
  );
}
