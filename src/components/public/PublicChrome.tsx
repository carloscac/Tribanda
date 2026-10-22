"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { logoutOrganizer } from "@/lib/actions/auth";
import { tournamentImageSrc } from "@/lib/tournament-image";
import type { ParticipantScreens } from "@/lib/participant-screens";
import { rosterCountLabel } from "@/lib/labels";
import type { PublicEvent } from "@/lib/public-board";
import { phasePublicHref } from "@/lib/tournament-phase";

const LINKS = [
  { key: "inicio", href: (slug: string) => `/t/${slug}`, label: "Inicio" },
  { key: "grupos", href: (slug: string) => `/t/${slug}/grupos`, label: "Grupos" },
  { key: "cuadro", href: (slug: string) => `/t/${slug}/cuadro`, label: "Cuadro" },
  { key: "mesas", href: (slug: string) => `/t/${slug}/mesas`, label: "Mesas" },
  { key: "stats", href: (slug: string) => `/t/${slug}/stats`, label: "Estadísticas" },
] as const;

export function PublicChrome({
  event,
  visibleScreens,
  panelHref = null,
  participantHomeHref = null,
  loginHref = null,
  alreadyInscribed = false,
  shareHref = null,
  pendingPayment = false,
  canSelfJoin = false,
  blockedByCategory = false,
}: {
  event: PublicEvent;
  visibleScreens: ParticipantScreens;
  /** Solo organizador/admin: volver al panel sin mostrarlo al público anónimo. */
  panelHref?: string | null;
  /** Jugador logueado: volver a Mis torneos. */
  participantHomeHref?: string | null;
  /** Visitante: entrar como jugador y volver a este torneo. */
  loginHref?: string | null;
  alreadyInscribed?: boolean;
  /** Ficha pública para compartir inscripción o puesto. */
  shareHref?: string | null;
  pendingPayment?: boolean;
  canSelfJoin?: boolean;
  blockedByCategory?: boolean;
}) {
  const pathname = usePathname();
  if (pathname === `/t/${event.slug}/tv`) return null;

  const meta = [
    event.venue,
    event.dateLabel,
    rosterCountLabel(event.registeredCount, event.plannedCapacity),
  ]
    .filter(Boolean)
    .join(" · ");
  const backHref = participantHomeHref ?? "/";
  const backLabel = participantHomeHref ? "← Mis torneos" : "← Inicio";
  const onHome = pathname === `/t/${event.slug}`;

  return (
    <>
    <header className="bg-surface">
      <div className="border-b border-line/80 bg-navy/95 px-3 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-4 sm:py-2.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-9 min-w-[44px] items-center text-sm font-semibold text-gold sm:min-h-11"
          >
            {backLabel}
          </Link>
          {participantHomeHref ? (
            <form action={logoutOrganizer}>
              <button
                type="submit"
                className="inline-flex min-h-9 items-center rounded-lg border border-line/80 px-3 text-sm font-semibold text-cream sm:min-h-11"
              >
                Salir
              </button>
            </form>
          ) : loginHref ? (
            <Link
              href={loginHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-gold/60 px-3 text-sm font-semibold text-gold sm:min-h-11"
            >
              Entrar
            </Link>
          ) : null}
        </div>
      </div>
      {event.hasImage ? (
        <div className={`mx-auto max-w-6xl px-3 pt-2 sm:px-4 sm:pt-4 ${onHome ? "" : "hidden sm:block"}`}>
          <img
            src={tournamentImageSrc(event.id, event.imageUpdatedAt)}
            alt=""
            className="h-24 w-full rounded-xl object-cover sm:h-52 sm:rounded-2xl"
          />
        </div>
      ) : null}
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-4">
        <div className="flex min-w-0 flex-wrap items-start gap-3">
          <span className="hidden sm:inline-flex">
            <AppLogo size="xs" href={`/t/${event.slug}`} />
          </span>
          <div className="min-w-0">
          <h1 className="font-serif text-xl leading-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-0.5 text-xs text-muted sm:mt-1 sm:text-sm">{meta || "Torneo de carambola"}</p>
          {event.status === "LIVE" || event.currentPhase.key !== "REGISTRATION" ? (
            <p className="mt-0.5 hidden text-sm font-semibold text-felt sm:block">
              Ahora: {event.currentPhase.label}
            </p>
          ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs sm:px-3 sm:py-1 sm:text-sm">{event.statusLabel}</span>
          {event.currentPhase.key !== "REGISTRATION" ? (
            <Link
              href={phasePublicHref(event.slug, event.currentPhase, visibleScreens)}
              className="rounded-full border border-felt/50 bg-felt/15 px-2.5 py-0.5 text-xs font-semibold text-felt sm:px-3 sm:py-1 sm:text-sm"
            >
              {event.currentPhase.label}
            </Link>
          ) : null}
          {shareHref && pathname !== shareHref ? (
            <Link
              href={shareHref}
              className="rounded-full border border-gold/60 px-2.5 py-0.5 text-xs font-semibold text-gold sm:px-3 sm:py-1 sm:text-sm"
            >
              Compartir
            </Link>
          ) : null}
          {alreadyInscribed ? (
            <span className="rounded-full border border-felt/50 bg-felt/15 px-2.5 py-0.5 text-xs font-semibold text-felt sm:px-3 sm:py-1 sm:text-sm">
              Ya inscrito
            </span>
          ) : pendingPayment ? (
            <span className="rounded-full border border-warning/50 bg-warning/15 px-3 py-1 text-sm font-semibold text-warning">
              Pendiente de pago
            </span>
          ) : blockedByCategory ? (
            <span className="rounded-full border border-line px-3 py-1 text-sm text-muted">
              No aplica a tu categoría
            </span>
          ) : canSelfJoin ? (
            <Link href={`/t/${event.slug}/inscribirse`} className="btn btn-primary px-3 py-1.5 text-sm">
              Inscribirme
            </Link>
          ) : null}
          {panelHref && (
            <Link href={panelHref} className="btn btn-ghost px-3 py-1.5 text-sm">
              Panel
            </Link>
          )}
        </div>
      </div>
    </header>
    <nav className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-3 py-2 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-4 sm:py-3">
        <Link
          href={participantHomeHref ? "/participante/torneos" : "/torneos"}
          className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-xs sm:px-3 sm:text-sm"
        >
          Torneos
        </Link>
        {LINKS.filter((link) => visibleScreens[link.key]).map((link) => {
          const href = link.href(event.slug);
          const active = pathname === href;
          const current = link.key === event.currentPhase.hrefKey && event.status === "LIVE";
          return (
            <Link
              key={link.key}
              href={href}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs sm:px-3 sm:text-sm ${
                active
                  ? "bg-felt text-cream"
                  : current
                    ? "border border-felt bg-felt/15 font-semibold text-felt"
                    : "border border-line bg-paper"
              }`}
            >
              {link.label}
              {current && !active ? " · ahora" : ""}
            </Link>
          );
        })}
        {visibleScreens.tv && (
          <Link
            href={`/t/${event.slug}/tv`}
            className="shrink-0 rounded-full border border-gold px-2.5 py-1 text-xs text-gold sm:px-3 sm:text-sm"
          >
            Pantalla TV
          </Link>
        )}
      </div>
    </nav>
    </>
  );
}
