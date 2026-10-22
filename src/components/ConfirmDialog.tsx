"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy/70"
        aria-label="Cerrar"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            type="button"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
