"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

function SyncInner({ serverTournamentId }: { serverTournamentId: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlTournamentId = useMemo(() => {
    const fromPath = pathname.match(/^\/app\/torneos\/([^/]+)/)?.[1];
    if (fromPath && fromPath !== "nuevo") return fromPath;
    const fromQuery = searchParams.get("torneo");
    return fromQuery?.trim() || null;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!urlTournamentId || urlTournamentId === serverTournamentId) return;
    router.refresh();
  }, [urlTournamentId, serverTournamentId, router]);

  return null;
}

/** Refresca el layout (cabecera) cuando la URL indica otro torneo que el del servidor. */
export function ActiveTournamentSync({ serverTournamentId }: { serverTournamentId: string | null }) {
  return (
    <Suspense fallback={null}>
      <SyncInner serverTournamentId={serverTournamentId} />
    </Suspense>
  );
}
