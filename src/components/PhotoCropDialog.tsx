"use client";

import { useEffect, useRef, useState } from "react";

const OUT = 800;

function cropViewSize() {
  if (typeof window === "undefined") return 280;
  return Math.max(180, Math.min(280, window.innerWidth - 64));
}

function coverScale(width: number, height: number, view: number) {
  return view / Math.min(width, height);
}

export function PhotoCropDialog({
  source,
  fileName,
  onConfirm,
  onCancel,
}: {
  source: string;
  fileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(280);

  useEffect(() => {
    const fit = () => setView(cropViewSize());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = source;
  }, [source]);

  const img = imgRef.current;
  const base = img ? coverScale(img.naturalWidth, img.naturalHeight, view) : 1;
  const scale = base * zoom;
  const drawW = img ? img.naturalWidth * scale : view;
  const drawH = img ? img.naturalHeight * scale : view;

  function clamp(next: { x: number; y: number }, nextZoom = zoom) {
    if (!img) return next;
    const s = coverScale(img.naturalWidth, img.naturalHeight, view) * nextZoom;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    const maxX = Math.max(0, (w - view) / 2);
    const maxY = Math.max(0, (h - view) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOffset(
      clamp({
        x: drag.current.ox + (event.clientX - drag.current.x),
        y: drag.current.oy + (event.clientY - drag.current.y),
      }),
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    if (!img) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    const ratio = OUT / view;
    const dx = (view - drawW) / 2 + offset.x;
    const dy = (view - drawH) / 2 + offset.y;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, dx * ratio, dy * ratio, drawW * ratio, drawH * ratio);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    setBusy(false);
    if (!blob) return;
    const name = fileName.replace(/\.[^.]+$/, "") || "foto";
    onConfirm(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-navy/80 p-4">
      <div className="w-full min-w-0 max-w-sm rounded-3xl bg-surface p-4 text-cream shadow-2xl">
        <h2 className="font-serif text-xl">Recortar foto</h2>
        <p className="mt-1 text-sm text-cream/70">Mueve la imagen y ajusta el zoom. Se guarda en cuadrado.</p>
        <div
          className="relative mx-auto mt-4 overflow-hidden rounded-2xl border border-line bg-navy touch-none"
          style={{ width: view, height: view }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {ready && img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: drawW,
                height: drawH,
                left: (view - drawW) / 2 + offset.x,
                top: (view - drawH) / 2 + offset.y,
              }}
            />
          ) : (
            <p className="grid h-full place-items-center text-sm text-cream/60">Cargando…</p>
          )}
        </div>
        <label className="mt-4 grid gap-1 text-sm">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => {
              const next = Number(event.target.value);
              setZoom(next);
              setOffset((prev) => clamp(prev, next));
            }}
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={!ready || busy}>
            {busy ? "Recortando…" : "Usar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
