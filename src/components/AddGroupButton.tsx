"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { addEmptyGroup } from "@/lib/actions/groups";

export function AddGroupButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean; name?: string } | null, formData: FormData) => {
      const result = await addEmptyGroup(formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="grid w-full gap-1 sm:w-auto">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <button className="btn btn-ghost w-full border border-line sm:w-auto" type="submit" disabled={pending}>
        {pending ? "Creando…" : "Agregar grupo"}
      </button>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok && state.name ? (
        <p className="text-xs text-felt">{state.name} creado. Quedó vacío para ubicar jugadores.</p>
      ) : null}
    </form>
  );
}
