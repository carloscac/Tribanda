"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoFileField } from "@/components/PhotoFileField";
import { DataProcessingConsent } from "@/components/DataProcessingConsent";
import { updateParticipantProfile } from "@/lib/actions/participant/profile";

export function ParticipantProfileForm({
  name,
  alias,
  club,
  phone,
  photoSrc,
  documentId,
  categoryName,
  code,
  handicap,
  needsConsent = false,
}: {
  name: string;
  alias: string;
  club: string;
  phone: string;
  photoSrc: string | null;
  documentId: string;
  categoryName: string;
  code: string | null;
  handicap: number | null;
  needsConsent?: boolean;
}) {
  const router = useRouter();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      updateParticipantProfile(formData),
    null,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="card grid max-w-lg gap-4">
      {code ? <p className="text-sm text-muted">Código {code}</p> : null}
      <div className="field">
        <label htmlFor="p-name">Nombre</label>
        <input id="p-name" name="name" defaultValue={name} required />
      </div>
      <div className="field">
        <label htmlFor="p-alias">Alias</label>
        <input id="p-alias" name="alias" defaultValue={alias} />
      </div>
      <div className="field">
        <label htmlFor="p-club">Club</label>
        <input id="p-club" name="club" defaultValue={club} />
      </div>
      <div className="field">
        <label htmlFor="p-phone">Celular (WhatsApp)</label>
        <input id="p-phone" name="phone" type="tel" inputMode="numeric" defaultValue={phone} />
      </div>
      <PhotoFileField key={photoSrc ?? "empty"} existingSrc={photoSrc} onBusyChange={setPhotoBusy} />
      <div className="field">
        <label>Cédula</label>
        <input value={documentId || "—"} disabled readOnly />
      </div>
      <div className="field">
        <label>Categoría</label>
        <input value={categoryName} disabled readOnly />
      </div>
      <div className="field">
        <label>Handicap (distancia)</label>
        <input value={handicap != null ? String(handicap) : "Lo fija el organizador"} disabled readOnly />
      </div>
      {needsConsent ? (
        <DataProcessingConsent />
      ) : (
        <p className="text-xs text-muted">
          Ya autorizaste el tratamiento de tus datos. La política está en{" "}
          <a href="/tratamiento-de-datos" className="underline">
            Tratamiento de datos personales
          </a>
          .
        </p>
      )}
      {state && "error" in state && state.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-felt">Perfil actualizado.</p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending || photoBusy}>
        {pending ? "Guardando…" : photoBusy ? "Preparando foto…" : "Guardar"}
      </button>
    </form>
  );
}
