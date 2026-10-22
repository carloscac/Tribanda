"use client";

import { useActionState } from "react";
import type { Category } from "@prisma/client";
import {
  createCategory,
  toggleCategory,
  updateCategory,
} from "@/lib/actions/categories";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | null, formData: FormData) => {
      return createCategory(formData);
    },
    null,
  );

  return (
    <div className="grid gap-8">
      <ul className="grid gap-3">
        {categories.map((c) => (
          <li key={c.id} className={`card ${c.active ? "" : "opacity-60"}`}>
            <form
              action={async (formData) => {
                await updateCategory(formData);
              }}
              className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end"
            >
              <input type="hidden" name="id" value={c.id} />
              <div className="field">
                <label>Nombre</label>
                <input name="name" defaultValue={c.name} required />
              </div>
              <div className="field">
                <label>Distancia</label>
                <input name="distance" type="number" min={1} max={80} defaultValue={c.distance} required />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit">
                  Guardar
                </button>
                <button
                  className="btn btn-ghost"
                  type="submit"
                  formAction={async () => {
                    await toggleCategory(c.id);
                  }}
                >
                  {c.active ? "Ocultar" : "Activar"}
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>

      <div className="card">
        <h2 className="font-serif mb-4 text-xl">Nueva categoría</h2>
        <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
          <div className="field">
            <label htmlFor="new-name">Nombre</label>
            <input id="new-name" name="name" required placeholder="Master" />
          </div>
          <div className="field">
            <label htmlFor="new-distance">Distancia</label>
            <input id="new-distance" name="distance" type="number" min={1} max={80} required defaultValue={20} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "…" : "Añadir"}
          </button>
        </form>
        {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      </div>
    </div>
  );
}
