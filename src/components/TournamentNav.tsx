import Link from "next/link";
import { FinishTournamentButton } from "@/components/FinishTournamentButton";

const LINKS = [
  { key: "mando" as const, href: (id: string) => `/app/torneos/${id}/mando`, label: "Mando" },
  { key: "inscritos" as const, href: (id: string) => `/app/torneos/${id}`, label: "Inscritos" },
  { key: "grupos" as const, href: (id: string) => `/app/torneos/${id}/grupos`, label: "Grupos" },
  { key: "cuadro" as const, href: (id: string) => `/app/torneos/${id}/cuadro`, label: "Cuadro" },
  { key: "estadisticas" as const, href: (id: string) => `/app/estadisticas?torneo=${id}`, label: "Estadísticas" },
  { key: "editar" as const, href: (id: string) => `/app/torneos/${id}/editar`, label: "Ajustes" },
];

export function TournamentNav({
  id,
  name,
  current,
  publicSlug,
  finish,
}: {
  id: string;
  name: string;
  current: "mando" | "inscritos" | "grupos" | "cuadro" | "estadisticas" | "editar";
  publicSlug?: string;
  finish?: {
    tournamentId: string;
    status: string;
    canClose: boolean;
    blockReason: string | null;
  };
}) {
  return (
    <div className="mb-6">
      <Link href="/app/torneos" className="text-sm text-muted">
        ← Torneos
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{name}</h1>
        {finish && (
          <div className="flex flex-col items-end gap-1">
            <FinishTournamentButton
              tournamentId={finish.tournamentId}
              canClose={finish.canClose}
              blockReason={finish.blockReason}
              closed={finish.status === "CLOSED"}
            />
          </div>
        )}
      </div>
      <nav className="mt-4 flex flex-wrap gap-2">
        {LINKS.map((link) => {
          const active = current === link.key;
          return (
            <Link
              key={link.label}
              href={link.href(id)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                active ? "bg-felt text-white" : "border border-line bg-paper text-muted hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {publicSlug && (
          <Link
            href={`/t/${publicSlug}`}
            className="rounded-full border border-gold px-3 py-1 text-sm text-gold"
          >
            Público
          </Link>
        )}
      </nav>
    </div>
  );
}
