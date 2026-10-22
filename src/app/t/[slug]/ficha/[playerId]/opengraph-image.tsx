import { ImageResponse } from "next/og";
import { loadShareCard } from "@/lib/share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ficha para compartir en TriBanda";

export default async function ShareCardImage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = await params;
  const card = await loadShareCard(slug, playerId);
  const headline = card?.headline ?? "TriBanda";
  const name = card?.playerName ?? "";
  const tournament = card?.tournamentName ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f1f5f9",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#d4a853" }}>TRIBANDA</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 84, color: "#d4a853" }}>{headline}</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 48 }}>{name}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: "#94a3b8" }}>{tournament}</div>
      </div>
    ),
    { ...size },
  );
}
