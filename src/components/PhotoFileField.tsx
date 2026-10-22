"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoCropDialog } from "@/components/PhotoCropDialog";

function isPhoneDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function PhotoFileField({
  name = "photo",
  label = "Foto (opcional)",
  existingSrc = null,
  onBusyChange,
}: {
  name?: string;
  label?: string;
  existingSrc?: string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const submitRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingSrc);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => {
    setPhone(isPhoneDevice());
  }, []);

  useEffect(() => {
    setPreview(existingSrc);
  }, [existingSrc]);

  function setSubmitFile(file: File | null) {
    const input = submitRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
  }

  function onPick(file: File | undefined) {
    setError(null);
    if (!file) {
      setSubmitFile(null);
      setPreview(existingSrc);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Usa una imagen JPG o PNG.");
      return;
    }
    setCrop({ src: URL.createObjectURL(file), name: file.name });
  }

  function applyCrop(file: File) {
    if (crop) URL.revokeObjectURL(crop.src);
    setCrop(null);
    setSubmitFile(file);
    setPreview(URL.createObjectURL(file));
    onBusyChange?.(false);
  }

  return (
    <div className="field">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {preview ? (
        <img
          src={preview}
          alt=""
          className="mb-3 h-28 w-28 rounded-xl border border-line object-cover"
        />
      ) : null}
      <input ref={submitRef} type="file" name={name} className="hidden" tabIndex={-1} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => cameraRef.current?.click()}>
          Tomar foto
        </button>
        <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => fileRef.current?.click()}>
          {phone ? "Galería" : "Buscar en archivos"}
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-muted">
        {phone
          ? "En el celular se abre la cámara. Luego puedes recortar la foto."
          : "Toma una foto o elige un archivo y recórtalo antes de guardar."}
      </p>
      {crop ? (
        <PhotoCropDialog
          source={crop.src}
          fileName={crop.name}
          onConfirm={applyCrop}
          onCancel={() => {
            URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
        />
      ) : null}
    </div>
  );
}
