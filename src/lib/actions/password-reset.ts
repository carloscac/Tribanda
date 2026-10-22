"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { appOrigin } from "@/lib/app-url";
import { mailConfigured, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { isParticipantLoginEmail } from "@/lib/participant-account";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email.includes("@")) {
    return { error: "Escribe un email válido." };
  }

  const genericOk = {
    ok: true,
    message: "Si ese email tiene cuenta de organizador o administrador, te enviamos un enlace. Revisa el correo (y spam).",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  const canReset =
    user &&
    user.active &&
    (user.role === "ORGANIZER" || user.role === "ADMIN") &&
    !isParticipantLoginEmail(user.email);

  if (!canReset || !user) {
    return genericOk;
  }

  if (!mailConfigured()) {
    return {
      error:
        "El correo de recuperación no está configurado en el servidor (SMTP_HOST y SMTP_FROM). Pide al administrador que lo active, o usa Administración → Restablecer.",
    };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const origin = await appOrigin();
  const link = `${origin}/recuperar/nueva?token=${token}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("Enlace de recuperación:", link);
  }

  try {
    await sendMail({
      to: user.email,
      subject: "TriBanda — restablece tu contraseña",
      text: `Hola ${user.name},\n\nPediste restablecer la contraseña de TriBanda. Abre este enlace (válido 1 hora):\n\n${link}\n\nSi no fuiste tú, ignora este mensaje.`,
      html: `<p>Hola ${user.name},</p><p>Pediste restablecer la contraseña de <strong>TriBanda</strong>.</p><p><a href="${link}">Crear una nueva contraseña</a></p><p>El enlace caduca en 1 hora. Si no lo pediste, ignora este mensaje.</p>`,
    });
  } catch (err) {
    console.error("No se pudo enviar el correo de recuperación:", err);
    return { error: "No se pudo enviar el correo. Revisa SMTP o inténtalo más tarde." };
  }

  return genericOk;
}

export async function completePasswordReset(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Falta el enlace de recuperación." };
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (password !== confirm) return { error: "La confirmación no coincide." };

  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };
  }
  if (!row.user.active || (row.user.role !== "ORGANIZER" && row.user.role !== "ADMIN")) {
    return { error: "Esta cuenta no puede restablecer contraseña por correo." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { ok: true };
}
