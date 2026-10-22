import Link from "next/link";
import type { RecentTable } from "@/lib/dashboard";

export function RecentMatches({ tables }: { tables: RecentTable[] }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="mb-3 text-sm font-semibold">Últimos resultados</p>
      <ul className="grid gap-2 text-sm">
        {tables.map((row) => (
          <li key={row.tableNumber}>
            <Link
              href={row.href}
              className={`block rounded-lg px-2 py-2 ${row.highlight ? "bg-live/10" : "hover:bg-navy"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Mesa {String(row.tableNumber).padStart(2, "0")}</span>
                <span className={`text-xs ${row.highlight ? "text-live" : "text-muted"}`}>{row.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {row.nameA} vs {row.nameB}
                {row.scoreA != null && row.scoreB != null ? ` · ${row.scoreA} – ${row.scoreB}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
