"use client";

import { useActionState } from "react";

type Action = (
  formData: FormData,
) => Promise<{ error?: string; ok?: boolean; message?: string } | void>;

export function AuthForm({
  action,
  children,
  submitLabel,
  hidden,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean; message?: string } | null, formData: FormData) => {
      return (await action(formData)) ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {hidden &&
        Object.entries(hidden).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      {children}
      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p className="text-sm text-felt" role="status">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Un momento…" : submitLabel}
      </button>
    </form>
  );
}
