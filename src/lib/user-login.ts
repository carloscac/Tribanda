import { prisma } from "@/lib/prisma";
import { normalizeDocumentId } from "@/lib/document-id";

const loginSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  documentId: true,
  role: true,
  active: true,
} as const;

export async function findUserByLogin(login: string) {
  const raw = login.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return prisma.user.findUnique({
      where: { email: raw.toLowerCase() },
      select: loginSelect,
    });
  }

  const documentId = normalizeDocumentId(raw);
  if (!documentId) return null;

  return prisma.user.findFirst({
    where: { documentId },
    select: loginSelect,
  });
}
