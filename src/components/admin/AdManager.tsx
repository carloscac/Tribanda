"use client";

import { useActionState, useState } from "react";
import { PhotoFileField } from "@/components/PhotoFileField";
import { deleteAd, saveAd } from "@/lib/actions/admin/ads";
import { parseGoogleAd } from "@/lib/ad-embed";
import { adImageSrc, adSlideSrc } from "@/lib/ads";

type AdRow = {
  id: string;
  kind: string;
  provider?: string;
  title: string;
  body: string | null;
  href: string | null;
  embed?: string | null;
  imageMime: string | null;
  active: boolean;
  sortOrder: number;
  tournamentId?: string | null;
  tournamentName?: string | null;
  views?: number;
  slides?: { id: string; createdAt: string | Date }[];
  updatedAt: Date | string;
};

function viewLabel(views: number) {
  const total = Math.max(0, views);
  if (total === 1) return "Visto 1 vez";
  return `Visto ${total.toLocaleString("es-CO")} veces`;
}

type TournamentOption = {
  id: string;
  name: string;
  date: Date | string | null;
};

function tournamentOptionLabel(tournament: TournamentOption) {
  if (!tournament.date) return tournament.name;
  const date = new Date(tournament.date);
  if (Number.isNaN(date.getTime())) return tournament.name;
  const label = date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${tournament.name} · ${label}`;
}

function AdForm({ ad, tournaments }: { ad?: AdRow; tournaments: TournamentOption[] }) {
  const [scope, setScope] = useState(ad?.tournamentId ? "tournament" : "app");
  const [kind, setKind] = useState(ad?.kind === "BANNER" || ad?.kind === "WIDE" ? ad.kind : "INTERSTITIAL");
  const google = parseGoogleAd(ad?.embed);
  const [provider, setProvider] = useState(ad?.provider ?? "CUSTOM");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => saveAd(formData),
    null,
  );
  const id = ad?.id ?? "new";

  return (
    <form action={formAction} className="grid gap-3">
      {ad ? <input type="hidden" name="id" value={ad.id} /> : null}
      <div className="field">
        <label htmlFor={`ad-kind-${id}`}>Tamaño</label>
        <select id={`ad-kind-${id}`} name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="INTERSTITIAL">Ventana grande (tipo Nequi)</option>
          <option value="WIDE">Banner (imagen ancha)</option>
          <option value="BANNER">Aviso pequeño (se cierra con X)</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`ad-provider-${id}`}>Fuente</label>
        <select
          id={`ad-provider-${id}`}
          name="provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="YOUTUBE">YouTube (pega la URL del video)</option>
          <option value="GOOGLE">Google AdSense</option>
          <option value="CUSTOM">Imagen propia</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`ad-title-${id}`}>Título</label>
        <input id={`ad-title-${id}`} name="title" defaultValue={ad?.title ?? ""} placeholder="Publicidad" />
      </div>
      {provider === "YOUTUBE" ? (
        <div className="field">
          <label htmlFor={`ad-yt-${id}`}>URL de YouTube</label>
          <input
            id={`ad-yt-${id}`}
            name="youtubeUrl"
            defaultValue={ad?.provider === "YOUTUBE" ? (ad.embed ?? "") : ""}
            placeholder="https://www.youtube.com/watch?v=…"
            required
          />
        </div>
      ) : null}
      {provider === "GOOGLE" ? (
        <>
          <div className="field">
            <label htmlFor={`ad-gclient-${id}`}>ID de editor AdSense</label>
            <input
              id={`ad-gclient-${id}`}
              name="googleClient"
              defaultValue={google?.client ?? ""}
              placeholder="ca-pub-0000000000000000"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`ad-gslot-${id}`}>ID del anuncio (slot)</label>
            <input
              id={`ad-gslot-${id}`}
              name="googleSlot"
              defaultValue={google?.slot ?? ""}
              placeholder="1234567890"
              required
            />
          </div>
        </>
      ) : null}
      {provider === "CUSTOM" ? (
        <>
          <div className="field">
            <label htmlFor={`ad-body-${id}`}>Texto</label>
            <textarea id={`ad-body-${id}`} name="body" rows={3} defaultValue={ad?.body ?? ""} />
          </div>
          <div className="field">
            <label htmlFor={`ad-href-${id}`}>Página del anunciante</label>
            <input
              id={`ad-href-${id}`}
              name="href"
              placeholder="https://www.anunciante.com"
              defaultValue={ad?.href ?? ""}
            />
            <p className="text-xs text-muted">
              Opcional. Si la escribes, al tocar la imagen se abre esa página. Si no tiene página, déjalo vacío.
            </p>
          </div>
          <PhotoFileField
            name="image"
            label={kind === "WIDE" ? "Imagen del banner" : "Imagen"}
            existingSrc={ad?.imageMime ? adImageSrc(ad.id, ad.updatedAt) : null}
            onBusyChange={setPhotoBusy}
          />
          {kind === "WIDE" ? (
            <div className="field">
              <label htmlFor={`ad-slides-${id}`}>Más imágenes</label>
              <input id={`ad-slides-${id}`} name="slides" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />
              <p className="text-xs text-muted">
                Hasta 8 además de la principal. En el banner pasan solas, una cada pocos segundos. También puedes deslizarlas.
              </p>
              {ad?.slides?.length ? (
                <ul className="mt-2 grid gap-2">
                  {ad.slides.map((slide, index) => (
                    <li key={slide.id} className="flex items-center gap-3">
                      <img
                        src={adSlideSrc(ad.id, slide.id, slide.createdAt)}
                        alt=""
                        className="h-14 w-24 rounded-lg border border-line object-cover"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="removeSlide" value={slide.id} />
                        Quitar imagen {ad.imageMime ? index + 2 : index + 1}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {ad?.imageMime ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" />
              Quitar imagen
            </label>
          ) : null}
        </>
      ) : null}
      <div className="field">
        <label htmlFor={`ad-scope-${id}`}>Dónde se ve</label>
        <select
          id={`ad-scope-${id}`}
          name="scope"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="app">Toda la aplicación</option>
          <option value="tournament">Solo un torneo</option>
        </select>
      </div>
      {scope === "tournament" ? (
        <div className="field">
          <label htmlFor={`ad-tournament-${id}`}>Torneo</label>
          <select
            id={`ad-tournament-${id}`}
            name="tournamentId"
            defaultValue={ad?.tournamentId ?? ""}
            required
          >
            <option value="">Elige el torneo</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournamentOptionLabel(tournament)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="tournamentId" value="" />
      )}
      <div className="field">
        <label htmlFor={`ad-order-${id}`}>Orden</label>
        <input
          id={`ad-order-${id}`}
          name="sortOrder"
          type="number"
          min={0}
          max={99}
          defaultValue={ad?.sortOrder ?? 0}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={ad ? ad.active : true} />
        Activo
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-felt">Anuncio guardado.</p> : null}
      <button className="btn btn-primary w-fit" type="submit" disabled={pending || photoBusy}>
        {pending ? "Guardando…" : ad ? "Actualizar" : "Publicar anuncio"}
      </button>
    </form>
  );
}

function DeleteAdButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => deleteAd(formData),
    null,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-danger" disabled={pending}>
        {pending ? "Borrando…" : "Eliminar"}
      </button>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

export function AdManager({
  ads,
  tournaments,
}: {
  ads: AdRow[];
  tournaments: TournamentOption[];
}) {
  return (
    <div className="grid gap-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Nuevo anuncio</h2>
        <AdForm tournaments={tournaments} />
      </section>
      {ads.map((ad) => (
        <section key={ad.id} className="card grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {ad.kind === "BANNER" ? "Aviso pequeño" : ad.kind === "WIDE" ? "Banner" : "Ventana grande"}
              {" · "}
              {ad.provider === "YOUTUBE" ? "YouTube" : ad.provider === "GOOGLE" ? "Google" : "Imagen"}
              {" · "}
              {ad.tournamentId ? (ad.tournamentName ?? "Un torneo") : "Toda la aplicación"}
              {ad.active ? " · Activo" : " · Pausado"}
              {" · "}
              {viewLabel(ad.views ?? 0)}
            </p>
            <DeleteAdButton id={ad.id} />
          </div>
          <AdForm ad={ad} tournaments={tournaments} />
        </section>
      ))}
    </div>
  );
}
