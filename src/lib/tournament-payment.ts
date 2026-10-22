import { prisma } from "@/lib/prisma";

export const PAYMENT_METHODS = ["NEQUI", "TRANSFERENCIA", "EFECTIVO", "OTRO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type TournamentPayment = {
  method: PaymentMethod | null;
  account: string | null;
  note: string | null;
};

export function parsePaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  if (raw === "NEQUI" || raw === "TRANSFERENCIA" || raw === "EFECTIVO" || raw === "OTRO") {
    return raw;
  }
  return null;
}

export function paymentMethodLabel(method: PaymentMethod | null) {
  switch (method) {
    case "NEQUI":
      return "Nequi";
    case "TRANSFERENCIA":
      return "Transferencia bancaria";
    case "EFECTIVO":
      return "Efectivo en la sede";
    case "OTRO":
      return "Otro medio";
    default:
      return null;
  }
}

export function readPaymentFromForm(formData: FormData): TournamentPayment {
  const method = parsePaymentMethod(String(formData.get("paymentMethod") ?? "").trim());
  const account = String(formData.get("paymentAccount") ?? "").trim() || null;
  const note = String(formData.get("paymentNote") ?? "").trim() || null;
  return { method, account, note };
}

export function validateTournamentPayment(entryFee: number | null, payment: TournamentPayment) {
  if (entryFee == null || entryFee <= 0) return null;
  if ((payment.method === "NEQUI" || payment.method === "TRANSFERENCIA") && !payment.account) {
    return "Indica el número de Nequi o la cuenta donde se paga la inscripción.";
  }
  return null;
}

export async function loadTournamentPayment(tournamentId: string): Promise<TournamentPayment> {
  try {
    const rows = await prisma.$queryRaw<
      { paymentMethod: string | null; paymentAccount: string | null; paymentNote: string | null }[]
    >`
      SELECT paymentMethod, paymentAccount, paymentNote
      FROM Tournament
      WHERE id = ${tournamentId}
      LIMIT 1
    `;
    const row = rows[0];
    return {
      method: parsePaymentMethod(row?.paymentMethod),
      account: row?.paymentAccount ?? null,
      note: row?.paymentNote ?? null,
    };
  } catch {
    return { method: null, account: null, note: null };
  }
}

export async function saveTournamentPayment(tournamentId: string, payment: TournamentPayment) {
  try {
    await prisma.$executeRaw`
      UPDATE Tournament
      SET paymentMethod = ${payment.method},
          paymentAccount = ${payment.account},
          paymentNote = ${payment.note}
      WHERE id = ${tournamentId}
    `;
  } catch (err) {
    console.error("saveTournamentPayment", err);
  }
}

export function paymentInstructionLine(payment: TournamentPayment | null | undefined) {
  if (!payment) return "";
  const label = paymentMethodLabel(payment.method);
  const parts = [label, payment.account, payment.note].filter(Boolean);
  return parts.length ? ` Paga a: ${parts.join(" · ")}.` : "";
}
