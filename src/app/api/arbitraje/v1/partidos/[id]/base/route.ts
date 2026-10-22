import { principalFromRequest } from "@/lib/arbitraje/auth";
import { adoptDatabase, RefereeCommandError } from "@/lib/arbitraje/apply";
import { json, options } from "@/lib/arbitraje/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await principalFromRequest(request);
  if (!user) return json(401, { error: "La sesión venció.", code: "UNAUTHORIZED" });
  const { id } = await context.params;
  try {
    return json(200, await adoptDatabase(user, id));
  } catch (error) {
    if (error instanceof RefereeCommandError) {
      return json(error.status, { error: error.message, code: error.code });
    }
    return json(500, { error: "No se pudo usar el marcador del servidor.", code: "ERROR" });
  }
}
