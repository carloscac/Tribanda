"use client";

import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  GanttChart,
  Home,
  LayoutGrid,
  Settings,
  KeyRound,
  Shield,
  Trophy,
  Users,
  Table2,
  LogOut,
  Megaphone,
} from "lucide-react";
import { logoutOrganizer } from "@/lib/actions/auth";

const ITEMS = [
  { key: "admin", href: "/app/admin", label: "Administración", icon: Shield, adminOnly: true },
  { key: "publicidad", href: "/app/admin/publicidad", label: "Publicidad", icon: Megaphone, adminOnly: true },
  { key: "dashboard", href: "/app", label: "Dashboard", icon: Home, exact: true },
  { key: "torneos", href: "/app/torneos", label: "Torneos", icon: Trophy },
  { key: "jugadores", href: "/app/jugadores", label: "Deportistas", icon: Users },
  { key: "mesas", href: "mesas", label: "Mesas", icon: Table2, tournament: true },
  { key: "partidos", href: "mando", label: "Partidos", icon: ClipboardList, tournament: true },
  { key: "cuadros", href: "cuadro", label: "Cuadros", icon: GanttChart, tournament: true },
  { key: "ranking", href: "/app/ranking", label: "Ranking", icon: LayoutGrid, scoped: true },
  { key: "estadisticas", href: "/app/estadisticas", label: "Estadísticas", icon: BarChart3, scoped: true },
  { key: "reportes", href: "/app/reportes", label: "Reportes", icon: FileText, scoped: true },
  { key: "config", href: "/app/categorias", label: "Configuración", icon: Settings },
  { key: "cuenta", href: "/app/cuenta", label: "Mi cuenta", icon: KeyRound },
] as const;

function tournamentIdFromPath(pathname: string, fallback: string | null) {
  const match = pathname.match(/^\/app\/torneos\/([^/]+)/);
  if (match && match[1] !== "nuevo") return match[1];
  return fallback;
}

function itemHref(item: (typeof ITEMS)[number], tournamentId: string | null) {
  if ("scoped" in item && item.scoped) {
    return tournamentId ? `${item.href}?torneo=${tournamentId}` : "/app/torneos";
  }
  if (!("tournament" in item) || !item.tournament) return item.href;
  if (!tournamentId) return "/app/torneos";
  if (item.href === "mesas") return `/app/torneos/${tournamentId}/mando`;
  return `/app/torneos/${tournamentId}/${item.href}`;
}

function isActive(pathname: string, item: (typeof ITEMS)[number], href: string) {
  if (item.key === "admin") return pathname === "/app/admin";
  if (item.key === "publicidad") return pathname.startsWith("/app/admin/publicidad");
  if ("exact" in item && item.exact) return pathname === "/app";
  if (item.key === "torneos") {
    return pathname === "/app/torneos" || pathname === "/app/torneos/nuevo";
  }
  if (item.key === "mesas" || item.key === "partidos") {
    return pathname.includes("/mando") || pathname.includes("/mesas/");
  }
  if (item.key === "ranking" || item.key === "estadisticas" || item.key === "reportes" || item.key === "cuenta") {
    return pathname === item.href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  tournamentId,
  isAdmin,
  open,
  onClose,
}: {
  tournamentId: string | null;
  isAdmin?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const activeId = tournamentIdFromPath(pathname, tournamentId);
  const items = ITEMS.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  const closeOnNavigate = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) onClose();
  };

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-[45] bg-black/50 lg:hidden ${open ? "" : "hidden"}`}
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <aside
        id="app-sidebar"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[48] flex w-64 min-w-64 flex-col border-r border-line bg-surface px-3 py-4 transition-[transform,width,opacity] duration-200 ease-out lg:static lg:z-auto lg:shrink-0 ${
          open
            ? "translate-x-0 opacity-100 lg:w-64"
            : "-translate-x-full opacity-100 lg:pointer-events-none lg:translate-x-0 lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-r-0 lg:px-0 lg:opacity-0"
        }`}
      >
        <Link href="/app" className="mb-5 block px-2" onClick={closeOnNavigate}>
          <AppLogo size="sm" showText textTheme="dark" />
        </Link>
        <nav className="grid flex-1 content-start gap-1 overflow-y-auto text-sm">
          {items.map((item) => {
            const href = itemHref(item, activeId);
            const Icon = item.icon;
            const active = isActive(pathname, item, href);
            return (
              <Link
                key={item.key}
                href={href}
                onClick={closeOnNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  active ? "bg-felt text-white" : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutOrganizer} className="mt-auto border-t border-line px-1 pt-3">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink"
          >
            <LogOut size={18} />
            Salir
          </button>
        </form>
      </aside>
    </>
  );
}
