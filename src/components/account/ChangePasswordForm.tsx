"use client";

import { useActionState } from "react";
import { changeOwnPassword } from "@/lib/actions/account";

export function ChangePasswordForm({
  hint = "Usa la contraseña con la que entras en /entrar. Tras guardar, la siguiente sesión usará la nueva.",
}: {
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      changeOwnPassword(formData),
    null,
  );

  return (
    <form action={formAction} className="card grid max-w-lg gap-4">
      <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
      <p className="text-sm text-muted">{hint}</p>
      <div className="field">
        <label htmlFor="currentPassword">Contraseña actual</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">Nueva contraseña</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirmar nueva contraseña</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>
      <button className="btn btn-primary max-w-xs" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Actualizar contraseña"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">Contraseña actualizada.</p>}
    </form>
  );
}
