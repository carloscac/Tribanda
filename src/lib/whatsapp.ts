import { phoneForWhatsApp } from "@/lib/phone";

/**
 * Envío por WhatsApp Cloud API. Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID no hace nada.
 */
export async function sendWhatsAppText(rawPhone: string | null | undefined, body: string) {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { skipped: true as const, reason: "no-api" };
  }
  const to = rawPhone ? phoneForWhatsApp(rawPhone) : "";
  if (!to) return { skipped: true as const, reason: "bad-phone" };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("whatsapp", res.status, detail);
    return { skipped: false as const, ok: false as const };
  }
  return { skipped: false as const, ok: true as const };
}
