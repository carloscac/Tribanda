"use client";

import Link from "next/link";
import { useState } from "react";

export function CopyPublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <p className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
      <span>
        Enlace público:{" "}
        <Link href={`/t/${slug}`} className="font-medium text-ink">
          /t/{slug}
        </Link>
      </span>
      <button
        type="button"
        className="btn btn-ghost px-3 py-1 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/t/${slug}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar enlace"}
      </button>
    </p>
  );
}
