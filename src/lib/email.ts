export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string) {
  const email = normalizeEmail(raw);
  return email.length >= 6 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
