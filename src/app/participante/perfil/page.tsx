import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { ParticipantProfileForm } from "@/components/participant/ParticipantProfileForm";
import { playerPhotoSrc } from "@/lib/player-photo";

export const dynamic = "force-dynamic";

export default async function ParticipantProfilePage() {
  const user = await getSessionUser();
  const account = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { dataProcessingAcceptedAt: true },
  });
  const player = await prisma.player.findFirst({
    where: user?.documentId
      ? { documentId: user.documentId }
      : { inscriptions: { some: { participantUserId: user!.id } } },
    select: {
      id: true,
      name: true,
      alias: true,
      club: true,
      phone: true,
      photoUrl: true,
      updatedAt: true,
      documentId: true,
      code: true,
      handicap: true,
      category: { select: { name: true, distance: true } },
    },
  });
  const photoMime = player
    ? (
        await prisma.$queryRaw<{ photoMime: string | null }[]>`
          SELECT photoMime FROM Player WHERE id = ${player.id} LIMIT 1
        `
      )[0]?.photoMime
    : null;

  return (
    <main className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted">
          Puedes actualizar nombre, celular y foto. La cédula y la categoría las define el organizador.
        </p>
      </div>
      <ParticipantProfileForm
        name={player?.name ?? user?.name ?? ""}
        alias={player?.alias ?? ""}
        club={player?.club ?? ""}
        phone={player?.phone ?? ""}
        photoSrc={
          player
            ? playerPhotoSrc({
                id: player.id,
                photoMime,
                photoUrl: player.photoUrl,
                updatedAt: player.updatedAt,
              })
            : null
        }
        documentId={player?.documentId ?? user?.documentId ?? ""}
        categoryName={player?.category ? `${player.category.name} (a ${player.category.distance})` : "—"}
        code={player?.code ?? null}
        handicap={player?.handicap ?? null}
        needsConsent={!account?.dataProcessingAcceptedAt}
      />
      <ChangePasswordForm hint="Si el organizador te inscribió, la contraseña inicial suele ser tu cédula. Cámbiala aquí." />
    </main>
  );
}
