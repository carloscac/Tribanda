export const ROLES = ["ADMIN", "ORGANIZER", "PARTICIPANT"] as const;
export type UserRole = (typeof ROLES)[number];

export function parseRole(raw: string | null | undefined): UserRole {
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "PARTICIPANT") return "PARTICIPANT";
  return "ORGANIZER";
}

export function roleLabel(role: UserRole) {
  if (role === "ADMIN") return "Administrador";
  if (role === "PARTICIPANT") return "Participante";
  return "Organizador";
}

export function homePathForRole(role: UserRole) {
  if (role === "ADMIN") return "/app/admin";
  if (role === "PARTICIPANT") return "/participante";
  return "/app";
}
