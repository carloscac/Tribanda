"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { closeTournament } from "@/lib/actions/tournaments";

export function FinishTournamentButton({
  tournamentId,
  canClose,
  blockReason,
  closed,
}: {
  tournamentId: string;
  canClose: boolean;
  blockReason: string | null;
  closed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | null, formData: FormData) =>
      closeTournament(formData),
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state?.ok, router]);

  if (closed) {
    return (
      <span className="rounded-full border border-line bg-paper px-3 py-1 text-sm text-muted">
        Torneo finalizado
      </span>
    );
  }

  if (state?.ok) {
    return (
      <span className="rounded-full border border-line bg-paper px-3 py-1 text-sm text-felt">
        Torneo finalizado
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="rounded-full border border-gold px-3 py-1 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canClose || pending}
        title={blockReason ?? undefined}
        onClick={() => setOpen(true)}
      >
        Finalizar torneo
      </button>
      {state?.error && (
        <p className="max-w-xs text-right text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title="Finalizar torneo"
        message="El torneo quedará cerrado: no se podrán cargar más resultados ni regenerar grupos o cuadro. Los reportes y el ranking siguen disponibles."
        confirmLabel="Sí, finalizar"
        danger
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("tournamentId", tournamentId);
          startTransition(() => {
            formAction(fd);
          });
        }}
      />
    </>
  );
}
