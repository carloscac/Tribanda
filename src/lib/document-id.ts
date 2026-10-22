/** Normaliza cédula / documento: solo dígitos (Colombia y similares). */
export function normalizeDocumentId(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 5 ? digits : "";
}

export function isValidDocumentId(raw: string) {
  const normalized = normalizeDocumentId(raw);
  return normalized.length >= 5 && normalized.length <= 15;
}
