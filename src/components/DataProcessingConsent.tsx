"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DATA_PROCESSING_PATH } from "@/lib/data-processing";

export function DataProcessingConsent({
  variant = "self",
  required = true,
}: {
  variant?: "self" | "organizer";
  required?: boolean;
}) {
  const name = variant === "organizer" ? "dataProcessingAttested" : "dataProcessingAccepted";
  const label =
    variant === "organizer" ? (
      <>
        Declaro que el deportista autorizó el{" "}
        <Link href={DATA_PROCESSING_PATH} className="font-semibold underline" target="_blank">
          tratamiento de sus datos personales
        </Link>
        .
      </>
    ) : (
      <>
        Acepto el{" "}
        <Link href={DATA_PROCESSING_PATH} className="font-semibold underline" target="_blank">
          tratamiento de mis datos personales
        </Link>{" "}
        para crear la cuenta, inscribirme y publicar resultados del torneo.
      </>
    );

  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} className="mt-1" required={required} />
      <span>{label}</span>
    </label>
  );
}

export function LegalFooter({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <p
      className={`mt-8 text-center text-xs ${tone === "dark" ? "text-cream/60" : "text-muted"}`}
    >
      <Link href={DATA_PROCESSING_PATH} className="underline-offset-2 hover:underline">
        Tratamiento de datos personales
      </Link>
    </p>
  );
}

export function PublicLegalFooter() {
  const pathname = usePathname();
  if (pathname?.endsWith("/tv")) return null;
  return <LegalFooter />;
}
