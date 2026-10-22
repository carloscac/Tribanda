export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function uniqueSlug(name: string) {
  const base = slugify(name) || "torneo";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
