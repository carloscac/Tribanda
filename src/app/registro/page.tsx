import Link from "next/link";
import { redirect } from "next/navigation";
import { AppLogoDarkHeader } from "@/components/AppLogo";
import { AuthForm } from "@/components/AuthForm";
import { DataProcessingConsent, LegalFooter } from "@/components/DataProcessingConsent";
import { registerParticipant } from "@/lib/actions/register";
import { auth } from "@/auth";
import { homePathForRole, parseRole } from "@/lib/roles";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role) {
    redirect(homePathForRole(parseRole(session.user.role)));
  }
  const { next } = await searchParams;

  return (
    <main className="marketing-dark min-h-screen bg-navy text-cream">
      <div className="mx-auto grid min-h-screen max-w-md content-center px-6 py-12">
        <Link href="/" className="text-sm text-cream/70">
          ← Inicio
        </Link>
        <div className="mt-6 flex justify-center">
          <AppLogoDarkHeader size="lg" />
        </div>
        <h1 className="font-serif mt-6 text-3xl">Crear cuenta</h1>
        <p className="mt-1 mb-6 text-sm text-cream/70">
          Solo lo necesario para entrar y anotarte a un torneo.
        </p>
        <div className="card">
          <AuthForm
            action={registerParticipant}
            submitLabel="Crear cuenta"
            hidden={next ? { next } : undefined}
          >
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="phone">Celular</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                autoComplete="tel"
                placeholder="3xx xxx xxxx"
              />
            </div>
            <div className="field">
              <label htmlFor="documentId">Cédula</label>
              <input
                id="documentId"
                name="documentId"
                inputMode="numeric"
                required
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Correo (opcional)</label>
              <input id="email" name="email" type="email" autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            <DataProcessingConsent />
          </AuthForm>
        </div>
        <p className="mt-4 text-sm text-cream/70">
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar?rol=participante" className="font-semibold text-gold">
            Entrar
          </Link>
        </p>
        <LegalFooter tone="dark" />
      </div>
    </main>
  );
}
