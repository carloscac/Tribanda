import { formatCOP } from "@/lib/labels";
import { paymentMethodLabel, type TournamentPayment } from "@/lib/tournament-payment";

export function TournamentPaymentBox({
  entryFee,
  payment,
}: {
  entryFee: number | null;
  payment?: TournamentPayment | null;
}) {
  if (entryFee == null || entryFee <= 0) return null;
  const label = paymentMethodLabel(payment?.method ?? null);

  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 px-3 py-3 text-sm">
      <p>
        Valor de inscripción: <strong>{formatCOP(entryFee)}</strong>
      </p>
      {label ? (
        <p className="mt-1">
          Medio: <strong>{label}</strong>
        </p>
      ) : null}
      {payment?.account ? (
        <p className="mt-1">
          Cuenta: <strong className="font-mono">{payment.account}</strong>
        </p>
      ) : null}
      {payment?.note ? <p className="mt-1">{payment.note}</p> : null}
      <p className="mt-2 text-muted">
        Quedarás inscrito cuando el organizador confirme el pago.
      </p>
    </div>
  );
}
