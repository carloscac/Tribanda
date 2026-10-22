"use client";

import { GoogleAd } from "@/components/ads/GoogleAd";
import { parseGoogleAd, youtubeEmbedSrc } from "@/lib/ad-embed";
import { adImageSrc, type PublicAd } from "@/lib/ads";

export function AdMedia({
  ad,
  variant,
}: {
  ad: PublicAd;
  variant: "interstitial" | "banner" | "wide";
}) {
  if (ad.provider === "YOUTUBE") {
    const src = youtubeEmbedSrc(ad.embed, variant === "interstitial");
    if (src) {
      return (
        <div
          className={
            variant === "interstitial"
              ? "aspect-video w-full bg-navy"
              : variant === "wide"
                ? "h-28 w-full overflow-hidden bg-navy sm:h-36"
                : "h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-navy"
          }
        >
          <iframe
            src={src}
            title={ad.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  if (ad.provider === "GOOGLE") {
    const google = parseGoogleAd(ad.embed);
    if (google) {
      return (
        <div className={variant === "interstitial" ? "bg-paper px-3 py-4" : variant === "wide" ? "w-full" : "min-w-0 flex-1"}>
          <GoogleAd
            client={google.client}
            slot={google.slot}
            format={variant === "interstitial" ? "auto" : "rectangle"}
          />
        </div>
      );
    }
  }

  if (ad.hasImage) {
    return (
      <img
        src={adImageSrc(ad.id, ad.updatedAt)}
        alt={ad.title}
        className={
          variant === "interstitial"
            ? "h-72 w-full object-cover sm:h-80"
            : variant === "wide"
              ? "max-h-28 w-full object-contain sm:max-h-36"
              : "h-16 w-16 shrink-0 rounded-xl object-cover"
        }
      />
    );
  }

  if (variant === "interstitial") {
    return <div className="grid h-48 place-items-center bg-felt-deep font-serif text-3xl">TriBanda</div>;
  }
  return null;
}
