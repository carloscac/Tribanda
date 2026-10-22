import { tournamentImageSrc } from "@/lib/tournament-image";

export function TournamentCardCover({
  tournamentId,
  hasImage,
  updatedAt,
}: {
  tournamentId: string;
  hasImage: boolean;
  updatedAt?: Date | string | null;
}) {
  if (!hasImage) return null;
  return (
    <div className="-mx-5 -mt-5 mb-4 overflow-hidden rounded-t-[0.85rem]">
      <img
        src={tournamentImageSrc(tournamentId, updatedAt)}
        alt=""
        className="h-36 w-full object-cover sm:h-44"
      />
    </div>
  );
}
