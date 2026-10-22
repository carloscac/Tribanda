"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { markNotificationRead } from "@/lib/actions/participant/notifications";
import {
  fireMatchAlertFeedback,
  matchAlertsEnabled,
} from "@/lib/participant-alert-feedback";

type Alert = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export function ParticipantGlobalAlert() {
  const pathname = usePathname();
  const [active, setActive] = useState<Alert | null>(null);
  const lastKey = useRef("");
  const [pending, startTransition] = useTransition();
  const [alertsOn, setAlertsOn] = useState(false);

  useEffect(() => {
    const sync = () => setAlertsOn(matchAlertsEnabled());
    sync();
    window.addEventListener("tribanda-alerts-changed", sync);
    return () => window.removeEventListener("tribanda-alerts-changed", sync);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/participant/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { alerts: Alert[] };
      const top = data.alerts[0];
      if (!top) {
        if (!document.hidden) setActive(null);
        lastKey.current = "";
        return;
      }
      const key = `${top.id}:${top.createdAt}`;
      if (key === lastKey.current) return;
      lastKey.current = key;

      if (matchAlertsEnabled() || Notification.permission === "granted") {
        void fireMatchAlertFeedback(top.title, top.body);
      }

      if (!document.hidden) setActive(top);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    poll();
    const ms = alertsOn ? 3000 : 5000;
    const id = window.setInterval(poll, ms);
    const onVis = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll, alertsOn]);

  if (!active) return null;

  const onParticipantHome = pathname === "/participante";

  function dismiss(read: boolean) {
    if (!active) return;
    startTransition(async () => {
      if (read) {
        const fd = new FormData();
        fd.set("id", active.id);
        await markNotificationRead(fd);
      }
      setActive(null);
      lastKey.current = "";
      poll();
    });
  }

  return (
    <div
      className="participant-match-toast pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.65rem,env(safe-area-inset-top))]"
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-gold bg-paper text-ink shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div className="bg-gold/15 px-4 py-2">
          <p className="text-xs font-bold tracking-wider text-gold uppercase">Aviso del torneo</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-lg font-semibold leading-snug">{active.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/90">{active.body}</p>
          {!alertsOn && (
            <p className="mt-2 text-xs text-muted">
              Pulsa <strong className="text-ink">Activar avisos</strong> para que suene en tu celular.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-line bg-surface/40 px-4 py-3 sm:flex-row">
          {!onParticipantHome && (
            <Link href="/participante" className="btn btn-primary w-full text-center text-sm sm:flex-1">
              Ver mis avisos
            </Link>
          )}
          <button
            type="button"
            className="btn btn-ghost w-full border border-line text-sm sm:flex-1"
            disabled={pending}
            onClick={() => dismiss(true)}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
