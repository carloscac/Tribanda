import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";
import { APP_NAME } from "@/lib/brand";
import { DATA_PROCESSING_VERSION } from "@/lib/data-processing";

export const metadata = {
  title: `Tratamiento de datos personales · ${APP_NAME}`,
};

export default function DataProcessingPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <AppLogo size="xs" href="/" />
          <Link href="/" className="text-sm font-semibold text-gold">
            Inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-3xl">Autorización de tratamiento de datos personales</h1>
        <p className="mt-2 text-sm text-muted">
          Versión {DATA_PROCESSING_VERSION} · Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia)
        </p>

        <div className="card mt-6 grid gap-4 text-sm leading-relaxed">
          <p>
            <strong>{APP_NAME}</strong> (operado en tribanda.grupounico.com.co) es el responsable del
            tratamiento de los datos que entregas al crear una cuenta, inscribirte a un torneo o
            aparecer en un listado de deportistas.
          </p>
          <p>
            Al marcar la casilla de aceptación autorizas de manera libre, previa, expresa e
            informada el tratamiento de tus datos para las finalidades de esta plataforma.
          </p>
          <h2 className="font-serif text-xl">Datos que tratamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Identificación: nombre, cédula, ciudad, club y categoría o handicap.</li>
            <li>Contacto: celular y correo, para avisos del torneo y recuperación de acceso.</li>
            <li>Imagen: foto de perfil, si la cargas.</li>
            <li>
              Datos deportivos: inscripciones, partidos, carambolas, promedios, puestos y palmarés.
            </li>
          </ul>
          <h2 className="font-serif text-xl">Para qué los usamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Crear y administrar tu cuenta de jugador u organizador.</li>
            <li>Inscribirte, armar grupos, cuadros, mesas y resultados.</li>
            <li>Mostrar tableros públicos del torneo (grupos, cuadro, TV y estadísticas).</li>
            <li>Calcular handicap e historial deportivo.</li>
            <li>Cobrar o confirmar pagos de inscripción o repesca cuando el torneo lo exija.</li>
          </ul>
          <h2 className="font-serif text-xl">Con quién se comparten</h2>
          <p>
            El organizador del torneo ve tus datos de inscripción. El público del evento puede ver
            nombre, club, categoría, foto y estadísticas en las pantallas que el organizador deje
            visibles. No vendemos tu información.
          </p>
          <h2 className="font-serif text-xl">Tus derechos</h2>
          <p>
            Puedes conocer, actualizar, rectificar o suprimir tus datos, y revocar esta
            autorización, salvo cuando la ley o la ejecución del torneo exijan conservarlos (por
            ejemplo, resultados ya publicados). Escríbenos a través del organizador del torneo o
            usando los datos de contacto publicados en esta plataforma.
          </p>
          <p>
            La aceptación es voluntaria, pero sin ella no podemos crear la cuenta ni inscribirte:
            esos datos son necesarios para prestar el servicio.
          </p>
        </div>
      </main>
    </div>
  );
}
