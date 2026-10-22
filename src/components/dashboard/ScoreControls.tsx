"use client";

import { Pause, RotateCcw, Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function ScoreControls({
  nameA,
  nameB,
  paused,
  finished,
  busy,
  error,
  onUndo,
  onPause,
  onReset,
  onClose,
  onWalkoverA,
  onWalkoverB,
  confirm,
}: {
  nameA: string;
  nameB: string;
  paused: boolean;
  finished: boolean;
  busy: boolean;
  error: string | null;
  onUndo: () => void;
  onPause: () => void;
  onReset: () => void;
  onClose: () => void;
  onWalkoverA: () => void;
  onWalkoverB: () => void;
  confirm: {
    kind: "close" | "reset" | "walkA" | "walkB" | null;
    pending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  };
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Mesa</p>
        {busy && <span className="text-xs text-gold">Guardando…</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost w-full" type="button" disabled={finished} onClick={onUndo}>
            <Undo2 size={16} /> Deshacer
          </button>
          <button className="btn btn-ghost w-full" type="button" disabled={finished} onClick={onPause}>
            <Pause size={16} /> {paused ? "Seguir" : "Pausa"}
          </button>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Acciones rápidas</p>
      <div className="grid gap-2">
        <button className="btn btn-primary w-full" type="button" disabled={finished} onClick={onClose}>
          Finalizar partido
        </button>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-ghost w-full" type="button" disabled={finished} onClick={onReset}>
          <RotateCcw size={16} /> Reiniciar mesa
        </button>
      </div>

      {!finished && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Walkover</p>
          <p className="mb-2 text-xs text-muted">El rival avanza. No cuenta para promedio ni tacada.</p>
          <div className="grid gap-2">
            <button className="btn btn-ghost w-full" type="button" onClick={onWalkoverA}>
              Avanza {nameA}
            </button>
            <button className="btn btn-ghost w-full" type="button" onClick={onWalkoverB}>
              Avanza {nameB}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.kind === "close"}
        title="Cerrar partido"
        message="Se guarda el marcador actual y se libera la mesa."
        confirmLabel="Cerrar partido"
        pending={confirm.pending}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
      <ConfirmDialog
        open={confirm.kind === "reset"}
        title="Reiniciar mesa"
        message="Las carambolas, entradas y tacadas de este partido vuelven a cero."
        confirmLabel="Reiniciar"
        danger
        pending={confirm.pending}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
      <ConfirmDialog
        open={confirm.kind === "walkA"}
        title="Walkover"
        message={`${nameA} avanza. No cuenta para promedio ni tacada.`}
        confirmLabel={`Avanza ${nameA}`}
        pending={confirm.pending}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
      <ConfirmDialog
        open={confirm.kind === "walkB"}
        title="Walkover"
        message={`${nameB} avanza. No cuenta para promedio ni tacada.`}
        confirmLabel={`Avanza ${nameB}`}
        pending={confirm.pending}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  );
}
