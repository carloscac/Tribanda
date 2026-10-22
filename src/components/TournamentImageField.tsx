"use client";

import { useRef, useState } from "react";
import { compressTournamentImage } from "@/lib/compress-image";
import { tournamentImageSrc } from "@/lib/tournament-image";

export function TournamentImageField({
  tournamentId,
  hasImage,
  updatedAt,
  onBusyChange,
}: {
  tournamentId?: string;
  hasImage?: boolean;
  updatedAt?: Date | string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const existing = tournamentId && hasImage ? tournamentImageSrc(tournamentId, updatedAt) : null;
  const submitRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existing);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSubmitFile(file: File | null) {
    const input = submitRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
  }

  return (
    <div className="field sm:col-span-2">
      <label htmlFor="tournament-image">Imagen del torneo</label>
      {preview && !remove ? (
        <img
          src={preview}
          alt=""
          className="mb-3 h-36 w-full max-w-md rounded-xl border border-line object-cover"
        />
      ) : null}
      <input ref={submitRef} type="file" name="image" className="hidden" tabIndex={-1} />
      <input
        id="tournament-image"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          setError(null);
          setRemove(false);
          if (!file) {
            setSubmitFile(null);
            setPreview(existing);
            return;
          }
          onBusyChange?.(true);
          try {
            const compact = await compressTournamentImage(file);
            setSubmitFile(compact);
            setPreview(URL.createObjectURL(compact));
          } catch {
            setSubmitFile(null);
            setPreview(existing);
            setError("No se pudo leer la imagen. Prueba JPG o PNG.");
          } finally {
            onBusyChange?.(false);
          }
        }}
      />
      {existing ? (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="removeImage"
            checked={remove}
            onChange={(event) => {
              setRemove(event.target.checked);
              if (event.target.checked) {
                setSubmitFile(null);
                setPreview(null);
              } else {
                setPreview(existing);
              }
            }}
          />
          Quitar imagen
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-muted">
        Se ve en la tarjeta del torneo. Puedes usar la foto del celular; se reduce sola.
      </p>
    </div>
  );
}
