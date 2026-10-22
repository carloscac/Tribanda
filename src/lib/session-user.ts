import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseRole, type UserRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  documentId: string | null;
  role: UserRole;
  active: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, documentId: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    documentId: user.documentId,
    role: parseRole(user.role),
    active: user.active,
  };
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("No autenticado");
  return user;
}

export async function requireOrganizer() {
  const user = await requireSessionUser();
  if (user.role !== "ORGANIZER") {
    throw new Error("Solo organizadores pueden hacer esto.");
  }
  return user;
}

/** Organizador o administrador (gestión de torneos). */
export async function requireOrganizerOrAdmin() {
  const user = await requireSessionUser();
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") {
    throw new Error("Solo organizadores o administradores pueden hacer esto.");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") {
    throw new Error("Solo administradores pueden hacer esto.");
  }
  return user;
}

export async function requireParticipant() {
  const user = await requireSessionUser();
  if (user.role !== "PARTICIPANT") {
    throw new Error("Solo participantes pueden hacer esto.");
  }
  return user;
}
