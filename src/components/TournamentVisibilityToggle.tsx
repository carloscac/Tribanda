"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleTournamentHidden } from "@/lib/actions/tournament-visibility";

export function TournamentVisibilityToggle({
  tournamentId,
  hidden,
}: {
  tournamentId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(nextHidden: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("id", tournamentId);
    formData.set("hidden", nextHidden ? "1" : "0");
    startTransition(async () => {
      const result = await toggleTournamentHidden(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!hidden}
          disabled={pending}
          onChange={(event) => onChange(!event.target.checked)}
        />
        <span>{hidden ? "Oculto del listado público" : "Visible en el listado público"}</span>
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
