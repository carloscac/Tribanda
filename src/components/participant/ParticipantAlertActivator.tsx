"use client";

import { useEffect, useState } from "react";
import {
  canVibrate,
  matchAlertsEnabled,
  playActivationTest,
  requestMatchAlertPermission,
  setMatchAlertsEnabled,
  unlockAlertAudio,
} from "@/lib/participant-alert-feedback";

export function ParticipantAlertActivator() {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(matchAlertsEnabled());
    setReady(true);
  }, []);

  if (!ready || enabled) return null;

  async function activate() {
    setBusy(true);
    setHint(null);
    await unlockAlertAudio();
    const perm = await requestMatchAlertPermission();
    setMatchAlertsEnabled(true);
    setEnabled(true);
    await playActivationTest();
    setBusy(false);
    const parts: string[] = [];
    if (perm !== "granted") {
      parts.push(
        "Para que suene con otra app delante, permite notificaciones de este sitio en los ajustes del navegador.",
      );
    }
    if (!canVibrate()) {
      parts.push("Si el celular no vibra desde el navegador, el tono y el aviso en pantalla sí se escuchan.");
    }
    if (parts.length) setHint(parts.join(" "));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] border-t-2 border-gold bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium">¿Te llaman a mesa?</p>
        <p className="text-xs text-muted">
          Toca <strong className="text-ink">Activar avisos</strong> una vez. Oirás un tono de prueba.
        </p>
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={activate}>
          {busy ? "Activando…" : "Activar avisos con sonido"}
        </button>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
