"use client";

import { useActionState, useState } from "react";
import { CitySelect } from "@/components/CitySelect";
import { PhotoFileField } from "@/components/PhotoFileField";
import { selfInscribeTournament } from "@/lib/actions/self-inscribe";
import { compressTournamentImage } from "@/lib/compress-image";
import { TournamentPaymentBox } from "@/components/TournamentPaymentBox";
import type { TournamentPayment } from "@/lib/tournament-payment";
import { DataProcessingConsent } from "@/components/DataProcessingConsent";

export function TournamentJoinForm({
  tournamentId,
  loggedIn,
  defaultName,
  defaultEmail,
  defaultPhone,
  defaultCity,
  categories,
  lockCategory,
  lockedCategoryId = "",
  lockedCategoryName = null,
  entryFee = null,
  payment = null,
  needsConsent = true,
}: {
  tournamentId: string;
  loggedIn: boolean;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultCity?: string;
  categories: { id: string; name: string; distance: number }[];
  lockCategory: boolean;
  lockedCategoryId?: string;
  lockedCategoryName?: string | null;
  entryFee?: number | null;
  payment?: TournamentPayment | null;
  needsConsent?: boolean;
}) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const file = formData.get("photo");
      if (file instanceof File && file.size > 0) {
        try {
          formData.set("photo", await compressTournamentImage(file));
        } catch {
          return { error: "No se pudo leer la foto. Prueba JPG o PNG." };
        }
      }
      return (await selfInscribeTournament(formData)) ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {!loggedIn ? (
        <>
          <div className="field">
            <label htmlFor="join-name">Nombre</label>
            <input id="join-name" name="name" required defaultValue={defaultName} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="join-phone">Celular</label>
            <input
              id="join-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              defaultValue={defaultPhone}
              placeholder="3xx xxx xxxx"
            />
          </div>
          <div className="field">
            <label htmlFor="join-doc">Cédula</label>
            <input id="join-doc" name="documentId" inputMode="numeric" required />
          </div>
          <div className="field">
            <label htmlFor="join-password">Contraseña</label>
            <input
              id="join-password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
        </>
      ) : null}
      <div className="field">
        <label htmlFor="join-city">Ciudad</label>
        <CitySelect id="join-city" name="city" required defaultValue={defaultCity} />
      </div>
      <div className="field">
        <label htmlFor="join-email">Correo</label>
        <input
          id="join-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          autoComplete="email"
        />
      </div>
      {lockCategory ? (
        <>
          {lockedCategoryId ? <input type="hidden" name="categoryId" value={lockedCategoryId} /> : null}
          {lockedCategoryName ? (
            <p className="text-sm">
              Categoría: <strong>{lockedCategoryName}</strong>
            </p>
          ) : null}
        </>
      ) : categories.length > 0 ? (
        <div className="field">
          <label htmlFor="join-cat">Categoría</label>
          <select id="join-cat" name="categoryId" required defaultValue="">
            <option value="" disabled>
              Elige tu categoría
            </option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} (a {row.distance})
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <PhotoFileField onBusyChange={setPhotoBusy} />
      {entryFee != null && entryFee > 0 ? (
        <TournamentPaymentBox entryFee={entryFee} payment={payment} />
      ) : (
        <p className="text-sm text-muted">Este torneo no tiene costo de inscripción.</p>
      )}
      {needsConsent ? <DataProcessingConsent /> : null}
      {state?.error ? (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" type="submit" disabled={pending || photoBusy}>
        {pending ? "Enviando…" : photoBusy ? "Preparando foto…" : entryFee != null && entryFee > 0 ? "Solicitar inscripción" : "Inscribirme"}
      </button>
    </form>
  );
}
