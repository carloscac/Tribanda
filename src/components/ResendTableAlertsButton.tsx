"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { resendMatchTableAlerts } from "@/lib/actions/matches";

export function ResendTableAlertsButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost text-sm"
      disabled={pending}
      title="Reenvía el aviso a los dos jugadores en la app"
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", matchId);
          const result = await resendMatchTableAlerts(fd);
          if (result && "error" in result && result.error) {
            window.alert(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Enviando…" : "Reenviar aviso a jugadores"}
    </button>
  );
}
