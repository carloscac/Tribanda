import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (user.role !== "ADMIN") redirect("/app");
  return children;
}
