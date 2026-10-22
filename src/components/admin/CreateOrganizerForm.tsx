"use client";

import { useActionState } from "react";
import { createOrganizerAccount } from "@/lib/actions/admin/users";

export function CreateOrganizerForm() {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      createOrganizerAccount(formData),
    null,
  );

  return (
    <form action={formAction} className="card grid max-w-lg gap-4">
      <h2 className="text-lg font-semibold">Nuevo organizador (cliente)</h2>
      <p className="text-sm text-muted">
        Crea la cuenta que armará torneos. Recibe categorías por defecto (Primera, Segunda, Tercera).
      </p>
      <div className="field">
        <label htmlFor="name">Nombre</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña inicial</label>
        <input id="password" name="password" type="password" minLength={6} required autoComplete="new-password" />
      </div>
      <button className="btn btn-primary max-w-xs" type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear organizador"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-success">Cuenta creada. Ya puede entrar en /entrar.</p>
      )}
    </form>
  );
}
