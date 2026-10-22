import { principalFromRequest } from "@/lib/arbitraje/auth";
import { applyEvents, RefereeCommandError } from "@/lib/arbitraje/apply";
import { json, options } from "@/lib/arbitraje/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await principalFromRequest(request);
  if (!user) return json(401, { error: "La sesión venció.", code: "UNAUTHORIZED" });
  const { id } = await context.params;
  let body: { expectedRevision?: string; events?: unknown; force?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(422, { error: "La solicitud no es válida.", code: "VALIDATION" });
  }
  try {
    const result = await applyEvents(user, id, String(body.expectedRevision ?? ""), body.events ?? [], body.force === true);
    return json(200, result);
  } catch (error) {
    if (error instanceof RefereeCommandError) {
      return json(error.status, {
        error: error.message,
        code: error.code,
        serverRevision: error.serverRevision || undefined,
      });
    }
    return json(500, { error: "No se pudieron guardar los eventos.", code: "ERROR" });
  }
}
