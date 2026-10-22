import Image from "next/image";
import Link from "next/link";
import { APP_NAME, LOGO_PATH } from "@/lib/brand";

const HEIGHT = {
  xs: 36,
  sm: 48,
  md: 64,
  lg: 112,
  hero: 240,
} as const;

export type AppLogoSize = keyof typeof HEIGHT;

export function AppLogo({
  size = "md",
  showText = false,
  href,
  className = "",
  framed = true,
  textTheme = "light",
}: {
  size?: AppLogoSize;
  showText?: boolean;
  href?: string;
  className?: string;
  /** Marco negro: el PNG lleva fondo negro y encaja en surface/navy. */
  framed?: boolean;
  /** Fondo claro del panel vs sidebar oscuro. */
  textTheme?: "light" | "dark";
}) {
  const h = HEIGHT[size];
  const inner = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center ${
          framed ? "overflow-hidden rounded-lg bg-black" : ""
        }`}
      >
        <Image
          src={LOGO_PATH}
          alt={showText ? "" : APP_NAME}
          width={h}
          height={h}
          className="object-contain"
          style={{ width: h, height: h }}
          priority={size === "hero" || size === "lg"}
        />
      </span>
      {showText && (
        <span className="min-w-0 text-left">
          <span
            className={`block text-sm font-bold tracking-wide ${
              textTheme === "dark" ? "text-cream" : "text-ink"
            }`}
          >
            {APP_NAME}
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-felt">
        {inner}
      </Link>
    );
  }
  return inner;
}

/** Texto de marca sobre fondos oscuros (sin duplicar el wordmark del PNG). */
export function AppLogoDarkHeader({
  size = "md",
  href = "/",
  subtitle,
  className = "",
}: {
  size?: AppLogoSize;
  href?: string;
  subtitle?: string;
  className?: string;
}) {
  const h = HEIGHT[size];
  const block = (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="inline-flex shrink-0 overflow-hidden rounded-lg bg-black">
        <Image
          src={LOGO_PATH}
          alt={APP_NAME}
          width={h}
          height={h}
          style={{ width: h, height: h }}
          className="object-contain"
          priority
        />
      </span>
      {subtitle ? <p className="text-sm text-cream/80">{subtitle}</p> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="inline-block rounded-lg">
        {block}
      </Link>
    );
  }
  return block;
}
