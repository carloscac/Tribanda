"use client";

import { useActionState, useState } from "react";
import { resetUserPassword } from "@/lib/actions/admin/users";

export function ResetUserPasswordForm({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const result = await resetUserPassword(formData);
      if (result.ok) setOpen(false);
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <button type="button" className="text-xs text-felt" onClick={() => setOpen(true)}>
        Restablecer
      </button>
    );
  }

  return (
    <form action={formAction} className="grid min-w-[12rem] gap-2">
      <input type="hidden" name="id" value={userId} />
      <p className="text-xs text-muted">Nueva contraseña para {userName}</p>
      <input
        name="password"
        type="password"
        minLength={6}
        required
        autoComplete="new-password"
        placeholder="Mín. 6 caracteres"
        className="text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary text-xs" disabled={pending}>
          {pending ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      {state?.ok && <p className="text-xs text-success">Contraseña actualizada.</p>}
    </form>
  );
}
