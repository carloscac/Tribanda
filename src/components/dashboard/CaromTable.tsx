export function CaromTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper p-3">
      <svg viewBox="0 0 640 360" className="h-auto w-full" role="img" aria-label="Partida a tres bandas">
        <rect x="8" y="8" width="624" height="344" rx="28" fill="#5a3a22" />
        <rect x="28" y="28" width="584" height="304" rx="10" fill="#1e4d8c" />
        <rect x="36" y="36" width="568" height="288" rx="6" fill="#163e74" />
        <path
          d="M120 250 C 180 80, 420 60, 500 120 C 560 160, 430 230, 300 200 C 220 180, 200 260, 280 270"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeDasharray="7 7"
        />
        <circle cx="118" cy="248" r="11" fill="#f4f1ea" stroke="#1c1b16" strokeWidth="1" />
        <circle cx="292" cy="168" r="11" fill="#d61f1f" stroke="#1c1b16" strokeWidth="1" />
        <circle cx="498" cy="122" r="11" fill="#e6c34a" stroke="#1c1b16" strokeWidth="1" />
        <text x="320" y="344" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11">
          Partida a tres bandas
        </text>
      </svg>
    </div>
  );
}
