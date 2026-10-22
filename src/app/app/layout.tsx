import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getActiveTournament } from "@/lib/active-tournament";
import { getSessionUser } from "@/lib/session-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");

  const user = await getSessionUser();
  if (user?.role === "PARTICIPANT") redirect("/participante");
  if (user && user.role !== "ORGANIZER" && user.role !== "ADMIN") redirect("/entrar");

  const tournament = user
    ? await getActiveTournament({ userId: user.id, role: user.role })
    : null;

  return (
    <DashboardLayout
      userName={session.user.name ?? "Organizador"}
      isAdmin={user?.role === "ADMIN"}
      tournament={
        tournament
          ? {
              ...tournament,
              date: tournament.date?.toISOString() ?? null,
            }
          : null
      }
    >
      {children}
    </DashboardLayout>
  );
}
