export function playerPhotoSrc(player: {
  id: string;
  photoMime?: string | null;
  photoUrl?: string | null;
  updatedAt?: Date | string | number | null;
}) {
  const version =
    player.updatedAt instanceof Date
      ? player.updatedAt.getTime()
      : player.updatedAt
        ? new Date(player.updatedAt).getTime()
        : 0;
  const stored = player.photoUrl || "";
  const fromApi =
    Boolean(player.photoMime) || stored.startsWith(`/api/jugadores/${player.id}/foto`);
  if (fromApi) {
    return `/api/jugadores/${player.id}/foto${version ? `?v=${version}` : ""}`;
  }
  return stored || null;
}
