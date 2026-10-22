import { json, options } from "@/lib/arbitraje/http";
import { loginReferee } from "@/lib/arbitraje/auth";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request) {
  let body: { login?: string; password?: string; deviceId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(422, { error: "La solicitud no es válida.", code: "VALIDATION" });
  }
  const deviceId = String(body.deviceId ?? "").trim();
  if (!deviceId) return json(422, { error: "Falta el identificador del dispositivo.", code: "VALIDATION" });
  const result = await loginReferee(String(body.login ?? ""), String(body.password ?? ""), deviceId);
  if ("error" in result) {
    return json(result.status, { error: result.error, code: result.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED" });
  }
  return json(200, result);
}
