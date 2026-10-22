import { principalFromRequest } from "@/lib/arbitraje/auth";
import { json, options } from "@/lib/arbitraje/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: Request) {
  const user = await principalFromRequest(request);
  if (!user) return json(401, { error: "La sesión venció.", code: "UNAUTHORIZED" });
  return json(200, {
    matchLimitMs: null,
    timeoutLimitMs: null,
    note: "Tribanda todavía no guarda un límite de tiempo ni de tiempos fuera en el torneo. La tablet muestra el tiempo transcurrido y no impone un tope.",
  });
}
