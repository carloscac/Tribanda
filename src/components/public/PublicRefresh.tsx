"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PublicRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let paused = false;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/") && !href.startsWith("//")) paused = true;
    };
    document.addEventListener("click", onClick, true);
    const id = window.setInterval(() => {
      if (paused || document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
