"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completePasswordReset } from "@/lib/actions/password-reset";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      completePasswordReset(formData),
    null,
  );

  if (state?.ok) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-felt">Contraseña actualizada. Ya puedes entrar.</p>
        <Link href="/entrar" className="btn btn-primary w-full">
          Ir a entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">Nueva contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirmar</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>
      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
