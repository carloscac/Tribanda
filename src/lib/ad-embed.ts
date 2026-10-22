export const AD_PROVIDERS = ["CUSTOM", "GOOGLE", "YOUTUBE"] as const;
export type AdProvider = (typeof AD_PROVIDERS)[number];

export function parseAdProvider(raw: string | null | undefined): AdProvider {
  if (raw === "GOOGLE" || raw === "YOUTUBE") return raw;
  return "CUSTOM";
}

export function youtubeVideoId(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  return null;
}

export function youtubeEmbedSrc(raw: string | null | undefined, autoplay = false) {
  const id = youtubeVideoId(raw);
  if (!id) return null;
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function parseGoogleAd(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const parts = value.split("|").map((part) => part.trim());
  const client = parts[0]?.startsWith("ca-pub-") ? parts[0] : null;
  const slot = parts[1] && /^\d{5,}$/.test(parts[1]) ? parts[1] : null;
  if (!client || !slot) return null;
  return { client, slot };
}

export function formatGoogleAd(client: string, slot: string) {
  return `${client.trim()}|${slot.trim()}`;
}
