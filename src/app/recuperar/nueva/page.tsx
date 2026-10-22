import Link from "next/link";
import { AppLogoDarkHeader } from "@/components/AppLogo";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="marketing-dark min-h-screen bg-navy text-cream">
      <div className="mx-auto grid min-h-screen max-w-md content-center px-6 py-12">
        <Link href="/entrar" className="text-sm text-cream/70">
          ← Entrar
        </Link>
        <div className="mt-6 flex justify-center">
          <AppLogoDarkHeader size="lg" />
        </div>
        <h1 className="font-serif mt-6 text-3xl">Nueva contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-cream/70">Elige una contraseña de al menos 6 caracteres.</p>
        <div className="card">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-sm text-danger">
              Falta el enlace. Solicita uno nuevo en{" "}
              <Link href="/recuperar" className="font-semibold text-gold">
                Olvidé mi contraseña
              </Link>
              .
            </p>
          )}
        </div>
        <LegalFooter tone="dark" />
      </div>
    </main>
  );
}
