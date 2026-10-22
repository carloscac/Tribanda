import { principalFromRequest } from "@/lib/arbitraje/auth";
import { listAssigned, RefereeCommandError } from "@/lib/arbitraje/apply";
import { json, options } from "@/lib/arbitraje/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: Request) {
  const user = await principalFromRequest(request);
  if (!user) return json(401, { error: "La sesión venció.", code: "UNAUTHORIZED" });
  try {
    return json(200, await listAssigned(user));
  } catch (error) {
    if (error instanceof RefereeCommandError) {
      return json(error.status, { error: error.message, code: error.code });
    }
    return json(500, { error: "No se pudieron consultar los partidos.", code: "ERROR" });
  }
}
