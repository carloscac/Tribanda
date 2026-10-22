"use client";

import { useTransition } from "react";
import { toggleUserActive } from "@/lib/actions/admin/users";

export function ToggleUserActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-xs text-felt"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("id", id);
          await toggleUserActive(fd);
        });
      }}
    >
      {pending ? "…" : active ? "Desactivar" : "Activar"}
    </button>
  );
}
