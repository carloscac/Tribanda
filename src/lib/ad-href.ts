/** Página del anunciante: http(s), una ruta interna, o un dominio sin https. Vacío si no tiene página. */
export function adHref(raw: string): string | null | false {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    return url.toString();
  } catch {
    return false;
  }
}
