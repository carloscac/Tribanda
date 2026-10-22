"use client";

import { useEffect, useRef, useState } from "react";

/** Aviso visible cuando llegan notificaciones nuevas tras un refresh en segundo plano. */
export function ParticipantNewAlert({ unreadCount }: { unreadCount: number }) {
  const prev = useRef(unreadCount);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const delta = unreadCount - prev.current;
    if (delta > 0) {
      setMessage(
        delta === 1 ? "Tienes un aviso nuevo" : `Tienes ${delta} avisos nuevos`,
      );
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(200);
      }
    }
    prev.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 8000);
    return () => window.clearTimeout(id);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="alert alert-warn mb-4 border-gold/50 bg-gold/15 text-ink"
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
}
