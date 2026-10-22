import Link from "next/link";
import { AppLogoDarkHeader } from "@/components/AppLogo";
import { AuthForm } from "@/components/AuthForm";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { loginOrganizer } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; rol?: string }>;
}) {
  const { next, rol } = await searchParams;
  const participante = rol === "participante";

  return (
    <main className="marketing-dark min-h-screen bg-navy text-cream">
    <div className="mx-auto grid min-h-screen max-w-md content-center px-6 py-12">
      <Link href="/" className="text-sm text-cream/70">
        ← Inicio
      </Link>
      <div className="mt-6 flex justify-center">
        <AppLogoDarkHeader size="lg" />
      </div>
      <h1 className="font-serif mt-6 text-3xl">
        {participante ? "Entrar como jugador" : "Entrar como organizador"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-cream/70">
        {participante
          ? "Entra con tu cédula y la contraseña de tu cuenta."
          : "Email y contraseña de tu cuenta de organizador (como siempre)."}{" "}
        Si organizas y también juegas, son dos entradas distintas: email de organizador y cédula de
        jugador.
      </p>
      <div className="card">
        <AuthForm
          action={loginOrganizer}
          submitLabel="Entrar"
          hidden={next ? { next } : undefined}
        >
          <div className="field">
            <label htmlFor="login">{participante ? "Cédula" : "Email"}</label>
            <input
              id="login"
              name="login"
              required
              autoComplete="username"
              inputMode={participante ? "numeric" : undefined}
              type={participante ? "text" : "email"}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder={participante ? "Tu contraseña" : undefined}
            />
          </div>
        </AuthForm>
      </div>
      <p className="mt-4 text-sm text-cream/70">
        {participante ? (
          <>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-gold">
              Crear cuenta
            </Link>
            <br />
            ¿Organizas torneos?{" "}
            <Link href="/entrar" className="font-semibold text-gold">
              Entrar con email
            </Link>
          </>
        ) : (
          <>
            ¿Olvidaste la contraseña?{" "}
            <Link href="/recuperar" className="font-semibold text-gold">
              Restablecer por correo
            </Link>
            <br />
            ¿Eres jugador?{" "}
            <Link href="/entrar?rol=participante" className="font-semibold text-gold">
              Entrar con cédula
            </Link>
            <br />
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-gold">
              Crear cuenta
            </Link>
          </>
        )}
      </p>
      <LegalFooter tone="dark" />
    </div>
    </main>
  );
}
