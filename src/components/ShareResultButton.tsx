"use client";

import { useState } from "react";

export function ShareResultButton({
  title,
  text,
  path,
  label = "Compartir",
  className = "btn btn-primary px-3 py-1.5 text-sm",
}: {
  title: string;
  text: string;
  path: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function absoluteUrl() {
    return new URL(path, window.location.origin).toString();
  }

  async function onShare() {
    setNote(null);
    const url = absoluteUrl();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        setOpen(false);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setOpen(true);
  }

  async function copyLink() {
    const url = absoluteUrl();
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote("Texto copiado");
    } catch {
      setNote(url);
    }
  }

  const url = typeof window === "undefined" ? path : absoluteUrl();
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="inline-flex flex-col items-stretch">
      <button type="button" className={className} onClick={onShare}>
        {label}
      </button>
      {open ? (
        <div className="mt-2 grid min-w-44 gap-1 rounded-xl border border-line bg-surface p-2 text-left text-sm">
          <a className="rounded-lg px-2 py-1.5 hover:bg-paper" href={whatsapp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="rounded-lg px-2 py-1.5 hover:bg-paper" href={facebook} target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a className="rounded-lg px-2 py-1.5 hover:bg-paper" href={x} target="_blank" rel="noreferrer">
            X
          </a>
          <button type="button" className="rounded-lg px-2 py-1.5 text-left hover:bg-paper" onClick={copyLink}>
            Copiar texto
          </button>
          {note ? <p className="px-2 text-xs text-muted">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
