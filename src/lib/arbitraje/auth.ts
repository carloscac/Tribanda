import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseRole, type UserRole } from "@/lib/roles";
import { findUserByLogin } from "@/lib/user-login";
import { normalizeDocumentId } from "@/lib/document-id";

export type RefereePrincipal = {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
  deviceId: string;
};

const SESSION_MS = 12 * 60 * 60 * 1000;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type LoginRefereeResult =
  | { error: string; status: 401 | 403 }
  | { token: string; expiresAt: string; user: { id: string; name: string; role: UserRole } };

export async function loginReferee(login: string, password: string, deviceId: string): Promise<LoginRefereeResult> {
  const user = await findUserByLogin(login);
  if (!user || !user.active || !password) return { error: "Credenciales incorrectas." as const, status: 401 };
  let ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok && user.role === "PARTICIPANT" && user.documentId) {
    const pwdDoc = normalizeDocumentId(password);
    if (pwdDoc) ok = await bcrypt.compare(pwdDoc, user.passwordHash);
  }
  if (!ok) return { error: "Credenciales incorrectas." as const, status: 401 };
  const role = parseRole(user.role);
  if (role === "PARTICIPANT") {
    return { error: "Un participante no puede arbitrar." as const, status: 403 };
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.refereeSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      deviceId: deviceId.slice(0, 80),
      expiresAt,
    },
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: user.id, name: user.name, role },
  };
}

export async function principalFromRequest(request: Request): Promise<RefereePrincipal | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const session = await prisma.refereeSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.active) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    role: parseRole(session.user.role),
    active: session.user.active,
    deviceId: session.deviceId,
  };
}

export async function revokeToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return;
  await prisma.refereeSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
