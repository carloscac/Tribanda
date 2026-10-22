import Link from "next/link";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { prisma } from "@/lib/prisma";
import { CopyPublicLink } from "@/components/CopyPublicLink";
import { TournamentForm } from "@/components/TournamentForm";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { updateTournament } from "@/lib/actions/tournaments";
import { getSessionUser } from "@/lib/session-user";
import { loadTournamentPayment } from "@/lib/tournament-payment";
import { loadTournamentHidden } from "@/lib/tournament-visibility";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  const { ownerId } = await getOrganizerTournamentContext(id);
  const tournament = await prisma.tournament.findFirst({
    where: { id },
    omit: { imageData: true },
    include: { prizes: { orderBy: { place: "asc" } } },
  });
  if (!tournament) return null;
  const categories = await prisma.category.findMany({
    where: { userId: ownerId },
    orderBy: { sortOrder: "asc" },
  });
  const payment = await loadTournamentPayment(id);
  const hidden = await loadTournamentHidden(id);
  const groupTiebreak = await readGroupTiebreak(id);

  return (
    <main>
      <TournamentNavLoader id={id} current="editar" />
      <CopyPublicLink slug={tournament.slug} />
      {sessionUser?.role === "ORGANIZER" && sessionUser.id === ownerId && (
        <p className="mb-4 text-sm">
          <Link href={`/app/torneos/nuevo?desde=${id}`} className="link">
            Crear otro torneo con esta configuración
          </Link>
        </p>
      )}
      <div className="card">
        <TournamentForm
          key={`${tournament.id}-${groupTiebreak}`}
          action={updateTournament}
          categories={categories}
          tournament={tournament}
          prizes={tournament.prizes}
          payment={payment}
          listed={!hidden}
          groupTiebreak={groupTiebreak}
          submitLabel="Guardar cambios"
        />
      </div>
    </main>
  );
}
