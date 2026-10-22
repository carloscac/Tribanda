"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/participant/notifications";

type Row = {
  id: string;
  title: string;
  body: string;
  readAt: Date | string | null;
  createdAt: Date | string;
};

function isUnread(row: Row) {
  return row.readAt == null || row.readAt === "";
}

export function ParticipantNotifications({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [showRead, setShowRead] = useState(false);
  const [markAllPending, startMarkAll] = useTransition();

  const { unread, read } = useMemo(() => {
    const u: Row[] = [];
    const r: Row[] = [];
    for (const row of rows) {
      if (isUnread(row)) u.push(row);
      else r.push(row);
    }
    return { unread: u, read: r };
  }, [rows]);

  function onMarkAll() {
    startMarkAll(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted">Sin avisos por ahora.</p>;
  }

  return (
    <div className="grid gap-3">
      {unread.length > 0 && (
        <button
          type="button"
          className="text-left text-sm text-felt disabled:opacity-60"
          disabled={markAllPending}
          onClick={onMarkAll}
        >
          {markAllPending ? "Marcando…" : "Marcar todo como leído"}
        </button>
      )}

      {unread.length === 0 ? (
        <p className="text-sm text-muted">No tienes avisos nuevos.</p>
      ) : (
        <ul className="grid gap-2">
          {unread.map((row) => (
            <NotificationItem key={row.id} row={row} onRead={() => router.refresh()} />
          ))}
        </ul>
      )}

      {read.length > 0 && (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            className="text-sm text-muted"
            onClick={() => setShowRead((v) => !v)}
          >
            {showRead ? "Ocultar leídos" : `Ver ${read.length} aviso${read.length === 1 ? "" : "s"} leído${read.length === 1 ? "" : "s"}`}
          </button>
          {showRead && (
            <ul className="mt-2 grid gap-2">
              {read.map((row) => (
                <li key={row.id} className="rounded-lg border border-line px-3 py-2 opacity-75">
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-sm text-muted">{row.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ row, onRead }: { row: Row; onRead: () => void }) {
  const [pending, startTransition] = useTransition();

  function onMarkOne(formData: FormData) {
    startTransition(async () => {
      await markNotificationRead(formData);
      onRead();
    });
  }

  return (
    <li className="rounded-lg border border-gold/50 bg-gold/10 px-3 py-2">
      <p className="font-semibold">{row.title}</p>
      <p className="text-sm text-muted">{row.body}</p>
      <form action={onMarkOne} className="mt-2">
        <input type="hidden" name="id" value={row.id} />
        <button type="submit" className="text-xs text-felt" disabled={pending}>
          {pending ? "…" : "Marcar leído"}
        </button>
      </form>
    </li>
  );
}
