"use client";

import { ActiveTournamentSync } from "@/components/dashboard/ActiveTournamentSync";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TopHeader, type HeaderTournament } from "@/components/dashboard/TopHeader";
import { useEffect, useState } from "react";

export function DashboardLayout({
  userName,
  isAdmin,
  tournament,
  children,
}: {
  userName: string;
  isAdmin?: boolean;
  tournament: HeaderTournament | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setOpen(true);
  }, []);

  return (
    <div className="app-shell flex min-h-screen">
      <ActiveTournamentSync serverTournamentId={tournament?.id ?? null} />
      <AppSidebar
        tournamentId={tournament?.id ?? null}
        isAdmin={isAdmin}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          userName={userName}
          tournament={tournament}
          menuOpen={open}
          onMenu={() => setOpen((v) => !v)}
        />
        <div className="flex-1 px-4 py-5 lg:px-6">{children}</div>
      </div>
    </div>
  );
}
