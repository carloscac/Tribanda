import Link from "next/link";
import { AppLogoDarkHeader } from "@/components/AppLogo";
import { AuthForm } from "@/components/AuthForm";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { requestPasswordReset } from "@/lib/actions/password-reset";

export default function RecoverPage() {
  return (
    <main className="marketing-dark min-h-screen bg-navy text-cream">
      <div className="mx-auto grid min-h-screen max-w-md content-center px-6 py-12">
        <Link href="/entrar" className="text-sm text-cream/70">
          ← Volver a entrar
        </Link>
        <div className="mt-6 flex justify-center">
          <AppLogoDarkHeader size="lg" />
        </div>
        <h1 className="font-serif mt-6 text-3xl">Olvidé mi contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-cream/70">
          Escribe el email de organizador o administrador. Te enviamos un enlace para crear una nueva
          contraseña (1 hora). Los jugadores entran con la cédula, no con este flujo.
        </p>
        <div className="card">
          <AuthForm action={requestPasswordReset} submitLabel="Enviar enlace">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
          </AuthForm>
        </div>
        <LegalFooter tone="dark" />
      </div>
    </main>
  );
}
