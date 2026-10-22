import { headers } from "next/headers";

export async function appOrigin() {
  const fromEnv = (process.env.APP_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return "http://localhost:8080";
}
