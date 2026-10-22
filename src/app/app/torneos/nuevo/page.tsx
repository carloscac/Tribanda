import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TournamentCopyPicker } from "@/components/TournamentCopyPicker";
import { TournamentForm } from "@/components/TournamentForm";
import { createTournament } from "@/lib/actions/tournaments";
import { prisma } from "@/lib/prisma";
import { tournamentDetailWhere, tournamentListWhere } from "@/lib/tournament-access";
import { parseRole } from "@/lib/roles";
import { loadTournamentPayment } from "@/lib/tournament-payment";
import { loadTournamentHidden } from "@/lib/tournament-visibility";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { FORM_DEFAULT_GROUP_TIEBREAK } from "@/lib/group-standing";

function formatOptionDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("es-CO", { dateStyle: "medium" });
}

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const role = parseRole(session!.user.role);
  if (role !== "ORGANIZER") redirect("/app/torneos");

  const { desde } = await searchParams;
  const templateId = typeof desde === "string" && desde.trim() ? desde.trim() : null;

  const [categories, copySources, templateRow] = await Promise.all([
    prisma.category.findMany({
      where: { userId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tournament.findMany({
      where: tournamentListWhere(userId, role),
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, date: true },
    }),
    templateId
      ? prisma.tournament.findFirst({
          where: tournamentDetailWhere(templateId, userId, role),
          omit: { imageData: true },
          include: { prizes: { orderBy: { place: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  const templatePayment = templateRow ? await loadTournamentPayment(templateRow.id) : null;
  const templateListed = templateRow ? !(await loadTournamentHidden(templateRow.id)) : true;
  const templateTiebreak = templateRow
    ? await readGroupTiebreak(templateRow.id)
    : FORM_DEFAULT_GROUP_TIEBREAK;

  const copyOptions = copySources.map((t) => ({
    id: t.id,
    name: t.name,
    date: formatOptionDate(t.date),
  }));

  return (
    <main>
      <h1 className="text-3xl font-semibold">Nuevo torneo</h1>
      <p className="mb-6 text-sm text-muted">
        Tres bandas, grupos y luego eliminación. El marcador y el cuadro vienen en las siguientes
        pantallas.
      </p>
      <div className="card grid gap-6">
        <TournamentCopyPicker options={copyOptions} selectedId={templateRow?.id ?? null} />
        {templateRow && (
          <p className="text-sm text-muted">
            Plantilla: <strong className="text-ink">{templateRow.name}</strong>. Ajusta nombre y
            fecha; el resto ya está precargado.
          </p>
        )}
        <TournamentForm
          key={templateRow?.id ?? "blank"}
          action={createTournament}
          categories={categories}
          configTemplate={templateRow ?? undefined}
          prizes={templateRow?.prizes ?? []}
          payment={templatePayment}
          listed={templateListed}
          groupTiebreak={templateTiebreak}
          submitLabel="Crear torneo"
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        <Link href="/app/torneos" className="link">
          Volver a torneos
        </Link>
      </p>
    </main>
  );
}
