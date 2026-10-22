"use client";

import { useActionState, useState } from "react";
import { updateOrganizerAccount } from "@/lib/actions/admin/users";

export function EditOrganizerForm({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const result = await updateOrganizerAccount(formData);
      if (result.ok) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <>
      <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        Editar
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy/70"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <form
            action={formAction}
            className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Editar organizador</h2>
            <p className="mt-1 text-sm text-muted">Cambia el nombre o el email con el que entra en /entrar.</p>
            <input type="hidden" name="id" value={userId} />
            <div className="mt-4 grid gap-3">
              <div className="field">
                <label htmlFor={`org-name-${userId}`}>Nombre</label>
                <input
                  id={`org-name-${userId}`}
                  name="name"
                  defaultValue={name}
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor={`org-email-${userId}`}>Email</label>
                <input
                  id={`org-email-${userId}`}
                  name="email"
                  type="email"
                  defaultValue={email}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
            {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
          </form>
        </div>
      ) : null}
    </>
  );
}
