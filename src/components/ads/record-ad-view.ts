const seenKey = (id: string) => `tribanda-ad-seen:${id}`;

/** Una vista por visita. Recargar o seguir en la página no vuelve a sumar hasta cerrar la pestaña. */
export function recordAdView(id: string) {
  try {
    if (sessionStorage.getItem(seenKey(id))) return;
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    return;
  }
  const url = `/api/anuncios/${encodeURIComponent(id)}/vista`;
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url)) return;
  void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
}
