"use client";

import { useRouter } from "next/navigation";

export type TournamentCopyOption = {
  id: string;
  name: string;
  date: string | null;
};

export function TournamentCopyPicker({
  options,
  selectedId,
}: {
  options: TournamentCopyOption[];
  selectedId?: string | null;
}) {
  const router = useRouter();
  if (options.length === 0) return null;

  return (
    <div className="field max-w-lg">
      <label htmlFor="copyFrom">Copiar configuración de un torneo anterior</label>
      <select
        id="copyFrom"
        value={selectedId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/app/torneos/nuevo?desde=${encodeURIComponent(id)}` : "/app/torneos/nuevo");
        }}
      >
        <option value="">Empezar en blanco</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.date ? ` · ${o.date}` : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted">
        Copia sede, categorías, grupos, cuadro, premios y mesas. Indica nombre y fecha del torneo
        nuevo abajo.
      </p>
    </div>
  );
}
