"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/participante", label: "Mis torneos", exact: true },
  { href: "/participante/torneos", label: "Torneos", exact: false },
  { href: "/participante/perfil", label: "Perfil", exact: false },
] as const;

export function ParticipantHeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="flex shrink-0 items-center gap-2">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-11 items-center text-sm font-semibold ${
              active ? "text-gold" : "text-cream/80"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
