import Link from "next/link";
import { auth } from "@/auth";
import { AppLogoDarkHeader } from "@/components/AppLogo";
import { homePathForRole, parseRole } from "@/lib/roles";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(homePathForRole(parseRole(session.user.role)));
  }

  return (
    <main className="marketing-dark min-h-screen bg-navy text-cream">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <AppLogoDarkHeader size="hero" className="mb-12 justify-center" />
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/torneos" className="btn btn-primary">
            Ver torneos
          </Link>
          <Link href="/registro" className="btn btn-ghost">
            Crear cuenta
          </Link>
          <Link href="/entrar?rol=participante" className="btn btn-ghost">
            Soy participante
          </Link>
          <Link href="/entrar" className="btn btn-ghost">
            Soy organizador
          </Link>
        </div>
        <LegalFooter tone="dark" />
      </div>
    </main>
  );
}
