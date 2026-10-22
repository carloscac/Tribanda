/** Celular Colombia: 10 dígitos (3xx…) o con prefijo 57 / +57. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("57")) return digits.slice(2);
  return digits;
}

export function isValidMobilePhone(raw: string) {
  const phone = normalizePhone(raw);
  return phone.length === 10 && phone.startsWith("3");
}

/** Formato listo para WhatsApp (sin +). */
export function phoneForWhatsApp(raw: string) {
  const phone = normalizePhone(raw);
  if (!isValidMobilePhone(phone)) return "";
  return `57${phone}`;
}
