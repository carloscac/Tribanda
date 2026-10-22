export function AdLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  return (
    <a
      href={href}
      target={internal ? undefined : "_blank"}
      rel={internal ? undefined : "noreferrer"}
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
