import { principalFromRequest, revokeToken } from "@/lib/arbitraje/auth";
import { json, options } from "@/lib/arbitraje/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request) {
  await revokeToken(request);
  const user = await principalFromRequest(request);
  if (user) return json(401, { error: "No se pudo cerrar la sesión.", code: "ERROR" });
  return json(200, { ok: true });
}
