"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutOrganizer } from "@/lib/actions/auth";
import { APP_NAME } from "@/lib/brand";
import { STATUS_LABEL, statusBadgeClass } from "@/lib/labels";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || "?").toUpperCase();
}

export type HeaderTournament = {
  id: string;
  name: string;
  venue: string | null;
  date: string | null;
  status: string;
};

export function TopHeader({
  userName,
  tournament,
  menuOpen,
  onMenu,
}: {
  userName: string;
  tournament: HeaderTournament | null;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const [clock, setClock] = useState("");
  const pathname = usePathname();
  const onAdmin = pathname.startsWith("/app/admin");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = tournament?.date
    ? new Date(tournament.date).toLocaleDateString("es-CO", { dateStyle: "medium" })
    : null;

  return (
    <header className="relative z-50 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        className="btn btn-ghost shrink-0 px-2"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        aria-label={menuOpen ? "Ocultar menú" : "Mostrar menú"}
      >
        <Menu size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {onAdmin ? "Administración" : tournament?.name ?? APP_NAME}
        </p>
        {(onAdmin || tournament) && (
          <p className="truncate text-xs text-muted">
            {onAdmin
              ? "Organizadores y acceso a la plataforma"
              : [dateLabel, tournament?.venue].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {tournament && (
          <span className="hidden sm:contents">
            <span className={statusBadgeClass(tournament.status)}>
              {STATUS_LABEL[tournament.status] ?? tournament.status}
            </span>
          </span>
        )}
        <span className="hidden tabular-nums text-sm text-muted sm:inline">{clock}</span>
        <span className="hidden items-center gap-2 rounded-full border border-line bg-paper px-2 py-1 text-sm sm:inline-flex">
          <span className="initials" aria-hidden>
            {initials(userName)}
          </span>
          <span className="max-w-[9rem] truncate pr-1">{userName}</span>
        </span>
        <form action={logoutOrganizer}>
          <button
            type="submit"
            className="btn btn-ghost min-h-11 shrink-0 px-3 py-1.5 text-sm"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
